import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';

interface ImageJobMessage {
  files: File[];
  format: 'image/jpeg' | 'image/png' | 'image/webp';
  maxDimension: number;
  quality: number;
  watermarkText: string;
  watermarkLogo: File | null;
}

function safeName(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) || 'image';
}

self.onmessage = async (event: MessageEvent<ImageJobMessage>) => {
  const { files, format, maxDimension, quality, watermarkText, watermarkLogo } = event.data;
  const zip = new JSZip();
  let logoBitmap: ImageBitmap | null = null;
  try {
    if (!files.length) throw new Error('Pilih setidaknya satu gambar.');
    if (files.length > 100) throw new Error('Maksimal 100 gambar per batch.');
    if (files.some((file) => file.size > 50 * 1024 * 1024)) {
      throw new Error('Maksimal ukuran setiap gambar adalah 50 MB.');
    }
    if (watermarkLogo && watermarkLogo.size > 50 * 1024 * 1024) {
      throw new Error('Ukuran maksimal logo watermark adalah 50 MB.');
    }
    if (files.reduce((total, file) => total + file.size, watermarkLogo?.size ?? 0) > 500 * 1024 * 1024) {
      throw new Error('Total ukuran gambar dan logo maksimal 500 MB per batch.');
    }
    if (watermarkLogo) logoBitmap = await createImageBitmap(watermarkLogo);
    const extension = format === 'image/jpeg' ? 'jpg' : format === 'image/png' ? 'png' : 'webp';

    for (let index = 0; index < files.length; index += 1) {
      const source = files[index];
      if (!source.type.startsWith('image/')) {
        throw new Error(`${source.name}: file bukan gambar yang didukung.`);
      }

      const compressed = await imageCompression(source, {
        useWebWorker: false,
        maxWidthOrHeight: maxDimension,
        maxSizeMB: 50,
        maxIteration: 8,
        initialQuality: quality,
        fileType: format,
        preserveExif: false,
        onProgress: (progress) => {
          self.postMessage({
            type: 'progress',
            current: index,
            total: files.length,
            detail: `Mengoptimalkan ${source.name} (${Math.round(progress)}%)`,
          });
        },
      });

      const bitmap = await createImageBitmap(compressed);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Browser tidak menyediakan OffscreenCanvas 2D.');
        if (format === 'image/jpeg') {
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(bitmap, 0, 0);

        if (watermarkText.trim()) {
          const fontSize = Math.max(18, Math.round(canvas.width * 0.035));
          context.save();
          context.globalAlpha = 0.62;
          context.fillStyle = '#ffffff';
          context.strokeStyle = '#111827';
          context.lineWidth = Math.max(2, fontSize * 0.08);
          context.font = `600 ${fontSize}px system-ui, sans-serif`;
          context.textAlign = 'right';
          context.textBaseline = 'bottom';
          const text = watermarkText.trim().slice(0, 120);
          const x = canvas.width - fontSize * 0.65;
          const y = canvas.height - fontSize * 0.65;
          context.strokeText(text, x, y);
          context.fillText(text, x, y);
          context.restore();
        }

        if (logoBitmap) {
          const maxWidth = canvas.width * 0.2;
          const scale = Math.min(maxWidth / logoBitmap.width, 1);
          const width = logoBitmap.width * scale;
          const height = logoBitmap.height * scale;
          context.globalAlpha = 0.85;
          context.drawImage(logoBitmap, canvas.width - width - 18, 18, width, height);
        }

        const output = await canvas.convertToBlob({
          type: format,
          quality: format === 'image/png' ? undefined : quality,
        });
        zip.file(`${String(index + 1).padStart(3, '0')}_${safeName(source.name)}.${extension}`, output);
      } finally {
        bitmap.close();
        canvas.width = 0;
        canvas.height = 0;
      }

      self.postMessage({
        type: 'progress',
        current: index + 1,
        total: files.length,
        detail: `Selesai ${source.name}`,
      });
    }

    logoBitmap?.close();
    const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'STORE' });
    self.postMessage(
      {
        type: 'done',
        total: files.length,
        outputs: [{ name: 'gambar_optimized.zip', mimeType: 'application/zip', buffer }],
      },
      { transfer: [buffer] }
    );
  } catch (error) {
    logoBitmap?.close();
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Optimasi gambar gagal.',
    });
  }
};
