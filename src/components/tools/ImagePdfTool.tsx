import { useState, useRef } from 'react';
import { DropZone } from '../common/DropZone';
import { ProgressBar } from '../common/ProgressBar';
import { ResultCard } from '../common/ResultCard';
import type { ProcessTelemetry, ProcessResult } from '../../types';
import { pdfjsLib, renderPageToDataUrl } from '../../utils/pdfjs-config';
import { formatBytes } from '../../utils/natural-sort';

export function ImagePdfTool() {
  const [subMode, setSubMode] = useState<'img2pdf' | 'pdf2img'>('img2pdf');

  // img2pdf state
  const [images, setImages] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<'fit' | 'a4'>('a4');
  const [margin, setMargin] = useState<number>(20);

  // pdf2img state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [imageFormat, setImageFormat] = useState<'jpeg' | 'png'>('jpeg');

  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<ProcessTelemetry | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const isCancelledRef = useRef(false);

  const handleImagesToPdf = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setResult(null);
    setError(null);
    const startTime = Date.now();

    const worker = new Worker(new URL('../../workers/image-converter.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        const elapsed = (Date.now() - startTime) / 1000;
        setTelemetry({
          current: msg.current,
          total: msg.total,
          pagesProcessed: msg.current,
          currentFileName: msg.detail,
          speedPagesPerSec: msg.current > 0 && elapsed > 0 ? msg.current / elapsed : 0,
          elapsedSeconds: elapsed,
          etaSeconds: null,
        });
      } else if (msg.type === 'done') {
        const elapsed = (Date.now() - startTime) / 1000;
        const blob = new Blob([msg.pdfBuffer], { type: 'application/pdf' });
        setResult({
          blob,
          fileName: 'images_converted',
          totalPages: msg.totalPages,
          totalFiles: images.length,
          originalSize: images.reduce((s, f) => s + f.size, 0),
          resultSize: blob.size,
          elapsedSeconds: elapsed,
          speedPagesPerSec: msg.totalPages > 0 && elapsed > 0 ? msg.totalPages / elapsed : 0,
        });
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        setError(msg.error);
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.onerror = (event) => {
      setError(event.message || 'Terjadi kesalahan saat mengubah gambar ke PDF');
      setIsProcessing(false);
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({
      type: 'images_to_pdf',
      images: images.map((file) => ({ name: file.name, file, mimeType: file.type })),
      pageSize,
      margin,
    });
  };

  const handlePdfToImages = async () => {
    if (!pdfFile) return;

    setIsProcessing(true);
    setResult(null);
    setError(null);
    isCancelledRef.current = false;
    const startTime = Date.now();

    try {
      const buffer = await pdfFile.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: buffer });
      const pdfDoc = await task.promise;
      const totalPages = pdfDoc.numPages;

      const renderedImages: { name: string; buffer: ArrayBuffer }[] = [];

      for (let i = 1; i <= totalPages; i++) {
        if (isCancelledRef.current) {
          setIsProcessing(false);
          return;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        setTelemetry({
          current: i,
          total: totalPages,
          pagesProcessed: i,
          currentFileName: `Halaman ${i} dari ${totalPages}...`,
          speedPagesPerSec: i > 0 && elapsed > 0 ? i / elapsed : 0,
          elapsedSeconds: elapsed,
          etaSeconds: null,
        });

        const format = imageFormat === 'png' ? 'image/png' : 'image/jpeg';
        const { blob } = await renderPageToDataUrl(pdfDoc, i, 1.5, 0.9, 'blob', format);
        const imgBuffer = await blob.arrayBuffer();
        renderedImages.push({
          name: `halaman_${i}.${imageFormat === 'jpeg' ? 'jpg' : 'png'}`,
          buffer: imgBuffer,
        });
      }

      const worker = new Worker(new URL('../../workers/image-converter.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'done_zip') {
          const elapsed = (Date.now() - startTime) / 1000;
          const blob = new Blob([msg.zipBuffer], { type: 'application/zip' });
          setResult({
            blob,
            fileName: `${pdfFile.name.replace(/\.pdf$/i, '')}_images`,
            totalPages,
            totalFiles: totalPages,
            originalSize: pdfFile.size,
            resultSize: blob.size,
            elapsedSeconds: elapsed,
            speedPagesPerSec: totalPages > 0 && elapsed > 0 ? totalPages / elapsed : 0,
          });
          setIsProcessing(false);
          worker.terminate();
          workerRef.current = null;
        } else if (msg.type === 'error') {
          setError(msg.error);
          setIsProcessing(false);
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (event) => {
        setError(event.message || 'Terjadi kesalahan saat mengekstrak gambar dari PDF');
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      };

      const transferables = renderedImages.map((r) => r.buffer);
      worker.postMessage(
        {
          type: 'package_images_zip',
          imageBlobs: renderedImages,
          baseName: pdfFile.name,
        },
        transferables
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengekstrak gambar dari PDF');
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Konversi PDF &lt;-&gt; Gambar
        </h2>
        <p className="text-xs text-gray-500">
          Ubah kumpulan gambar menjadi 1 file PDF, atau ekstrak semua halaman PDF menjadi gambar ke file ZIP.
        </p>
      </div>

      {/* Tab Selector */}
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => {
            setSubMode('img2pdf');
            setResult(null);
          }}
          className={`py-2 text-xs font-semibold rounded-md transition ${
            subMode === 'img2pdf' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-600'
          }`}
        >
          Gambar ke PDF
        </button>

        <button
          type="button"
          onClick={() => {
            setSubMode('pdf2img');
            setResult(null);
          }}
          className={`py-2 text-xs font-semibold rounded-md transition ${
            subMode === 'pdf2img' ? 'bg-white text-blue-600 shadow-2xs' : 'text-gray-600'
          }`}
        >
          PDF ke Gambar (ZIP)
        </button>
      </div>

      {/* MODE 1: Images to PDF */}
      {subMode === 'img2pdf' && !result && (
        <div className="space-y-4">
          <DropZone
            accept="image/*,.jpg,.jpeg,.png,.webp"
            onFilesSelected={(newFiles) => setImages((prev) => [...prev, ...newFiles])}
            title="Pilih atau seret gambar ke sini"
            subtitle="Mendukung JPG, PNG, dan WebP"
          />

          {images.length > 0 && !isProcessing && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <span className="text-xs font-bold text-gray-800">
                  {images.length} gambar dipilih ({formatBytes(images.reduce((s, f) => s + f.size, 0))})
                </span>
                <button
                  type="button"
                  onClick={() => setImages([])}
                  className="text-xs text-red-500 hover:underline"
                >
                  Hapus Semua
                </button>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Ukuran Halaman:
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900"
                  >
                    <option value="a4">Standar A4 (Proporsional)</option>
                    <option value="fit">Sesuai Ukuran Gambar</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-700">
                    Margin: {margin} pt
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={margin}
                    onChange={(e) => setMargin(parseInt(e.target.value, 10))}
                    className="mt-2 w-full accent-blue-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleImagesToPdf}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
              >
                Ubah {images.length} Gambar Menjadi 1 File PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: PDF to Images */}
      {subMode === 'pdf2img' && !result && (
        <div className="space-y-4">
          {!pdfFile && (
            <DropZone
              multiple={false}
              allowFolder={false}
              onFilesSelected={(files) => {
                if (files[0]) setPdfFile(files[0]);
              }}
              title="Pilih file PDF untuk diekstrak gambarnya"
              subtitle="Setiap halaman akan disimpan sebagai file gambar"
            />
          )}

          {pdfFile && !isProcessing && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div>
                  <p className="text-xs font-bold text-gray-900">{pdfFile.name}</p>
                  <p className="text-[11px] text-gray-400">{formatBytes(pdfFile.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPdfFile(null)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Ganti File
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700">
                  Format Gambar:
                </label>
                <div className="mt-1 flex gap-2">
                  {['jpeg', 'png'].map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setImageFormat(fmt as any)}
                      className={`flex-1 rounded-md border py-1.5 text-xs font-semibold uppercase transition ${
                        imageFormat === fmt
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handlePdfToImages}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
              >
                Ekstrak Seluruh Halaman ke File ZIP
              </button>
            </div>
          )}
        </div>
      )}

      {isProcessing && telemetry && (
        <ProgressBar
          telemetry={telemetry}
          onCancel={() => {
            isCancelledRef.current = true;
            if (workerRef.current) {
              workerRef.current.terminate();
              workerRef.current = null;
            }
            setIsProcessing(false);
            setTelemetry(null);
          }}
          title="Sedang Memproses Konversi..."
        />
      )}

      {result && (
        <ResultCard
          result={result}
          onDownload={(customName) => {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            const ext = subMode === 'pdf2img' ? '.zip' : '.pdf';
            a.download = `${customName || result.fileName}${ext}`;
            a.click();
          }}
          onReset={() => {
            setResult(null);
            setImages([]);
            setPdfFile(null);
          }}
          title={subMode === 'img2pdf' ? 'Konversi ke PDF Selesai' : 'Ekstraksi Gambar Selesai'}
          isZip={subMode === 'pdf2img'}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Gagal: {error}
        </div>
      )}
    </div>
  );
}
