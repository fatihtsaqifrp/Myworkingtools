import { env, pipeline, type RawImage } from '@huggingface/transformers';
import wasmModuleUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url';
import wasmBinaryUrl from 'onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url';

interface BackgroundRemovalRequest {
  files: File[];
  edgeThreshold: number;
}

env.useBrowserCache = true;
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = {
    mjs: wasmModuleUrl,
    wasm: wasmBinaryUrl,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Penghapusan latar gagal.';
}

function removeMatteIslands(data: Uint8Array | Uint8ClampedArray, width: number, height: number, threshold: number) {
  const scale = Math.min(1, 512 / Math.max(width, height));
  const gridWidth = Math.max(1, Math.round(width * scale));
  const gridHeight = Math.max(1, Math.round(height * scale));
  const cellCount = gridWidth * gridHeight;
  const foreground = new Uint8Array(cellCount);
  const labels = new Int32Array(cellCount);
  const queue = new Int32Array(cellCount);

  for (let y = 0; y < gridHeight; y += 1) {
    for (let x = 0; x < gridWidth; x += 1) {
      const sourceX = Math.min(width - 1, Math.floor((x + 0.5) * width / gridWidth));
      const sourceY = Math.min(height - 1, Math.floor((y + 0.5) * height / gridHeight));
      foreground[y * gridWidth + x] = data[(sourceY * width + sourceX) * 4 + 3] >= threshold ? 1 : 0;
    }
  }

  let largestLabel = 0;
  let largestSize = 0;
  let nextLabel = 0;
  const componentSizes = [0];
  for (let start = 0; start < cellCount; start += 1) {
    if (!foreground[start] || labels[start]) continue;
    nextLabel += 1;
    let head = 0;
    let tail = 0;
    let size = 0;
    queue[tail++] = start;
    labels[start] = nextLabel;
    while (head < tail) {
      const current = queue[head++];
      const x = current % gridWidth;
      size += 1;
      const neighbors = [x > 0 ? current - 1 : -1, x + 1 < gridWidth ? current + 1 : -1, current >= gridWidth ? current - gridWidth : -1, current + gridWidth < cellCount ? current + gridWidth : -1];
      for (let index = 0; index < neighbors.length; index += 1) {
        const neighbor = neighbors[index];
        if (neighbor >= 0 && foreground[neighbor] && !labels[neighbor]) {
          labels[neighbor] = nextLabel;
          queue[tail++] = neighbor;
        }
      }
    }
    componentSizes[nextLabel] = size;
    if (size > largestSize) {
      largestSize = size;
      largestLabel = nextLabel;
    }
  }

  if (!largestLabel) return;
  const minComponentSize = Math.max(12, Math.ceil(cellCount * 0.0001));
  for (let index = 0; index < cellCount; index += 1) {
    const label = labels[index];
    foreground[index] = label === largestLabel || componentSizes[label] >= minComponentSize ? 1 : 0;
  }

  const exterior = new Uint8Array(cellCount);
  let head = 0;
  let tail = 0;
  const addExterior = (index: number) => {
    if (!foreground[index] && !exterior[index]) {
      exterior[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < gridWidth; x += 1) {
    addExterior(x);
    addExterior((gridHeight - 1) * gridWidth + x);
  }
  for (let y = 0; y < gridHeight; y += 1) {
    addExterior(y * gridWidth);
    addExterior(y * gridWidth + gridWidth - 1);
  }
  while (head < tail) {
    const current = queue[head++];
    const x = current % gridWidth;
    const neighbors = [x > 0 ? current - 1 : -1, x + 1 < gridWidth ? current + 1 : -1, current >= gridWidth ? current - gridWidth : -1, current + gridWidth < cellCount ? current + gridWidth : -1];
    for (let index = 0; index < neighbors.length; index += 1) {
      const neighbor = neighbors[index];
      if (neighbor >= 0 && !foreground[neighbor] && !exterior[neighbor]) {
        exterior[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    const gridY = Math.min(gridHeight - 1, Math.floor(y * gridHeight / height));
    for (let x = 0; x < width; x += 1) {
      const gridX = Math.min(gridWidth - 1, Math.floor(x * gridWidth / width));
      const gridIndex = gridY * gridWidth + gridX;
      if (!foreground[gridIndex] && exterior[gridIndex]) {
        data[(y * width + x) * 4 + 3] = 0;
      }
    }
  }
}

async function createRefinedPng(result: RawImage, bitmap: ImageBitmap, edgeThreshold: number): Promise<Blob> {
  const rgba = result.rgba();
  const { width, height } = rgba;
  const scale = Math.min(1, 1024 / Math.max(width, height));
  const guideWidth = Math.max(1, Math.round(width * scale));
  const guideHeight = Math.max(1, Math.round(height * scale));
  const guideCanvas = new OffscreenCanvas(guideWidth, guideHeight);
  const guideContext = guideCanvas.getContext('2d', { willReadFrequently: true });
  if (!guideContext) throw new Error('Tidak dapat menyiapkan panduan tepi.');
  guideContext.drawImage(bitmap, 0, 0, guideWidth, guideHeight);
  const guide = guideContext.getImageData(0, 0, guideWidth, guideHeight).data;
  const { data } = rgba;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      const alpha = data[offset + 3];
      if (alpha < 8 || alpha > 247) continue;

      const guideX = Math.floor(x * guideWidth / width);
      const guideY = Math.floor(y * guideHeight / height);
      const guideOffset = (guideY * guideWidth + guideX) * 4;
      let weightedAlpha = 0;
      let totalWeight = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const neighbor = ((y + dy) * width + x + dx) * 4;
          const guideNeighbor = (Math.floor((y + dy) * guideHeight / height) * guideWidth + Math.floor((x + dx) * guideWidth / width)) * 4;
          const colorDifference = (
            Math.abs(guide[guideOffset] - guide[guideNeighbor]) +
            Math.abs(guide[guideOffset + 1] - guide[guideNeighbor + 1]) +
            Math.abs(guide[guideOffset + 2] - guide[guideNeighbor + 2])
          ) / 3;
          const spatialWeight = dx === 0 && dy === 0 ? 2 : 1;
          const weight = spatialWeight * Math.exp(-colorDifference / 48);
          weightedAlpha += data[neighbor + 3] * weight;
          totalWeight += weight;
        }
      }

      const guidedAlpha = weightedAlpha / totalWeight;
      const refinedAlpha = alpha * 0.45 + guidedAlpha * 0.55;
      const normalizedAlpha = Math.max(0, Math.min(1, (refinedAlpha - edgeThreshold) / (255 - edgeThreshold)));
      data[offset + 3] = Math.round(normalizedAlpha * normalizedAlpha * (3 - 2 * normalizedAlpha) * 255);
    }
  }

  removeMatteIslands(data, width, height, 72 + edgeThreshold * 0.25);
  return rgba.toBlob('image/png');
}

async function createSegmenter(device: 'webgpu' | 'wasm') {
  return pipeline('background-removal', 'Xenova/modnet', {
    device,
    dtype: device === 'webgpu' ? 'fp16' : 'q8',
    progress_callback: (progress) => {
      if (progress.status === 'progress_total') {
        self.postMessage({
          type: 'progress',
          current: Math.round(progress.progress),
          total: 100,
          detail: `Mengunduh model AI (pertama kali): ${Math.round(progress.progress)}%`,
        });
      } else if (progress.status === 'progress') {
        const resource = progress.file.includes('onnxruntime-web') ? 'runtime AI' : 'model AI';
        self.postMessage({
          type: 'progress',
          current: Math.round(progress.progress),
          total: 100,
          detail: `Mengunduh ${resource}: ${progress.file} (${Math.round(progress.progress)}%)`,
        });
      } else if (progress.status === 'ready') {
        self.postMessage({
          type: 'progress',
          current: 0,
          total: 1,
          detail: 'Model AI siap. Memproses gambar...',
        });
      }
    },
  });
}

self.onmessage = async (event: MessageEvent<BackgroundRemovalRequest>) => {
  try {
    const { files, edgeThreshold } = event.data;
    if (!files.length) throw new Error('Pilih setidaknya satu foto.');
    if (!Number.isFinite(edgeThreshold) || edgeThreshold < 0 || edgeThreshold > 160) {
      throw new Error('Pengaturan kebersihan tepi harus antara 0 dan 160.');
    }
    if (files.length > 100) throw new Error('Maksimal 100 gambar per batch.');
    if (files.some((file) => file.size > 25 * 1024 * 1024)) {
      throw new Error('Maksimal ukuran setiap foto adalah 25 MB.');
    }
    if (files.reduce((total, file) => total + file.size, 0) > 250 * 1024 * 1024) {
      throw new Error('Total ukuran foto maksimal 250 MB per batch.');
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      throw new Error('Semua file harus berupa gambar.');
    }

    self.postMessage({
      type: 'progress',
      current: 0,
      total: 100,
      detail: 'Menyiapkan model AI dan runtime lokal (unduhan pertama bisa mencapai sekitar 34 MB)...',
    });
    const gpu = Reflect.get(navigator, 'gpu') as
      | { requestAdapter: () => Promise<unknown> }
      | undefined;
    const adapter = await gpu?.requestAdapter().catch(() => null);
    let activeDevice: 'webgpu' | 'wasm' = adapter ? 'webgpu' : 'wasm';
    let segmenter;
    try {
      segmenter = await createSegmenter(activeDevice);
    } catch (error) {
      if (activeDevice !== 'webgpu') throw error;
      activeDevice = 'wasm';
      self.postMessage({
        type: 'progress',
        current: 0,
        total: 100,
        detail: 'GPU gagal dimuat, beralih ke mode kompatibel...',
      });
      segmenter = await createSegmenter(activeDevice);
    }
    const outputs: { name: string; mimeType: string; buffer: ArrayBuffer }[] = [];

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      self.postMessage({
        type: 'progress',
        current: index,
        total: files.length,
        detail: `Menganalisis objek: ${file.name}`,
      });

      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 12_000_000) {
          throw new Error(`${file.name}: resolusi maksimal 12 megapiksel untuk menjaga memori browser.`);
        }

        let result;
        try {
          result = await segmenter(file);
        } catch (error) {
          if (activeDevice !== 'webgpu') throw error;
          await segmenter.dispose();
          activeDevice = 'wasm';
          self.postMessage({
            type: 'progress',
            current: 0,
            total: 100,
            detail: 'GPU gagal memproses gambar, beralih ke mode kompatibel...',
          });
          segmenter = await createSegmenter(activeDevice);
          result = await segmenter(file);
        }
        const blob = await createRefinedPng(result, bitmap, edgeThreshold);
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 100) || 'image';
        outputs.push({
          name: `${String(index + 1).padStart(3, '0')}_${baseName}_no_bg.png`,
          mimeType: 'image/png',
          buffer: await blob.arrayBuffer(),
        });
      } finally {
        bitmap.close();
      }

      self.postMessage({
        type: 'progress',
        current: index + 1,
        total: files.length,
        detail: `Latar selesai: ${file.name}`,
      });
    }

    const transfer = outputs.map((output) => output.buffer);
    self.postMessage({ type: 'done', total: files.length, outputs }, { transfer });
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: getErrorMessage(error),
    });
  }
};
