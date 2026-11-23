import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 250_000;
const MAX_COLUMNS = 500;
const MAX_CELLS = 5_000_000;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}

function makeUniqueHeaders(values: unknown[]): string[] {
  const seen = new Map<string, number>();
  return values.map((value, index) => {
    const base = cellText(value).trim() || `Kolom ${index + 1}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return occurrence === 1 ? base : `${base} (${occurrence})`;
  });
}

export async function readTableFile(file: File): Promise<TableData> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name}: ukuran maksimal file data adalah 50 MB.`);
  }

  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  let matrix: unknown[][];

  if (isCsv) {
    const text = await file.text();
    const parsed = Papa.parse<string[]>(text, {
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      preview: MAX_ROWS + 2,
    });
    if (parsed.errors.length) {
      throw new Error(`${file.name}: ${parsed.errors[0].message}`);
    }
    if (parsed.data.length > MAX_ROWS + 1) {
      throw new Error(`${file.name}: batas aman adalah ${MAX_ROWS.toLocaleString()} baris.`);
    }
    matrix = parsed.data;
  } else if (/\.(xlsx|xls)$/i.test(file.name)) {
    const workbook = XLSX.read(await file.arrayBuffer(), {
      cellDates: true,
      sheetRows: MAX_ROWS + 1,
    });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error(`${file.name}: workbook tidak memiliki sheet.`);
    const sourceRange = firstSheet['!fullref'] ?? firstSheet['!ref'];
    if (sourceRange && XLSX.utils.decode_range(sourceRange).e.r >= MAX_ROWS + 1) {
      throw new Error(`${file.name}: batas aman adalah ${MAX_ROWS.toLocaleString()} baris.`);
    }
    matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });
  } else {
    throw new Error(`${file.name}: format tidak didukung. Pilih CSV, XLS, atau XLSX.`);
  }

  if (matrix.length === 0) throw new Error(`${file.name}: file kosong.`);
  const headers = makeUniqueHeaders(matrix[0]);
  if (headers.length > MAX_COLUMNS) {
    throw new Error(`${file.name}: batas aman adalah ${MAX_COLUMNS} kolom.`);
  }
  if (headers.length * Math.max(0, matrix.length - 1) > MAX_CELLS) {
    throw new Error(`${file.name}: jumlah sel melebihi batas aman ${MAX_CELLS.toLocaleString()}.`);
  }
  const rows = matrix.slice(1).map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cellText(cells[index])]))
  );
  return { headers, rows };
}

export function sanitizeSpreadsheetCell(value: string): string {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function toTransferableBuffer(bytes: Uint8Array | ArrayBuffer): ArrayBuffer {
  if (bytes instanceof ArrayBuffer) return bytes;
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
