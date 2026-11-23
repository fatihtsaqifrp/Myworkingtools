// Watermark, Page Numbering, and Page Editing Engine
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';

function hexToRgb(hex: string) {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;
  return rgb(r, g, b);
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'process_watermark') {
    const { fileBuffer, options } = msg;

    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const pages = pdfDoc.getPages();
      const totalPages = pages.length;
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (let i = 0; i < totalPages; i++) {
        const page = pages[i];
        const { width, height } = page.getSize();
        const pageNumber = i + 1;

        // 1. Text Watermark
        if (options.text && options.text.trim()) {
          const fontSize = options.fontSize || 42;
          const textWidth = font.widthOfTextAtSize(options.text, fontSize);
          const textHeight = font.heightAtSize(fontSize);
          const textColor = hexToRgb(options.color || '#64748b');
          const opacity = Math.max(0.05, Math.min(options.opacity || 0.25, 1));
          const rotationAngle = options.rotation !== undefined ? options.rotation : 45;

          let x = (width - textWidth) / 2;
          let y = (height - textHeight) / 2;

          if (typeof options.textX === 'number' && typeof options.textY === 'number') {
            x = (options.textX / 100) * width - textWidth / 2;
            y = height - (options.textY / 100) * height - textHeight / 2;
          } else if (options.position === 'top') {
            y = height - textHeight - 40;
          } else if (options.position === 'bottom') {
            y = 40;
          }

          page.drawText(options.text, {
            x,
            y,
            size: fontSize,
            font,
            color: textColor,
            opacity,
            rotate: degrees(rotationAngle),
          });
        }

        // 2. Automatic Page Numbers
        if (options.enablePageNumbers) {
          const pFormat = options.pageNumberFormat || '{n} / {total}';
          const pText = pFormat
            .replace('{n}', String(pageNumber))
            .replace('{total}', String(totalPages));

          const pFontSize = 10;
          const pTextWidth = normalFont.widthOfTextAtSize(pText, pFontSize);
          const margin = 24;

          let px = (width - pTextWidth) / 2;
          let py = margin;

          if (typeof options.pageNumberX === 'number' && typeof options.pageNumberY === 'number') {
            px = (options.pageNumberX / 100) * width - pTextWidth / 2;
            py = height - (options.pageNumberY / 100) * height - pFontSize / 2;
          } else if (options.pageNumberPosition === 'bottom-right') {
            px = width - pTextWidth - margin;
            py = margin;
          } else if (options.pageNumberPosition === 'top-right') {
            px = width - pTextWidth - margin;
            py = height - margin - 10;
          }

          page.drawText(pText, {
            x: px,
            y: py,
            size: pFontSize,
            font: normalFont,
            color: rgb(0.2, 0.2, 0.2),
            opacity: 0.85,
          });
        }

        self.postMessage({
          type: 'progress',
          current: pageNumber,
          total: totalPages,
          detail: `Memproses halaman ${pageNumber} dari ${totalPages}...`,
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const finalBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      ) as ArrayBuffer;

      (postMessage as (message: any, transfer?: Transferable[]) => void)(
        {
          type: 'done',
          pdfBuffer: finalBuffer,
          totalPages,
        },
        [finalBuffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal memproses watermark / nomor halaman',
      });
    }
  }

  // Page reordering, rotation, deletion
  if (msg.type === 'organize_pages') {
    const { fileBuffers, pageConfig } = msg as {
      type: 'organize_pages';
      fileBuffers: ArrayBuffer[];
      pageConfig: {
        originalPageNumber: number;
        sourceFileIndex?: number;
        rotation: number;
        deleted?: boolean;
      }[];
    };

    try {
      const sourceDocs = await Promise.all(fileBuffers.map((fileBuffer) =>
        PDFDocument.load(fileBuffer, {
          ignoreEncryption: true,
          updateMetadata: false,
        })
      ));
      const newDoc = await PDFDocument.create();
      const activePages = pageConfig.filter((p) => !p.deleted);

      for (let i = 0; i < activePages.length; i++) {
        const item = activePages[i];
        const sourceDoc = sourceDocs[item.sourceFileIndex ?? 0];
        if (!sourceDoc) throw new Error('Sumber halaman tidak ditemukan.');
        const originalIndex = item.originalPageNumber - 1;
        if (originalIndex < 0 || originalIndex >= sourceDoc.getPageCount()) {
          throw new Error(`Halaman ${item.originalPageNumber} tidak tersedia.`);
        }

        const [copiedPage] = await newDoc.copyPages(sourceDoc, [originalIndex]);
        if (item.rotation) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees((currentRotation + item.rotation) % 360));
        }
        newDoc.addPage(copiedPage);

        self.postMessage({
          type: 'progress',
          current: i + 1,
          total: activePages.length,
          detail: `Menyusun halaman ${i + 1} dari ${activePages.length}...`,
        });
      }

      const pdfBytes = await newDoc.save({ useObjectStreams: false });
      const finalBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      ) as ArrayBuffer;

      (postMessage as (message: any, transfer?: Transferable[]) => void)(
        {
          type: 'done',
          pdfBuffer: finalBuffer,
          totalPages: activePages.length,
        },
        [finalBuffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal menyusun halaman',
      });
    }
  }

  // Stamp / Signature application onto specific page
  if (msg.type === 'apply_stamp') {
    const { fileBuffer, stamp } = msg;

    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const pageIndex = Math.max(0, Math.min(stamp.pageNumber - 1, pdfDoc.getPageCount() - 1));
      const page = pdfDoc.getPage(pageIndex);
      const { width: pageWidth, height: pageHeight } = page.getSize();

      if (stamp.dataUrl) {
        // Convert base64 dataUrl to bytes
        const base64Data = stamp.dataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const pngImage = await pdfDoc.embedPng(bytes);

        // Position is the page-relative center; dimensions are page-relative percentages.
        const drawW = (stamp.width / 100) * pageWidth;
        const drawH = (stamp.height / 100) * pageHeight;
        const posX = (stamp.x / 100) * pageWidth - drawW / 2;
        // In PDF coordinates, (0,0) is bottom-left; UI coordinates mark the stamp center.
        const posY = pageHeight - (stamp.y / 100) * pageHeight - drawH / 2;

        page.drawImage(pngImage, {
          x: posX,
          y: posY,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const finalBuffer = pdfBytes.buffer.slice(
        pdfBytes.byteOffset,
        pdfBytes.byteOffset + pdfBytes.byteLength
      ) as ArrayBuffer;

      (postMessage as (message: any, transfer?: Transferable[]) => void)(
        {
          type: 'done',
          pdfBuffer: finalBuffer,
          totalPages: pdfDoc.getPageCount(),
        },
        [finalBuffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal membubuhkan tanda tangan / stempel',
      });
    }
  }
};
