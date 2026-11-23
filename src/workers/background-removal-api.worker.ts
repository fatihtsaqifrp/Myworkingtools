interface BackgroundRemovalRequest {
  files: File[];
}

self.onmessage = async (event: MessageEvent<BackgroundRemovalRequest>) => {
  const { files } = event.data;
  try {
    if (!files.length) throw new Error('Pilih setidaknya satu foto.');
    if (files.length > 100) throw new Error('Maksimal 100 gambar per batch.');
    if (files.some((file) => file.size > 20 * 1024 * 1024)) {
      throw new Error('Ukuran maksimum setiap gambar adalah 20 MB.');
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      throw new Error('Semua file harus berupa gambar.');
    }

    const outputs: { name: string; mimeType: string; buffer: ArrayBuffer }[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      self.postMessage({
        type: 'progress', current: index, total: files.length,
        detail: `Menghapus latar ${index + 1}/${files.length}: ${file.name}`,
      });
      const form = new FormData();
      form.append('file', file, file.name);
      let response: Response;
      try {
        response = await fetch('/api/remove-background', { method: 'POST', body: form });
      } catch {
        throw new Error('Tidak dapat menghubungi layanan. Periksa koneksi lalu coba lagi.');
      }
      if (!response.ok) {
        let message = `Gagal memproses ${file.name} (HTTP ${response.status}).`;
        try {
          const result = await response.json() as { error?: unknown };
          if (typeof result.error === 'string') message = `${file.name}: ${result.error}`;
        } catch { /* Keep the useful HTTP status message. */ }
        throw new Error(message);
      }
      const buffer = await response.arrayBuffer();
      if (!buffer.byteLength || !response.headers.get('content-type')?.includes('image/png')) {
        throw new Error(`Layanan mengirim hasil yang tidak valid untuk ${file.name}.`);
      }
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'image';
      outputs.push({ name: `${baseName}-tanpa-latar.png`, mimeType: 'image/png', buffer });
      self.postMessage({
        type: 'progress', current: index + 1, total: files.length,
        detail: `Selesai ${index + 1}/${files.length}: ${file.name}`,
      });
    }
    const transfer = outputs.map((output) => output.buffer);
    self.postMessage({ type: 'done', current: files.length, total: files.length, outputs }, { transfer });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Penghapusan latar gagal.',
    });
  }
};
