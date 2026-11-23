import { PDFDocument } from 'pdf-lib';

interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

self.onmessage = async (event: MessageEvent<{ fileBuffer: ArrayBuffer; margins: CropMargins }>) => {
  try {
    const { fileBuffer, margins } = event.data;
    const pdf = await PDFDocument.load(fileBuffer, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const pages = pdf.getPages();
    if (!pages.length) throw new Error('PDF tidak memiliki halaman.');

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index];
      const mediaBox = page.getMediaBox();
      const left = mediaBox.width * (margins.left / 100);
      const right = mediaBox.width * (margins.right / 100);
      const top = mediaBox.height * (margins.top / 100);
      const bottom = mediaBox.height * (margins.bottom / 100);
      const width = mediaBox.width - left - right;
      const height = mediaBox.height - top - bottom;
      if (width <= 0 || height <= 0) {
        throw new Error(`Area crop halaman ${index + 1} tidak valid. Kurangi nilai margin.`);
      }

      page.setCropBox(mediaBox.x + left, mediaBox.y + bottom, width, height);
      self.postMessage({
        type: 'progress',
        current: index + 1,
        total: pages.length,
        detail: `Memotong halaman ${index + 1} dari ${pages.length}`,
      });
    }

    const bytes = await pdf.save({ useObjectStreams: false });
    const pdfBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    (postMessage as (message: unknown, transfer?: Transferable[]) => void)(
      { type: 'done', pdfBuffer, totalPages: pages.length },
      [pdfBuffer]
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Gagal memotong area PDF.',
    });
  }
};
