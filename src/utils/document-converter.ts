import {
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
import mammoth from 'mammoth';
import PptxGenJS from 'pptxgenjs';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { pdfjsLib, renderPageToDataUrl } from './pdfjs-config';
import { sanitizeSpreadsheetCell } from '../workers/office/table-data';

export type ConversionFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'pptx' | 'png';
export type ConversionMode = 'editable' | 'visual';

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'table'; rows: string[][] };

interface VisualPage {
  dataUrl: string;
  width: number;
  height: number;
}

interface ConversionContent {
  blocks: ContentBlock[];
  visualPages: VisualPage[];
  warnings: string[];
}

export interface ConvertedFile {
  blob: Blob;
  fileName: string;
  warnings: string[];
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const OFFICE_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const POWERPOINT_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function getSourceFormat(file: File): ConversionFormat | 'image' {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'pdf';
  if (extension === 'docx') return 'docx';
  if (extension === 'xlsx' || extension === 'xls') return 'xlsx';
  if (extension === 'csv') return 'csv';
  if (extension === 'pptx') return 'pptx';
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? '')) return 'image';
  throw new Error('Format file tidak didukung. Pilih PDF, DOCX, XLSX, CSV, PPTX, JPG, PNG, atau WebP.');
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const encoded = dataUrl.split(',')[1];
  if (!encoded) throw new Error('Data gambar tidak valid.');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function arrayBufferOf(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  return value instanceof ArrayBuffer ? value : Uint8Array.from(value).buffer;
}

function paragraphText(element: Element): string {
  return Array.from(element.getElementsByTagName('*'))
    .filter((child) => child.localName === 't')
    .map((child) => child.textContent ?? '')
    .join('')
    .trim();
}

function addPdfLine(blocks: ContentBlock[], items: { x: number; y: number; width: number; text: string }[]) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  const cells: string[] = [];
  let current = '';
  let right = 0;
  for (const item of ordered) {
    const gap = item.x - right;
    if (current && gap > 28) {
      cells.push(current.trim());
      current = item.text;
    } else {
      current += `${current && gap > 2 ? ' ' : ''}${item.text}`;
    }
    right = item.x + item.width;
  }
  if (current.trim()) cells.push(current.trim());
  if (cells.length > 1) {
    const previous = blocks.at(-1);
    if (previous?.type === 'table' && previous.rows[0]?.length === cells.length) {
      previous.rows.push(cells);
    } else {
      blocks.push({ type: 'table', rows: [cells] });
    }
  } else if (cells[0]) {
    blocks.push({ type: 'paragraph', text: cells[0] });
  }
}

async function readPdf(file: File, includeVisualPages: boolean): Promise<ConversionContent> {
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const blocks: ContentBlock[] = [];
  let selectableCharacters = 0;
  const pagesWithoutSelectableText: number[] = [];
  const visualPages: VisualPage[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => {
      if (!('str' in item) || !item.str.trim()) return [];
      const [a, b, c, d, x, y] = item.transform;
      return [{ x, y, width: item.width, text: item.str, fontSize: Math.hypot(a, b, c, d) }];
    });
    const pageCharacters = items.reduce((total, item) => total + item.text.length, 0);
    selectableCharacters += pageCharacters;
    if (pageCharacters < 5) pagesWithoutSelectableText.push(pageNumber);

    const lines: { y: number; items: typeof items }[] = [];
    for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, item.fontSize * 0.35));
      if (line) line.items.push(item);
      else lines.push({ y: item.y, items: [item] });
    }
    lines.sort((a, b) => b.y - a.y).forEach((line) => addPdfLine(blocks, line.items));

    page.cleanup();
  }

  if (selectableCharacters < 5 || blocks.length === 0 || pagesWithoutSelectableText.length) {
    const pageList = pagesWithoutSelectableText.length
      ? ` Halaman ${pagesWithoutSelectableText.join(', ')} tidak memiliki teks yang bisa dipilih.`
      : '';
    throw new Error(`PDF scan atau PDF tanpa cukup teks yang bisa dipilih ditolak karena OCR dinonaktifkan.${pageList}`);
  }
  if (includeVisualPages) {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const rendered = await renderPageToDataUrl(document, pageNumber, 1.35, 0.9, 'both', 'image/png');
      visualPages.push({ dataUrl: rendered.dataUrl!, width: rendered.width, height: rendered.height });
    }
  }
  return { blocks, visualPages, warnings: [] };
}

async function readDocx(file: File): Promise<ConversionContent> {
  const { value, messages } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const parsed = new DOMParser().parseFromString(value, 'text/html');
  const blocks: ContentBlock[] = [];

  for (const element of Array.from(parsed.body.children)) {
    if (element.localName === 'table') {
      const rows = Array.from(element.querySelectorAll('tr')).map((row) =>
        Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent?.trim() ?? '')
      );
      if (rows.some((row) => row.some(Boolean))) blocks.push({ type: 'table', rows });
    } else {
      const text = element.textContent?.trim();
      if (text) blocks.push({ type: 'paragraph', text });
    }
  }

  if (blocks.length === 0) throw new Error('Dokumen Word tidak berisi teks atau tabel yang dapat dibaca.');
  const warnings = messages
    .filter((message) => message.type === 'warning')
    .map((message) => message.message);
  const embeddedImages = parsed.querySelectorAll('img').length;
  if (embeddedImages) warnings.push(`${embeddedImages} gambar di dalam Word tidak diekstrak; teks dan tabel tetap dikonversi.`);
  return { blocks, visualPages: [], warnings };
}

async function readSpreadsheet(file: File): Promise<ConversionContent> {
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const blocks: ContentBlock[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    }).map((row) => row.map((cell) => String(cell ?? '')));
    if (rows.length === 0) continue;
    blocks.push({ type: 'paragraph', text: sheetName });
    blocks.push({ type: 'table', rows });
  }
  if (blocks.length === 0) throw new Error('File spreadsheet tidak memiliki data yang dapat dibaca.');
  return { blocks, visualPages: [], warnings: [] };
}

function directChildren(element: Element, localName: string): Element[] {
  return Array.from(element.children).filter((child) => child.localName === localName);
}

async function readPowerPoint(file: File): Promise<ConversionContent> {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const fallbackSlideNames = Object.keys(archive.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));
  const presentationXml = await archive.file('ppt/presentation.xml')?.async('text');
  const relationshipXml = await archive.file('ppt/_rels/presentation.xml.rels')?.async('text');
  let slideNames = fallbackSlideNames;
  if (presentationXml && relationshipXml) {
    const presentation = new DOMParser().parseFromString(presentationXml, 'application/xml');
    const relationships = new DOMParser().parseFromString(relationshipXml, 'application/xml');
    const relationTargets = new Map(
      Array.from(relationships.getElementsByTagName('*'))
        .filter((element) => element.localName === 'Relationship')
        .map((element): [string, string] => [element.getAttribute('Id') ?? '', element.getAttribute('Target') ?? ''])
    );
    const relationshipNamespace = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const orderedNames = Array.from(presentation.getElementsByTagName('*'))
      .filter((element) => element.localName === 'sldId')
      .map((element) => {
        const relationId = element.getAttributeNS(relationshipNamespace, 'id') ?? element.getAttribute('r:id') ?? '';
        const target = relationTargets.get(relationId);
        if (!target) return '';
        return target.startsWith('/') ? target.slice(1) : `ppt/${target.replace(/^\.\//, '')}`;
      })
      .filter((name) => archive.file(name));
    if (orderedNames.length) slideNames = orderedNames;
  }
  if (slideNames.length === 0) throw new Error('Presentasi tidak memiliki slide yang dapat dibaca.');

  const blocks: ContentBlock[] = [];
  let skippedVisuals = 0;
  let extractedContent = false;
  for (let index = 0; index < slideNames.length; index += 1) {
    const slideXml = await archive.file(slideNames[index])?.async('text');
    if (!slideXml) continue;
    const parsed = new DOMParser().parseFromString(slideXml, 'application/xml');
    if (parsed.querySelector('parsererror')) throw new Error(`Slide ${index + 1} memiliki XML yang tidak valid.`);
    const tree = Array.from(parsed.getElementsByTagName('*')).find((element) => element.localName === 'spTree');
    if (!tree) continue;

    blocks.push({ type: 'paragraph', text: `Slide ${index + 1}` });
    for (const shape of Array.from(tree.children)) {
      if (shape.localName === 'pic') {
        skippedVisuals += 1;
        continue;
      }
      if (shape.localName === 'sp') {
        const paragraphs = Array.from(shape.getElementsByTagName('*'))
          .filter((element) => element.localName === 'p')
          .map(paragraphText)
          .filter(Boolean);
        extractedContent ||= paragraphs.length > 0;
        paragraphs.forEach((text) => blocks.push({ type: 'paragraph', text }));
      } else if (shape.localName === 'graphicFrame') {
        const table = Array.from(shape.getElementsByTagName('*')).find((element) => element.localName === 'tbl');
        if (!table) {
          skippedVisuals += 1;
          continue;
        }
        const rows = directChildren(table, 'tr').map((row) =>
          directChildren(row, 'tc').map(paragraphText)
        );
        if (rows.length) {
          extractedContent = true;
          blocks.push({ type: 'table', rows });
        }
      }
    }
  }

  if (!extractedContent) {
    throw new Error('Presentasi tidak berisi teks atau tabel yang dapat dibaca.');
  }
  return {
    blocks,
    visualPages: [],
    warnings: skippedVisuals ? [`${skippedVisuals} gambar atau objek visual di dalam PowerPoint tidak diekstrak; teks dan tabel tetap dikonversi.`] : [],
  };
}

async function readImage(file: File): Promise<ConversionContent> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Canvas tidak tersedia untuk membaca gambar.');
  }
  context.drawImage(bitmap, 0, 0);
  const visualPage = { dataUrl: canvas.toDataURL('image/png'), width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return { blocks: [], visualPages: [visualPage], warnings: [] };
}

async function readContent(file: File, format: ConversionFormat | 'image', includeVisualPages: boolean): Promise<ConversionContent> {
  if (format === 'pdf') return readPdf(file, includeVisualPages);
  if (format === 'docx') return readDocx(file);
  if (format === 'xlsx' || format === 'csv') return readSpreadsheet(file);
  if (format === 'pptx') return readPowerPoint(file);
  return readImage(file);
}

function blockRows(blocks: ContentBlock[]): string[][] {
  return blocks.flatMap((block) => block.type === 'table'
    ? block.rows
    : [[block.text]]);
}

function fitDimensions(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale };
}

function formatBlocks(blocks: ContentBlock[]): string[] {
  return blocks.flatMap((block) => block.type === 'table'
    ? block.rows.map((row) => row.join('    |    '))
    : [block.text]);
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function renderBlocksToPages(blocks: ContentBlock[]): VisualPage[] {
  const pages: VisualPage[] = [];
  const width = 1000;
  const height = 1414;
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | undefined;
  let y = 0;

  const startPage = () => {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const nextContext = canvas.getContext('2d');
    if (!nextContext) throw new Error('Canvas tidak tersedia untuk membuat pratinjau.');
    context = nextContext;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#172033';
    context.font = '22px Arial, sans-serif';
    y = 80;
  };
  const getContext = () => {
    if (!context) throw new Error('Canvas tidak tersedia untuk membuat pratinjau.');
    return context;
  };
  const savePage = () => {
    if (!canvas) throw new Error('Halaman visual belum siap.');
    pages.push({ dataUrl: canvas.toDataURL('image/png'), width, height });
  };
  const writeLine = (text: string) => {
    for (const line of wrapCanvasText(getContext(), text, width - 120)) {
      if (y > height - 70) {
        savePage();
        startPage();
      }
      getContext().fillText(line, 60, y);
      y += 34;
    }
  };

  startPage();
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      getContext().font = /^slide \d+$/i.test(block.text) ? 'bold 28px Arial, sans-serif' : '22px Arial, sans-serif';
      writeLine(block.text);
      y += 10;
    } else {
      getContext().font = 'bold 20px Arial, sans-serif';
      block.rows.forEach((row) => writeLine(row.join('   |   ')));
      getContext().font = '22px Arial, sans-serif';
      y += 18;
    }
  }
  savePage();
  return pages;
}

async function visualPagesFor(content: ConversionContent): Promise<VisualPage[]> {
  return content.visualPages.length ? content.visualPages : renderBlocksToPages(content.blocks);
}

async function createDocx(content: ConversionContent, mode: ConversionMode): Promise<Blob> {
  const children: (Paragraph | Table)[] = [];
  if (mode === 'visual') {
    const pages = await visualPagesFor(content);
    for (const page of pages) {
      const dimensions = fitDimensions(page.width, page.height, 480, 680);
      children.push(new Paragraph({
        children: [new ImageRun({
          type: 'png',
          data: dataUrlToBytes(page.dataUrl),
          transformation: dimensions,
        })],
      }));
    }
  } else {
    for (const block of content.blocks) {
      if (block.type === 'paragraph') {
        children.push(new Paragraph({ children: [new TextRun(block.text)] }));
      } else if (block.rows.length) {
        const columnCount = Math.max(...block.rows.map((row) => row.length));
        children.push(new Table({
          rows: block.rows.map((row, rowIndex) => new TableRow({
            children: Array.from({ length: columnCount }, (_, columnIndex) => new TableCell({
              children: [new Paragraph({
                children: [new TextRun({
                  text: row[columnIndex] ?? '',
                  bold: rowIndex === 0,
                })],
              })],
            })),
          })),
        }));
      }
    }
  }
  if (children.length === 0) throw new Error('Tidak ada konten yang dapat dimasukkan ke Word.');
  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

function createWorkbook(content: ConversionContent): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const tables = content.blocks.filter((block): block is Extract<ContentBlock, { type: 'table' }> => block.type === 'table');
  const paragraphs = content.blocks
    .filter((block): block is Extract<ContentBlock, { type: 'paragraph' }> => block.type === 'paragraph')
    .map((block) => [block.text]);
  if (paragraphs.length) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(paragraphs), 'Teks');
  }
  tables.forEach((table, index) => {
    const rows = table.rows.map((row) => row.map((cell) => String(cell ?? '')));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), `Data ${index + 1}`.slice(0, 31));
  });
  if (workbook.SheetNames.length === 0) throw new Error('Tidak ada teks atau tabel untuk dimasukkan ke Excel.');
  return workbook;
}

function createPptx(content: ConversionContent, mode: ConversionMode): Promise<ArrayBuffer> {
  const presentation = new PptxGenJS();
  presentation.layout = 'LAYOUT_WIDE';
  presentation.author = 'fatihworkingtools';
  const writePresentation = async () => {
    const output = await presentation.write({ outputType: 'arraybuffer' });
    if (output instanceof ArrayBuffer) return output;
    if (output instanceof Uint8Array) return arrayBufferOf(output);
    if (output instanceof Blob) return output.arrayBuffer();
    throw new Error('Format PowerPoint hasil tidak dikenali.');
  };
  if (mode === 'visual') {
    return visualPagesFor(content).then((pages) => {
      for (const page of pages) {
        const slide = presentation.addSlide();
        const dimensions = fitDimensions(page.width, page.height, 13.333, 7.5);
        slide.addImage({
          data: page.dataUrl,
          x: (13.333 - dimensions.width) / 2,
          y: (7.5 - dimensions.height) / 2,
          w: dimensions.width,
          h: dimensions.height,
        });
      }
      return writePresentation();
    });
  }

  const blocks = content.blocks;
  const tables = blocks.filter((block): block is Extract<ContentBlock, { type: 'table' }> => block.type === 'table');
  const paragraphs = blocks.filter((block): block is Extract<ContentBlock, { type: 'paragraph' }> => block.type === 'paragraph');
  if (tables.length === 0 && paragraphs.length === 0) throw new Error('Tidak ada konten untuk dimasukkan ke PowerPoint.');

  if (paragraphs.length) {
    for (let start = 0; start < paragraphs.length; start += 14) {
      const slide = presentation.addSlide();
      slide.addText(paragraphs.slice(start, start + 14).map((block) => block.text).join('\n'), {
        x: 0.7,
        y: 0.7,
        w: 12,
        h: 6,
        fontFace: 'Arial',
        fontSize: 20,
        breakLine: false,
        valign: 'top',
        margin: 0.15,
        color: '172033',
        fit: 'shrink',
      });
    }
  }
  for (const table of tables) {
    for (let start = 0; start < table.rows.length; start += 16) {
      const slide = presentation.addSlide();
      slide.addTable(table.rows.slice(start, start + 16).map((row, rowIndex) => row.map((text) => ({
        text,
        options: { bold: start === 0 && rowIndex === 0 },
      }))), {
        x: 0.5,
        y: 0.5,
        w: 12.3,
        h: 6.5,
        fontFace: 'Arial',
        fontSize: 12,
        border: { type: 'solid', color: 'D7DEEA', pt: 0.6 },
        color: '172033',
        margin: 0.06,
      });
    }
  }
  return writePresentation();
}

async function createPdf(content: ConversionContent, mode: ConversionMode): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const pageSize: [number, number] = [595.28, 841.89];

  if (mode === 'visual') {
    for (const imagePage of await visualPagesFor(content)) {
      const image = await pdf.embedPng(dataUrlToBytes(imagePage.dataUrl));
      const page = pdf.addPage(pageSize);
      const scale = Math.min((pageSize[0] - 48) / image.width, (pageSize[1] - 48) / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: (pageSize[0] - width) / 2,
        y: (pageSize[1] - height) / 2,
        width,
        height,
      });
    }
  } else {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    let page = pdf.addPage(pageSize);
    let y = pageSize[1] - 48;
    const fontSize = 10;
    const maxWidth = pageSize[0] - 96;
    const drawLine = (line: string) => {
      const words = line.split(/\s+/);
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
          if (y < 42) {
            page = pdf.addPage(pageSize);
            y = pageSize[1] - 48;
          }
          page.drawText(current, { x: 48, y, size: fontSize, font, color: rgb(0.1, 0.13, 0.2) });
          y -= 15;
          current = word;
        } else {
          current = candidate;
        }
      }
      if (current) {
        if (y < 42) {
          page = pdf.addPage(pageSize);
          y = pageSize[1] - 48;
        }
        page.drawText(current, { x: 48, y, size: fontSize, font, color: rgb(0.1, 0.13, 0.2) });
        y -= 15;
      }
    };
    for (const line of formatBlocks(content.blocks)) {
      drawLine(line);
      y -= 4;
    }
  }
  return new Blob([arrayBufferOf(await pdf.save())], { type: 'application/pdf' });
}

async function createPng(content: ConversionContent): Promise<{ blob: Blob; fileNameSuffix: string }> {
  const pages = await visualPagesFor(content);
  if (pages.length === 1) {
    return { blob: await (await fetch(pages[0].dataUrl)).blob(), fileNameSuffix: '.png' };
  }
  const archive = new JSZip();
  pages.forEach((page, index) => archive.file(`halaman_${index + 1}.png`, dataUrlToBytes(page.dataUrl)));
  return {
    blob: await archive.generateAsync({ type: 'blob' }),
    fileNameSuffix: '_gambar.zip',
  };
}

function outputFileName(file: File, format: ConversionFormat, suffix: string): string {
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return `${baseName}${suffix || `.${format}`}`;
}

export async function convertDocument(
  file: File,
  target: ConversionFormat,
  mode: ConversionMode,
): Promise<ConvertedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error('Ukuran maksimal file adalah 50 MB.');
  const source = getSourceFormat(file);
  const legacyExcelUpgrade = source === 'xlsx' && target === 'xlsx' && file.name.toLowerCase().endsWith('.xls');
  if (source === target && !legacyExcelUpgrade) throw new Error('Format sumber dan hasil harus berbeda.');
  if (source === 'image' && (target === 'xlsx' || target === 'csv')) {
    throw new Error('Gambar ke Excel/CSV memerlukan OCR, yang sedang dinonaktifkan.');
  }
  if (source === 'image' && mode === 'editable') {
    throw new Error('Gambar hanya bisa dikonversi dalam mode visual karena OCR dinonaktifkan.');
  }

  const wantsVisualPages = mode === 'visual' || target === 'png';
  const content = await readContent(file, source, wantsVisualPages);
  let blob: Blob;
  let fileNameSuffix = '';

  if (target === 'docx') {
    blob = await createDocx(content, mode);
  } else if (target === 'xlsx') {
    const workbook = createWorkbook(content);
    blob = new Blob([arrayBufferOf(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }))], { type: EXCEL_MIME });
  } else if (target === 'csv') {
    const rows = blockRows(content.blocks).map((row) => row.map((cell) => sanitizeSpreadsheetCell(String(cell ?? ''))));
    if (!rows.length) throw new Error('Tidak ada teks atau tabel yang bisa disimpan ke CSV.');
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    blob = new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: 'text/csv;charset=utf-8' });
    if (content.blocks.filter((block) => block.type === 'table').length > 1) {
      content.warnings.push('CSV hanya mendukung satu tabel; tabel dari setiap bagian digabungkan berurutan.');
    }
  } else if (target === 'pptx') {
    blob = new Blob([await createPptx(content, mode)], { type: POWERPOINT_MIME });
  } else if (target === 'pdf') {
    blob = await createPdf(content, mode);
  } else {
    const output = await createPng(content);
    blob = output.blob;
    fileNameSuffix = output.fileNameSuffix;
  }

  return {
    blob,
    fileName: outputFileName(file, target, fileNameSuffix),
    warnings: content.warnings,
  };
}

export function detectConversionSource(file: File): ConversionFormat | 'image' {
  return getSourceFormat(file);
}
