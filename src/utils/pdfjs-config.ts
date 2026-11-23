import * as pdfjsLib from 'pdfjs-dist';
// Vite ?url import creates a separate asset URL for the worker
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
}

export { pdfjsLib };

/**
 * Render a single PDF page into a high-quality Canvas or Data URL
 */
type PageRenderResult = { width: number; height: number; blob: Blob };

export function renderPageToDataUrl(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale?: number,
  quality?: number
): Promise<PageRenderResult & { dataUrl: string }>;
export function renderPageToDataUrl(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  quality: number,
  output: 'both',
  format?: 'image/jpeg' | 'image/png'
): Promise<PageRenderResult & { dataUrl: string }>;
export function renderPageToDataUrl(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale: number,
  quality: number,
  output: 'blob',
  format?: 'image/jpeg' | 'image/png'
): Promise<PageRenderResult & { dataUrl: null }>;
export async function renderPageToDataUrl(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 1.0,
  quality = 0.85,
  output: 'both' | 'blob' = 'both',
  format: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<PageRenderResult & { dataUrl: string | null }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  try {
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Canvas 2D context not available');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: context,
      viewport,
      canvas,
    }).promise;

    const width = canvas.width;
    const height = canvas.height;
    const dataUrl = output === 'both' ? canvas.toDataURL(format, quality) : null;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error('Failed to create blob from canvas'));
        },
        format,
        format === 'image/jpeg' ? quality : undefined
      );
    });

    return { dataUrl, width, height, blob };
  } finally {
    page.cleanup();
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Render thumbnail for fast preview
 */
export async function renderThumbnail(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  maxWidth = 180
): Promise<string> {
  const page = await pdfDoc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) return '';

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
    canvas,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.65);
}
