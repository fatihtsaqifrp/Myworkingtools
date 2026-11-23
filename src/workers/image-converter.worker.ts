// Images to PDF and PDF packaging worker
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

let isCancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'cancel') {
    isCancelled = true;
    self.postMessage({ type: 'cancelled' });
    return;
  }

  // Convert multiple image files into 1 PDF
  if (msg.type === 'images_to_pdf') {
    isCancelled = false;
    const { images, pageSize, margin } = msg as {
      type: 'images_to_pdf';
      images: { name: string; file: File; mimeType: string }[];
      pageSize: 'fit' | 'a4';
      margin: number;
    };

    try {
      const pdfDoc = await PDFDocument.create();
      const total = images.length;

      for (let i = 0; i < total; i++) {
        if (isCancelled) {
          self.postMessage({ type: 'cancelled' });
          return;
        }

        const img = images[i];
        self.postMessage({
          type: 'progress',
          current: i + 1,
          total,
          detail: `Menyematkan gambar ${img.name} (${i + 1}/${total})...`,
        });

        const mimeType = img.mimeType.toLowerCase();
        const isPng = mimeType.includes('png') || img.name.toLowerCase().endsWith('.png');
        const isJpeg = mimeType.includes('jpeg') || mimeType.includes('jpg') || /\.(jpe?g)$/i.test(img.name);
        let embeddedImage;

        if (isPng) {
          embeddedImage = await pdfDoc.embedPng(await img.file.arrayBuffer());
        } else if (isJpeg) {
          embeddedImage = await pdfDoc.embedJpg(await img.file.arrayBuffer());
        } else {
          const bitmap = await createImageBitmap(img.file);
          const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
          try {
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Canvas 2D context tidak tersedia untuk konversi gambar');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0);
            const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
            embeddedImage = await pdfDoc.embedJpg(await jpegBlob.arrayBuffer());
          } finally {
            bitmap.close();
            canvas.width = 0;
            canvas.height = 0;
          }
        }

        const imgDims = embeddedImage.scale(1.0);

        if (pageSize === 'a4') {
          // Standard A4: 595.28 x 841.89 points
          const a4Width = 595.28;
          const a4Height = 841.89;
          const page = pdfDoc.addPage([a4Width, a4Height]);

          const availWidth = a4Width - margin * 2;
          const availHeight = a4Height - margin * 2;
          const scale = Math.min(availWidth / imgDims.width, availHeight / imgDims.height, 1);

          const drawWidth = imgDims.width * scale;
          const drawHeight = imgDims.height * scale;
          const x = (a4Width - drawWidth) / 2;
          const y = (a4Height - drawHeight) / 2;

          page.drawImage(embeddedImage, {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
          });
        } else {
          // Fit page to image size
          const page = pdfDoc.addPage([imgDims.width + margin * 2, imgDims.height + margin * 2]);
          page.drawImage(embeddedImage, {
            x: margin,
            y: margin,
            width: imgDims.width,
            height: imgDims.height,
          });
        }

        // Dereference buffer
        images[i] = null as never;

        if ((i + 1) % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
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
          totalPages: total,
        },
        [finalBuffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal mengubah gambar ke PDF',
      });
    }
    return;
  }

  // Package multiple image blobs into a ZIP file
  if (msg.type === 'package_images_zip') {
    isCancelled = false;
    const { imageBlobs, baseName } = msg as {
      type: 'package_images_zip';
      imageBlobs: { name: string; buffer: ArrayBuffer }[];
      baseName: string;
    };

    try {
      const zip = new JSZip();
      const cleanBase = baseName.replace(/\.pdf$/i, '');

      for (let i = 0; i < imageBlobs.length; i++) {
        const item = imageBlobs[i];
        zip.file(`${cleanBase}_${item.name}`, item.buffer);
      }

      const zipBuffer = await zip.generateAsync(
        {
          type: 'arraybuffer',
          compression: 'STORE',
        },
        (meta) => {
          self.postMessage({
            type: 'progress',
            current: Math.round(meta.percent),
            total: 100,
            detail: `Menyusun arsip ZIP (${meta.percent.toFixed(0)}%)...`,
          });
        }
      );

      (postMessage as (message: any, transfer?: Transferable[]) => void)(
        {
          type: 'done_zip',
          zipBuffer,
        },
        [zipBuffer]
      );
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : 'Gagal menyusun arsip ZIP gambar',
      });
    }
  }
};
