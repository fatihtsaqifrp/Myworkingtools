import { useRef, useState, type PointerEvent } from 'react';
import { DropZone } from '../common/DropZone';
import { ResultCard } from '../common/ResultCard';
import type { ProcessResult, WatermarkOptions } from '../../types';
import { formatBytes } from '../../utils/natural-sort';
import { pdfjsLib, renderPageToDataUrl } from '../../utils/pdfjs-config';

export function WatermarkTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pagePreviewUrl, setPagePreviewUrl] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 50, y: 50 });
  const [pageNumberPositionPercent, setPageNumberPositionPercent] = useState({ x: 50, y: 94 });
  const previewRef = useRef<HTMLDivElement | null>(null);
  const activePreviewItemRef = useRef<'watermark' | 'pageNumber' | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Watermark Options
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL / RAHASIA');
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.2);
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState('#64748b');
  const [position, setPosition] = useState<'center' | 'top' | 'bottom'>('center');

  // Page numbering Options
  const [enablePageNumbers, setEnablePageNumbers] = useState(true);
  const [pageNumberFormat, setPageNumberFormat] = useState<any>('Halaman {n} dari {total}');
  const pageNumberPosition = 'bottom-center';

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApplyWatermark = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    const startTime = Date.now();

    const worker = new Worker(new URL('../../workers/watermark.worker.ts', import.meta.url), {
      type: 'module',
    });

    const options: WatermarkOptions = {
      type: 'text',
      text: watermarkText,
      fontSize,
      opacity,
      rotation,
      color,
      position,
      textX: textPosition.x,
      textY: textPosition.y,
      enablePageNumbers,
      pageNumberFormat,
      pageNumberPosition,
      pageNumberX: pageNumberPositionPercent.x,
      pageNumberY: pageNumberPositionPercent.y,
    };

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'done') {
        const elapsed = (Date.now() - startTime) / 1000;
        const blob = new Blob([msg.pdfBuffer], { type: 'application/pdf' });
        setResult({
          blob,
          fileName: `${file.name.replace(/\.pdf$/i, '')}_watermarked`,
          totalPages: msg.totalPages,
          originalSize: file.size,
          resultSize: blob.size,
          elapsedSeconds: elapsed,
          speedPagesPerSec: msg.totalPages > 0 && elapsed > 0 ? msg.totalPages / elapsed : 0,
        });
        setIsProcessing(false);
        worker.terminate();
      } else if (msg.type === 'error') {
        setError(msg.error);
        setIsProcessing(false);
        worker.terminate();
      }
    };

    const buffer = await file.arrayBuffer();
    worker.postMessage(
      {
        type: 'process_watermark',
        fileBuffer: buffer,
        options,
      },
      [buffer]
    );
  };

  const handleSelectFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setPagePreviewUrl('');
    setError(null);
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    try {
      task = pdfjsLib.getDocument({ data: await selectedFile.arrayBuffer() });
      const doc = await task.promise;
      const { dataUrl } = await renderPageToDataUrl(doc, 1, 1.3, 0.9);
      setPagePreviewUrl(dataUrl ?? '');
      setTotalPages(doc.numPages);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Gagal memuat pratinjau PDF.');
    } finally {
      await task?.destroy();
    }
  };

  const startPreviewDrag = (target: 'watermark' | 'pageNumber', event: PointerEvent<HTMLDivElement>) => {
    const preview = previewRef.current;
    if (!preview) return;
    const bounds = preview.getBoundingClientRect();
    const position = target === 'watermark' ? textPosition : pageNumberPositionPercent;
    dragOffsetRef.current = {
      x: event.clientX - (bounds.left + (position.x / 100) * bounds.width),
      y: event.clientY - (bounds.top + (position.y / 100) * bounds.height),
    };
    activePreviewItemRef.current = target;
    preview.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const movePreviewItem = (event: PointerEvent<HTMLDivElement>) => {
    const target = activePreviewItemRef.current;
    const preview = previewRef.current;
    if (!target || !preview || !preview.hasPointerCapture(event.pointerId)) return;
    const bounds = preview.getBoundingClientRect();
    const nextPosition = {
      x: Math.max(0, Math.min(100, ((event.clientX - dragOffsetRef.current.x - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - dragOffsetRef.current.y - bounds.top) / bounds.height) * 100)),
    };
    if (target === 'watermark') setTextPosition(nextPosition);
    else setPageNumberPositionPercent(nextPosition);
  };

  const stopPreviewDrag = (event: PointerEvent<HTMLDivElement>) => {
    activePreviewItemRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Watermark & Nomor Halaman
        </h2>
        <p className="text-xs text-gray-500">
          Tambahkan cap teks transparan dan penomoran halaman otomatis secara massal ke seluruh lembar PDF.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) void handleSelectFile(files[0]);
          }}
          title="Pilih dokumen PDF untuk diberi watermark"
          subtitle="Teks cap dan nomor halaman akan ditambahkan ke setiap halaman"
        />
      )}

      {file && !result && !isProcessing && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-xs font-bold text-gray-900">{file.name}</p>
              <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-red-600 hover:underline"
            >
              Ganti File
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <section className={`space-y-3 ${previewExpanded ? 'fixed inset-3 z-50 flex flex-col rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">Pratinjau halaman 1</h3>
                  <p className="text-[11px] text-gray-500">Seret teks langsung di halaman untuk menempatkannya.</p>
                </div>
                <button type="button" onClick={() => setPreviewExpanded((expanded) => !expanded)} className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  {previewExpanded ? 'Kecilkan' : 'Perbesar'}
                </button>
              </div>
              <div className={`flex min-h-64 items-center justify-center overflow-auto rounded-xl border border-gray-200 bg-gray-100 p-3 ${previewExpanded ? 'flex-1' : ''}`}>
                {pagePreviewUrl ? (
                  <div
                    ref={previewRef}
                    onPointerMove={movePreviewItem}
                    onPointerUp={stopPreviewDrag}
                    onPointerCancel={stopPreviewDrag}
                    className="relative inline-block max-w-full border border-gray-200 bg-white shadow-sm"
                  >
                    <img src={pagePreviewUrl} alt="Pratinjau halaman PDF dengan watermark" className={`block max-w-full object-contain ${previewExpanded ? 'max-h-[76vh]' : 'max-h-[62vh]'}`} />
                    {watermarkText.trim() && (
                      <div
                        onPointerDown={(event) => startPreviewDrag('watermark', event)}
                        className="absolute z-10 cursor-move touch-none whitespace-nowrap font-bold"
                        style={{
                          left: `${textPosition.x}%`,
                          top: `${textPosition.y}%`,
                          color,
                          opacity,
                          fontSize: `${Math.min(fontSize * 0.55, 36)}px`,
                          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                        }}
                      >
                        {watermarkText}
                      </div>
                    )}
                    {enablePageNumbers && (
                      <div
                        onPointerDown={(event) => startPreviewDrag('pageNumber', event)}
                        className="absolute z-10 cursor-move touch-none whitespace-nowrap rounded bg-blue-50/80 px-1.5 py-0.5 font-mono text-[10px] text-blue-800"
                        style={{ left: `${pageNumberPositionPercent.x}%`, top: `${pageNumberPositionPercent.y}%`, transform: 'translate(-50%, -50%)' }}
                      >
                        {String(pageNumberFormat).replace('{n}', '1').replace('{total}', String(totalPages))}
                      </div>
                    )}
                  </div>
                ) : <span className="text-xs text-gray-500">Memuat pratinjau PDF...</span>}
              </div>
            </section>

            <div className="space-y-5">
          {/* Section 1: Watermark Config */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              1. Teks Watermark
            </h3>

            <div>
              <label className="text-xs font-medium text-gray-700">Teks Cap:</label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="Contoh: RAHASIA / DRAFT / SALINAN"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-gray-600">
                  Transparansi: {Math.round(opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="0.8"
                  step="0.05"
                  value={opacity}
                  onChange={(e) => setOpacity(parseFloat(e.target.value))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">
                  Sudut Rotasi: {rotation}°
                </label>
                <input
                  type="range"
                  min="-90"
                  max="90"
                  step="15"
                  value={rotation}
                  onChange={(e) => setRotation(parseInt(e.target.value, 10))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>

              <div>
                <label className="text-xs text-gray-600">
                  Ukuran Huruf: {fontSize} pt
                </label>
                <input
                  type="range"
                  min="20"
                  max="80"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                  className="mt-1 w-full accent-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Page Numbering Config */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                2. Nomor Halaman
              </h3>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePageNumbers}
                  onChange={(e) => setEnablePageNumbers(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Aktifkan</span>
              </label>
            </div>

            {enablePageNumbers && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-gray-700">Format:</label>
                  <select
                    value={pageNumberFormat}
                    onChange={(e) => setPageNumberFormat(e.target.value as any)}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900"
                  >
                    <option value="Halaman {n} dari {total}">Halaman {`{n}`} dari {`{total}`}</option>
                    <option value="{n} / {total}">{`{n}`} / {`{total}`}</option>
                    <option value="{n}">Hanya Angka: {`{n}`}</option>
                  </select>
                </div>

              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyWatermark}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
          >
            Terapkan Watermark & Nomor Halaman
          </button>
            </div>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 text-center text-xs text-blue-800">
          Sedang memproses watermark & penomoran halaman...
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          onDownload={(customName) => {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${customName || result.fileName}.pdf`;
            a.click();
          }}
          onReset={() => {
            setResult(null);
            setFile(null);
          }}
          title="Watermark & Nomor Halaman Berhasil Diterapkan"
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
