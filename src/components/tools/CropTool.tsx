import { useEffect, useRef, useState } from 'react';
import { DropZone } from '../common/DropZone';
import { ProgressBar } from '../common/ProgressBar';
import { ResultCard } from '../common/ResultCard';
import type { ProcessResult, ProcessTelemetry } from '../../types';
import { formatDuration } from '../../utils/natural-sort';
import { pdfjsLib, renderThumbnail } from '../../utils/pdfjs-config';

interface CropMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const initialMargins: CropMargins = { top: 0, right: 0, bottom: 0, left: 0 };
const marginLabels: { key: keyof CropMargins; label: string }[] = [
  { key: 'top', label: 'Atas' },
  { key: 'right', label: 'Kanan' },
  { key: 'bottom', label: 'Bawah' },
  { key: 'left', label: 'Kiri' },
];

export function CropTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [margins, setMargins] = useState<CropMargins>(initialMargins);
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<ProcessTelemetry | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const documentRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const startedAtRef = useRef(0);
  const previewRequestRef = useRef(0);

  useEffect(() => () => {
    previewRequestRef.current += 1;
    workerRef.current?.terminate();
    void loadingTaskRef.current?.destroy();
  }, []);

  const updatePreview = async (document: pdfjsLib.PDFDocumentProxy, pageNumber: number) => {
    const request = ++previewRequestRef.current;
    setPreviewBusy(true);
    try {
      const thumbnail = await renderThumbnail(document, pageNumber, 1000);
      if (request === previewRequestRef.current) setPreviewUrl(thumbnail);
    } catch (previewError) {
      if (request === previewRequestRef.current) {
        setError(previewError instanceof Error ? previewError.message : 'Gagal menampilkan pratinjau PDF.');
      }
    } finally {
      if (request === previewRequestRef.current) setPreviewBusy(false);
    }
  };

  const loadFile = async (selectedFile: File) => {
    setError(null);
    setResult(null);
    setMargins(initialMargins);
    setFile(selectedFile);
    setPreviewUrl('');
    setPreviewPage(1);
    setPageCount(0);
    await loadingTaskRef.current?.destroy();
    documentRef.current = null;
    loadingTaskRef.current = null;
    try {
      if (selectedFile.size > 100 * 1024 * 1024) {
        throw new Error('Ukuran maksimal PDF untuk crop adalah 100 MB.');
      }
      const loadingTask = pdfjsLib.getDocument({ data: await selectedFile.arrayBuffer() });
      loadingTaskRef.current = loadingTask;
      const document = await loadingTask.promise;
      documentRef.current = document;
      setPageCount(document.numPages);
      await updatePreview(document, 1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Gagal membaca dokumen PDF.');
    }
  };

  const handleCrop = async () => {
    if (!file || !pageCount) return;
    setError(null);
    setResult(null);
    setIsProcessing(true);
    startedAtRef.current = performance.now();
    setTelemetry({
      current: 0,
      total: pageCount,
      pagesProcessed: 0,
      currentFileName: file.name,
      speedPagesPerSec: 0,
      elapsedSeconds: 0,
      etaSeconds: null,
    });

    try {
      const worker = new Worker(new URL('../../workers/crop.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = (event: MessageEvent) => {
        const message = event.data;
        const elapsedSeconds = (performance.now() - startedAtRef.current) / 1000;
        if (message.type === 'progress') {
          setTelemetry({
            current: message.current,
            total: message.total,
            pagesProcessed: message.current,
            currentFileName: message.detail,
            speedPagesPerSec: elapsedSeconds > 0 ? message.current / elapsedSeconds : 0,
            elapsedSeconds,
            etaSeconds: null,
          });
        } else if (message.type === 'done') {
          const blob = new Blob([message.pdfBuffer], { type: 'application/pdf' });
          setResult({
            blob,
            fileName: `${file.name.replace(/\.pdf$/i, '')}_cropped`,
            totalPages: message.totalPages,
            originalSize: file.size,
            resultSize: blob.size,
            elapsedSeconds,
            speedPagesPerSec: elapsedSeconds > 0 ? message.totalPages / elapsedSeconds : 0,
          });
          setTelemetry(null);
          setIsProcessing(false);
          worker.terminate();
          workerRef.current = null;
        } else if (message.type === 'error') {
          setError(message.error || 'Gagal memotong area PDF.');
          setTelemetry(null);
          setIsProcessing(false);
          worker.terminate();
          workerRef.current = null;
        }
      };
      worker.onerror = (event) => {
        setError(event.message || 'Worker crop PDF gagal dijalankan.');
        setTelemetry(null);
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      };
      const fileBuffer = await file.arrayBuffer();
      worker.postMessage({ fileBuffer, margins }, [fileBuffer]);
    } catch (processingError) {
      workerRef.current?.terminate();
      workerRef.current = null;
      setError(processingError instanceof Error ? processingError.message : 'Tidak dapat memulai proses crop.');
      setTelemetry(null);
      setIsProcessing(false);
    }
  };

  const cancelCrop = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setIsProcessing(false);
    setTelemetry(null);
  };

  const reset = () => {
    previewRequestRef.current += 1;
    void loadingTaskRef.current?.destroy();
    documentRef.current = null;
    loadingTaskRef.current = null;
    setFile(null);
    setPageCount(0);
    setPreviewPage(1);
    setPreviewUrl('');
    setMargins(initialMargins);
    setResult(null);
    setError(null);
  };

  const rightEdge = 100 - margins.right;
  const bottomEdge = 100 - margins.bottom;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Potong Area PDF</h2>
        <p className="text-xs text-gray-500">
          Atur margin crop sambil melihat pratinjau. Potongan yang sama diterapkan ke semua halaman.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) void loadFile(files[0]);
          }}
          title="Pilih PDF untuk dipotong"
          subtitle="Pratinjau dan pengaturan area crop berjalan di browser"
        />
      )}

      {file && !result && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-gray-900">{file.name}</p>
              <p className="text-[11px] text-gray-500">{pageCount} halaman · potongan berlaku untuk semua halaman</p>
            </div>
            {!isProcessing && (
              <button type="button" onClick={reset} className="text-xs text-red-600 hover:underline">
                Ganti File
              </button>
            )}
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-gray-800">Pratinjau crop</p>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  Halaman
                  <select
                    value={previewPage}
                    onChange={(event) => {
                      const pageNumber = Number(event.target.value);
                      setPreviewPage(pageNumber);
                      if (documentRef.current) void updatePreview(documentRef.current, pageNumber);
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-2 py-1.5"
                  >
                    {Array.from({ length: pageCount }, (_, index) => (
                      <option key={index + 1} value={index + 1}>{index + 1}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100 p-3">
                {previewBusy || !previewUrl ? (
                  <span className="text-xs text-gray-500">Memuat pratinjau...</span>
                ) : (
                  <div className="relative inline-block max-w-full overflow-hidden shadow-sm">
                    <img src={previewUrl} alt={`Pratinjau crop halaman ${previewPage}`} className="block max-h-[65vh] max-w-full" />
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute inset-x-0 top-0 bg-slate-950/45" style={{ height: `${margins.top}%` }} />
                      <div className="absolute inset-x-0 bottom-0 bg-slate-950/45" style={{ height: `${margins.bottom}%` }} />
                      <div
                        className="absolute bg-slate-950/45"
                        style={{ left: 0, top: `${margins.top}%`, width: `${margins.left}%`, height: `${100 - margins.top - margins.bottom}%` }}
                      />
                      <div
                        className="absolute bg-slate-950/45"
                        style={{ right: 0, top: `${margins.top}%`, width: `${margins.right}%`, height: `${100 - margins.top - margins.bottom}%` }}
                      />
                      <div
                        className="absolute border-2 border-blue-500"
                        style={{
                          left: `${margins.left}%`,
                          top: `${margins.top}%`,
                          width: `${rightEdge - margins.left}%`,
                          height: `${bottomEdge - margins.top}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <p className="text-center text-[11px] text-gray-500">
                Area gelap disembunyikan oleh batas crop; konten di luar area mungkin masih dapat dipulihkan.
              </p>
            </section>

            <section className="space-y-4 rounded-xl bg-gray-50 p-4">
              <h3 className="text-sm font-semibold text-gray-800">Atur batas crop</h3>
              {marginLabels.map(({ key, label }) => (
                <label key={key} className="block space-y-1.5">
                  <span className="flex justify-between text-xs font-medium text-gray-700">
                    <span>{label}</span>
                    <span>{margins[key]}%</span>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={margins[key]}
                    onChange={(event) => setMargins((previous) => ({ ...previous, [key]: Number(event.target.value) }))}
                    className="w-full accent-blue-600"
                    aria-label={`Crop margin ${label}`}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => setMargins(initialMargins)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Reset area crop
              </button>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Kontrol margin memperbesar atau memperkecil area yang dipertahankan. Nilai maksimal 40% per sisi.
              </p>
            </section>
          </div>

          {telemetry && <ProgressBar telemetry={telemetry} onCancel={cancelCrop} title="Memotong area PDF..." />}
          <button
            type="button"
            disabled={!pageCount || isProcessing || previewBusy}
            onClick={() => void handleCrop()}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? `Memotong PDF · ${formatDuration(telemetry?.elapsedSeconds ?? 0)}` : 'Potong PDF dan unduh'}
          </button>
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          onDownload={(customName) => {
            const url = URL.createObjectURL(result.blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${customName || result.fileName}.pdf`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }}
          onReset={reset}
          title="Crop PDF selesai"
        />
      )}

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
    </div>
  );
}
