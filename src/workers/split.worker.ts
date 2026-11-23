// Batch Split Worker with JSZip packaging
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

let isCancelled = false;

interface SplitRange {
  start: number; // 0-based
  end: number;   // 0-based inclusive
  label: string;
}

function parseRanges(rangeStr: string, totalPages: number): SplitRange[] {
  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);
  const ranges: SplitRange[] = [];

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const s = parseInt(startStr, 10);
      const e = parseInt(endStr, 10);
      if (!isNaN(s) && !isNaN(e)) {
        const start = Math.max(0, Math.min(s - 1, totalPages - 1));
        const end = Math.max(0, Math.min(e - 1, totalPages - 1));
        if (start <= end) {
          ranges.push({ start, end, label: `hal_${start + 1}-${end + 1}` });
        }
      }
    } else {
      const p = parseInt(part, 10);
      if (!isNaN(p)) {
        const idx = Math.max(0, Math.min(p - 1, totalPages - 1));
        ranges.push({ start: idx, end: idx, label: `hal_${idx + 1}` });
      }
    }
  }

  return ranges;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    isCancelled = true;
    self.postMessage({ type: 'cancelled' });
    return;
  }

  if (msg.type === 'start_split') {
    isCancelled = false;
    const { fileBuffer, baseName, mode, rangeString, fixedPageCount } = msg;

    try {
      const srcDoc = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      const totalPages = srcDoc.getPageCount();
      if (totalPages === 0) {
        throw new Error('PDF tidak memiliki halaman');
      }

      const ranges: SplitRange[] = [];

      if (mode === 'all') {
        for (let i = 0; i < totalPages; i++) {
          ranges.push({ start: i, end: i, label: `halaman_${i + 1}` });
        }
      } else if (mode === 'fixed') {
        const step = Math.max(1, fixedPageCount || 1);
        for (let i = 0; i < totalPages; i += step) {
          const end = Math.min(i + step - 1, totalPages - 1);
          ranges.push({ start: i, end, label: `hal_${i + 1}-${end + 1}` });
        }
      } else {
        // range mode
        const parsed = parseRanges(rangeString || `1-${totalPages}`, totalPages);
        if (parsed.length === 0) {
          throw new Error('Rentang halaman tidak valid');
        }
        ranges.push(...parsed);
      }

      const zip = new JSZip();
      const totalParts = ranges.length;

      for (let i = 0; i < totalParts; i++) {
        if (isCancelled) {
          self.postMessage({ type: 'cancelled' });
          return;
        }

        const r = ranges[i];
        self.postMessage({
          type: 'progress',
          current: i + 1,
          total: totalParts,
          detail: `Mengekstrak ${r.label} (${i + 1} dari ${totalParts})...`,
        });

        const newDoc = await PDFDocument.create();
        const pageIndices: number[] = [];
        for (let p = r.start; p <= r.end; p++) {
          pageIndices.push(p);
        }

        const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
        for (const page of copiedPages) {
          newDoc.addPage(page);
        }

        const pdfBytes = await newDoc.save({ useObjectStreams: false });
        const cleanBaseName = baseName.replace(/\.pdf$/i, '');
        const outFileName = `${cleanBaseName}_${r.label}.pdf`;

        zip.file(outFileName, pdfBytes);

        // Yield for GC
        if ((i + 1) % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      self.postMessage({
        type: 'status_update',
        message: 'Mengompresi arsip ZIP...',
      });

      const zipBuffer = await zip.generateAsync(
        {
          type: 'arraybuffer',
          compression: 'DEFLATE',
          compressionOptions: { level: 1 },
        },
        (meta) => {
          self.postMessage({
            type: 'progress',
            current: Math.round(meta.percent),
            total: 100,
            detail: `Menyusun ZIP (${meta.percent.toFixed(0)}%)...`,
          });
        }
      );

      (postMessage as (message: any, transfer?: Transferable[]) => void)(
        {
          type: 'done',
          zipBuffer,
          totalFiles: totalParts,
          totalPages,
        },
        [zipBuffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal memisahkan file PDF',
      });
    }
  }
};

