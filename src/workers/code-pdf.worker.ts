import { PDFDocument, rgb } from 'pdf-lib';

interface CodeAsset {
  label: string;
  image: Blob;
}

self.onmessage = async (event: MessageEvent<{ entries: CodeAsset[] }>) => {
  try {
    const { entries } = event.data;
    if (!entries.length) throw new Error('Tidak ada kode untuk dicetak.');
    if (entries.length > 500) throw new Error('Maksimal 500 kode per PDF.');

    const pdf = await PDFDocument.create();
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 30;
    const columns = 2;
    const rows = 4;
    const cellWidth = (pageWidth - margin * 2) / columns;
    const cellHeight = (pageHeight - margin * 2) / rows;

    for (let index = 0; index < entries.length; index += 1) {
      if (index % (columns * rows) === 0) pdf.addPage([pageWidth, pageHeight]);
      const page = pdf.getPage(pdf.getPageCount() - 1);
      const slot = index % (columns * rows);
      const col = slot % columns;
      const row = Math.floor(slot / columns);
      const x = margin + col * cellWidth;
      const y = pageHeight - margin - (row + 1) * cellHeight;

      const bitmap = await createImageBitmap(entries[index].image);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      let pngBytes: ArrayBuffer;
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas tidak tersedia untuk menyusun kode.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, 0, 0);
        pngBytes = await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer();
      } finally {
        bitmap.close();
        canvas.width = 0;
        canvas.height = 0;
      }

      const image = await pdf.embedPng(pngBytes);
      const maxWidth = cellWidth - 28;
      const maxHeight = cellHeight - 55;
      const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, {
        x: x + (cellWidth - width) / 2,
        y: y + 34 + (maxHeight - height) / 2,
        width,
        height,
      });

      const label = entries[index].label.slice(0, 120);
      const labelCanvas = new OffscreenCanvas(900, 90);
      const labelContext = labelCanvas.getContext('2d');
      if (!labelContext) throw new Error('Canvas tidak tersedia untuk merender label.');
      labelContext.fillStyle = '#ffffff';
      labelContext.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
      labelContext.fillStyle = '#1f2937';
      labelContext.font = '28px system-ui, sans-serif';
      labelContext.textAlign = 'center';
      labelContext.textBaseline = 'middle';
      let displayLabel = label;
      while (displayLabel && labelContext.measureText(displayLabel).width > labelCanvas.width - 24) {
        displayLabel = `${displayLabel.slice(0, -2)}…`;
      }
      labelContext.fillText(displayLabel, labelCanvas.width / 2, labelCanvas.height / 2);
      const labelBytes = new Uint8Array(await (await labelCanvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
      labelCanvas.width = 0;
      labelCanvas.height = 0;
      const labelImage = await pdf.embedPng(labelBytes);
      page.drawImage(labelImage, {
        x: x + 12,
        y: y + 8,
        width: cellWidth - 24,
        height: 24,
      });
      page.drawRectangle({
        x: x + 5,
        y: y + 5,
        width: cellWidth - 10,
        height: cellHeight - 10,
        borderColor: rgb(0.88, 0.9, 0.93),
        borderWidth: 0.6,
      });

      self.postMessage({
        type: 'progress',
        current: index + 1,
        total: entries.length,
        detail: `Menyusun kode ${index + 1} dari ${entries.length}`,
      });
    }

    const bytes = await pdf.save();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    self.postMessage(
      {
        type: 'done',
        total: entries.length,
        outputs: [{ name: 'kode_qr_barcode.pdf', mimeType: 'application/pdf', buffer }],
      },
      { transfer: [buffer] }
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'PDF kode gagal dibuat.',
    });
  }
};
