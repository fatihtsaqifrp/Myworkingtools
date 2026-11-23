import { useState, useRef, useEffect, type PointerEvent } from 'react';
import { DropZone } from '../common/DropZone';
import { ResultCard } from '../common/ResultCard';
import type { ProcessResult, SignatureStamp } from '../../types';
import { pdfjsLib, renderPageToDataUrl } from '../../utils/pdfjs-config';

export function SignStampTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pagePreviewUrl, setPagePreviewUrl] = useState<string>('');

  const [stampType, setStampType] = useState<'draw' | 'image' | 'text'>('draw');
  const [textStamp, setTextStamp] = useState('APPROVED');
  const [stampColor, setStampColor] = useState('#1e3a8a');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Position in percentage
  const [posX, setPosX] = useState(60);
  const [posY, setPosY] = useState(80);
  const [scale, setScale] = useState(25);

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewPageRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const isDrawingRef = useRef(false);
  const fileBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfDocRef = useRef<any>(null);

  const handleLoadPdf = async (selectedFile: File) => {
    try {
      const buf = await selectedFile.arrayBuffer();
      fileBufferRef.current = buf.slice(0);

      const task = pdfjsLib.getDocument({ data: buf });
      const doc = await task.promise;
      pdfDocRef.current = doc;
      setTotalPages(doc.numPages);
      setPageNumber(1);

      await renderCurrentPage(doc, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat PDF');
    }
  };

  const renderCurrentPage = async (doc: any, pageNum: number) => {
    try {
      const { dataUrl } = await renderPageToDataUrl(doc, pageNum, 1.2, 0.85);
      setPagePreviewUrl(dataUrl);
    } catch (err) {
      console.error('Error rendering page preview:', err);
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (!pdfDocRef.current || newPage < 1 || newPage > totalPages) return;
    setPageNumber(newPage);
    await renderCurrentPage(pdfDocRef.current, newPage);
  };

  const startStampDrag = (event: PointerEvent<HTMLDivElement>) => {
    const page = previewPageRef.current;
    if (!page) return;
    const bounds = page.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - (bounds.left + (posX / 100) * bounds.width),
      y: event.clientY - (bounds.top + (posY / 100) * bounds.height),
    };
    page.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveStamp = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const page = previewPageRef.current;
    if (!page) return;
    const bounds = page.getBoundingClientRect();
    setPosX(Math.max(scale / 2, Math.min(100 - scale / 2, ((event.clientX - dragOffsetRef.current.x - bounds.left) / bounds.width) * 100)));
    setPosY(Math.max(scale * 0.25, Math.min(100 - scale * 0.25, ((event.clientY - dragOffsetRef.current.y - bounds.top) / bounds.height) * 100)));
  };

  const stopStampDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.strokeStyle = stampColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (canvasRef.current) {
      setSignatureDataUrl(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl('');
  };

  useEffect(() => {
    if (stampType === 'text') {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 140;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = stampColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(6, 6, 388, 128);

        ctx.fillStyle = stampColor;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(textStamp, 200, 50);

        ctx.font = '13px Arial, sans-serif';
        const dateStr = new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        ctx.fillText(`TANGGAL: ${dateStr}`, 200, 95);

        setSignatureDataUrl(c.toDataURL('image/png'));
      }
    }
  }, [stampType, textStamp, stampColor]);

  const handleApplySignature = () => {
    if (!fileBufferRef.current || !signatureDataUrl) return;

    setIsProcessing(true);
    setError(null);
    const startTime = Date.now();
    const worker = new Worker(new URL('../../workers/watermark.worker.ts', import.meta.url), {
      type: 'module',
    });

    const stamp: SignatureStamp = {
      type: stampType,
      dataUrl: signatureDataUrl,
      pageNumber,
      x: posX,
      y: posY,
      width: scale,
      height: scale * 0.5,
    };

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'done') {
        const blob = new Blob([msg.pdfBuffer], { type: 'application/pdf' });
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        setResult({
          blob,
          fileName: `${file?.name.replace(/\.pdf$/i, '')}_signed`,
          totalPages: msg.totalPages,
          originalSize: file?.size,
          resultSize: blob.size,
          elapsedSeconds,
          speedPagesPerSec: elapsedSeconds > 0 ? msg.totalPages / elapsedSeconds : 0,
        });
        setIsProcessing(false);
        worker.terminate();
      } else if (msg.type === 'error') {
        setError(msg.error);
        setIsProcessing(false);
        worker.terminate();
      }
    };

    const buffer = fileBufferRef.current.slice(0);
    worker.postMessage(
      {
        type: 'apply_stamp',
        fileBuffer: buffer,
        stamp,
      },
      [buffer]
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Tanda Tangan & Stempel
        </h2>
        <p className="text-xs text-gray-500">
          Buat tanda tangan manual, unggah PNG, atau buat stempel teks langsung di lembar PDF.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) {
              setFile(files[0]);
              handleLoadPdf(files[0]);
            }
          }}
          title="Pilih dokumen PDF untuk ditandatangani"
          subtitle="Tanda tangan dibubuhkan langsung tanpa merusak format berkas"
        />
      )}

      {file && !result && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left: Input Panel */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              1. Tanda Tangan / Stempel
            </h3>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-gray-200 p-1">
              {[
                { id: 'draw', label: 'Gambar' },
                { id: 'image', label: 'Unggah PNG' },
                { id: 'text', label: 'Stempel' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStampType(t.id as any)}
                  className={`py-1.5 text-xs font-medium rounded-md transition ${
                    stampType === t.id
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Draw mode */}
            {stampType === 'draw' && (
              <div className="space-y-2">
                <div className="relative rounded-lg border border-gray-300 bg-white">
                  <canvas
                    ref={canvasRef}
                    width={380}
                    height={140}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="h-32 w-full touch-none cursor-crosshair"
                  />
                  {!signatureDataUrl && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-gray-400">
                      Goreskan tanda tangan di sini
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {['#0f172a', '#1e3a8a', '#dc2626'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setStampColor(c)}
                        className={`h-5 w-5 rounded-full border ${
                          stampColor === c ? 'ring-2 ring-blue-500' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-red-500 hover:underline"
                  >
                    Bersihkan
                  </button>
                </div>
              </div>
            )}

            {/* Image Upload mode */}
            {stampType === 'image' && (
              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      const reader = new FileReader();
                      reader.onload = () => setSignatureDataUrl(reader.result as string);
                      reader.readAsDataURL(f);
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-gray-700"
                />
                <p className="text-[11px] text-gray-400">Format PNG transparan disarankan.</p>
              </div>
            )}

            {/* Text Stamp mode */}
            {stampType === 'text' && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={textStamp}
                  onChange={(e) => setTextStamp(e.target.value)}
                  placeholder="Contoh: APPROVED / LUNAS"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900"
                />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-gray-500 text-[11px]">Warna:</span>
                  {['#1e3a8a', '#166534', '#991b1b', '#0f172a'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setStampColor(c)}
                      className={`h-5 w-5 rounded-full border ${
                        stampColor === c ? 'ring-2 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Positioning */}
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-700">
              2. Atur ukuran
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-gray-500">
                  <span>Ukuran: {scale}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={scale}
                  onChange={(e) => setScale(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500">Seret tanda tangan langsung ke posisi yang kamu mau di pratinjau.</p>
            </div>

            <button
              type="button"
              disabled={!signatureDataUrl || isProcessing}
              onClick={handleApplySignature}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              Bubuhkan ke Halaman {pageNumber} & Simpan PDF
            </button>
          </div>

          {/* Right: Preview Panel */}
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 lg:col-span-7">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-xs font-semibold text-gray-700">
                Pratinjau Halaman {pageNumber} dari {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={pageNumber <= 1}
                  onClick={() => handlePageChange(pageNumber - 1)}
                  className="rounded border border-gray-200 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-30"
                >
                  ← Sebelumnya
                </button>
                <button
                  type="button"
                  disabled={pageNumber >= totalPages}
                  onClick={() => handlePageChange(pageNumber + 1)}
                  className="rounded border border-gray-200 px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-30"
                >
                  Selanjutnya →
                </button>
              </div>
            </div>

            <div className={`relative mx-auto flex w-full items-center justify-center rounded bg-gray-50 p-2 ${previewExpanded ? 'fixed inset-3 z-50 max-h-none overflow-auto border border-gray-300 bg-white shadow-2xl' : 'max-h-[460px] overflow-hidden'}`}>
              {previewExpanded && (
                <button type="button" onClick={() => setPreviewExpanded(false)} className="absolute right-4 top-4 z-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
                  Kecilkan pratinjau
                </button>
              )}
              {pagePreviewUrl ? (
                <div
                  ref={previewPageRef}
                  onPointerMove={moveStamp}
                  onPointerUp={stopStampDrag}
                  onPointerCancel={stopStampDrag}
                  className="relative inline-block border border-gray-200 bg-white shadow-xs"
                >
                  <img
                    src={pagePreviewUrl}
                    alt="Pratinjau Halaman"
                    className={`${previewExpanded ? 'max-h-[82vh]' : 'max-h-[420px]'} w-auto object-contain`}
                  />
                  {signatureDataUrl && (
                    <div
                      onPointerDown={startStampDrag}
                      className="absolute cursor-move touch-none border border-dashed border-blue-500 bg-blue-500/20 shadow-sm"
                      style={{
                        left: `${posX}%`,
                        top: `${posY}%`,
                        width: `${scale}%`,
                        height: `${scale * 0.5}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <img
                        src={signatureDataUrl}
                        alt="Tanda Tangan"
                        draggable={false}
                        className="pointer-events-none h-full w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-xs text-gray-400 py-20">Memuat halaman...</span>
              )}
            </div>
            {!previewExpanded && pagePreviewUrl && (
              <button type="button" onClick={() => setPreviewExpanded(true)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                Perbesar pratinjau
              </button>
            )}
          </div>
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
          title="Tanda Tangan Berhasil Disematkan"
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
