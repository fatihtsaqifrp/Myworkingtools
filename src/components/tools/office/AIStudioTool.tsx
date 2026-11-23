import { useEffect, useRef, useState } from 'react';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerPath from 'tesseract.js/dist/worker.min.js?url';
import { OfficeToolFrame } from './OfficeToolFrame';
import { useOfficeWorker } from './useOfficeWorker';
import { formatDuration } from '../../../utils/natural-sort';

type StudioMode = 'background' | 'ocr';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}

export function AIStudioTool() {
  const [mode, setMode] = useState<StudioMode>('background');
  const [files, setFiles] = useState<File[]>([]);
  const [edgeThreshold, setEdgeThreshold] = useState(20);
  const [language, setLanguage] = useState<'eng' | 'ind'>('ind');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDetail, setOcrDetail] = useState('');
  const [copied, setCopied] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrElapsed, setOcrElapsed] = useState<number | null>(null);
  const [inputPreviewUrls, setInputPreviewUrls] = useState<string[]>([]);
  const [enlargedPreview, setEnlargedPreview] = useState<{ url: string; label: string } | null>(null);
  const cancelOcrRef = useRef(false);
  const ocrStartedRef = useRef(0);
  const ocrFileIndexRef = useRef(0);
  const tesseractRef = useRef<TesseractWorker | null>(null);
  const { status, run, stop } = useOfficeWorker();

  useEffect(() => () => {
    cancelOcrRef.current = true;
    void tesseractRef.current?.terminate();
  }, []);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setInputPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const runBackgroundRemoval = () => {
    if (!files.length) return;
    run(
      () => new Worker(new URL('../../../workers/background-removal.worker.ts', import.meta.url), { type: 'module' }),
      { files, edgeThreshold }
    );
  };

  const runOcr = async () => {
    if (!files.length) return;
    setOcrBusy(true);
    setOcrError(null);
    setOcrText('');
    setCopied(false);
    setOcrElapsed(null);
    setOcrProgress(0);
    cancelOcrRef.current = false;
    const started = performance.now();
    ocrStartedRef.current = started;
    let worker: TesseractWorker | null = null;
    try {
      if (files.length > 100) throw new Error('Maksimal 100 gambar untuk OCR per batch.');
      if (files.some((file) => file.size > 50 * 1024 * 1024)) {
        throw new Error('Ukuran maksimal setiap gambar untuk OCR adalah 50 MB.');
      }
      if (files.reduce((total, file) => total + file.size, 0) > 250 * 1024 * 1024) {
        throw new Error('Total ukuran gambar untuk OCR maksimal 250 MB per batch.');
      }
      const { createWorker } = await import('tesseract.js');
      worker = await createWorker(language, 1, {
        workerPath,
        corePath: '/assets/tesscore',
        langPath: '/assets/tessdata',
        gzip: true,
        logger: (message) => {
          if (message.status === 'recognizing text' && typeof message.progress === 'number') {
            setOcrProgress((ocrFileIndexRef.current + message.progress) / files.length);
            setOcrDetail(`Membaca ${files[ocrFileIndexRef.current]?.name ?? 'gambar'}...`);
          } else if (message.status) {
            setOcrDetail(message.status);
          }
        },
      });
      tesseractRef.current = worker;
      if (cancelOcrRef.current) return;

      const textResults: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        if (cancelOcrRef.current) break;
        ocrFileIndexRef.current = index;
        const { data } = await worker.recognize(files[index]);
        textResults.push(`--- ${files[index].name} ---\n${data.text.trim()}`);
        setOcrProgress((index + 1) / files.length);
        setOcrDetail(`Selesai membaca ${files[index].name}`);
      }

      const resultText = textResults.join('\n\n');
      if (resultText && !cancelOcrRef.current) {
        setOcrText(resultText);
        setOcrElapsed((performance.now() - started) / 1000);
        const blob = new Blob([resultText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'hasil_ocr.txt';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
    } catch (error) {
      if (!cancelOcrRef.current) {
        setOcrError(getErrorMessage(error, 'OCR gagal. Coba gambar lain.'));
      }
    } finally {
      if (worker && tesseractRef.current === worker) {
        tesseractRef.current = null;
        await worker.terminate();
      }
      setOcrBusy(false);
    }
  };

  const cancelOcr = () => {
    cancelOcrRef.current = true;
    const worker = tesseractRef.current;
    tesseractRef.current = null;
    if (worker) void worker.terminate();
    setOcrBusy(false);
  };

  const changeMode = (nextMode: StudioMode) => {
    if (ocrBusy) cancelOcr();
    if (status.busy) stop();
    setMode(nextMode);
    setFiles([]);
    setOcrError(null);
    setOcrText('');
  };

  if (mode === 'background') {
    const selectImages = (selectedFiles: File[]) => {
      setFiles(selectedFiles.filter((file) => file.type.startsWith('image/')));
    };

    return (
      <div className="space-y-4">
        <StudioModeSwitch mode={mode} onChange={changeMode} />
        <OfficeToolFrame
          title="AI Background Remover"
          description="AI memisahkan objek dari latar langsung di browser. Foto tidak dikirim ke server."
          actionLabel="Hapus latar dan unduh PNG"
          status={status}
          onSubmit={runBackgroundRemoval}
          onCancel={stop}
        >
          <label
            className="block cursor-pointer space-y-2 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/50 p-4 text-sm font-medium text-gray-700 transition hover:border-blue-400 hover:bg-blue-50"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectImages(Array.from(event.dataTransfer.files));
            }}
          >
            <span className="block">Lepas foto di sini atau klik untuk memilih</span>
            <input type="file" accept="image/*" multiple onChange={(event) => selectImages(Array.from(event.target.files ?? []))} className="block w-full rounded-lg border border-gray-200 bg-white p-2 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
            <span className="block text-xs font-normal text-gray-500">
              {files.length ? `${files.length} gambar dipilih` : 'Paling cocok untuk foto orang dan potret.'}
            </span>
          </label>
          {files.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {files.map((file, index) => (
                <button
                  key={`${file.name}-${file.lastModified}`}
                  type="button"
                  onClick={() => setEnlargedPreview({ url: inputPreviewUrls[index], label: file.name })}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:border-blue-400"
                >
                  <img src={inputPreviewUrls[index]} alt={`Pratinjau ${file.name}`} className="h-32 w-full object-contain [background-color:#f3f4f6] [background-image:linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] [background-size:16px_16px] [background-position:0_0,0_8px,8px_-8px,-8px_0]" />
                  <span className="block truncate px-2 py-1.5 text-[11px] text-gray-600">{file.name}</span>
                </button>
              ))}
            </div>
          )}
          <label className="block space-y-1.5 rounded-lg border border-gray-200 bg-white p-3 text-xs font-semibold text-gray-700">
            Bersihkan sisa latar
            <input type="range" min="0" max="160" step="5" value={edgeThreshold} onChange={(event) => setEdgeThreshold(Number(event.target.value))} className="w-full accent-blue-600" />
            <span className="block text-[11px] font-normal text-gray-500">Naikkan kalau halo latar masih menempel; turunkan kalau rambut atau tepi subjek ikut terhapus.</span>
          </label>
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
            <strong>Detail tepi ikut dirapikan:</strong> mask AI dihaluskan dengan panduan warna foto agar batas subjek lebih bersih. Model dan runtime AI diunduh saat pertama dipakai (total bisa sekitar 34 MB); foto tidak dikirim dan tetap diproses di perangkat. Hasil terbaik biasanya dari foto orang dengan subjek yang jelas.
          </p>
        </OfficeToolFrame>
        {status.finished && status.downloads.length > 0 && (
          <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Bandingkan hasil</h2>
              <p className="text-xs text-gray-500">Ketuk gambar untuk melihat pratinjau lebih besar. Latar kotak-kotak menunjukkan transparansi.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {status.downloads.map((download, index) => (
                <div key={download.name} className="space-y-2">
                  <p className="truncate text-xs font-semibold text-gray-700">{files[index]?.name ?? download.name}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[inputPreviewUrls[index], download.url].map((url, previewIndex) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setEnlargedPreview({ url, label: previewIndex === 0 ? 'Foto asli' : 'Hasil tanpa latar' })}
                        className="overflow-hidden rounded-lg border border-gray-200 text-left"
                      >
                        <img
                          src={url}
                          alt={previewIndex === 0 ? 'Foto asli' : 'Hasil tanpa latar'}
                          className="h-44 w-full object-contain [background-color:#f3f4f6] [background-image:linear-gradient(45deg,#e5e7eb_25%,transparent_25%),linear-gradient(-45deg,#e5e7eb_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e5e7eb_75%),linear-gradient(-45deg,transparent_75%,#e5e7eb_75%)] [background-size:16px_16px] [background-position:0_0,0_8px,8px_-8px,-8px_0]"
                        />
                        <span className="block px-2 py-1 text-[10px] text-gray-500">{previewIndex === 0 ? 'Asli' : 'Hasil'}</span>
                      </button>
                    ))}
                  </div>
                  <a href={download.url} download={download.name} className="block text-xs font-semibold text-blue-700 underline underline-offset-2">Unduh PNG</a>
                </div>
              ))}
            </div>
          </section>
        )}
        {enlargedPreview && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Pratinjau besar: ${enlargedPreview.label}`}
            onClick={() => setEnlargedPreview(null)}
          >
            <button type="button" onClick={() => setEnlargedPreview(null)} className="absolute right-4 top-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-gray-900">Tutup</button>
            <figure className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
              <img src={enlargedPreview.url} alt={enlargedPreview.label} className="max-h-[88vh] max-w-[92vw] object-contain" />
              <figcaption className="mt-2 text-center text-sm text-white">{enlargedPreview.label}</figcaption>
            </figure>
          </div>
        )}
      </div>
    );
  }

  const ocrStatus = {
    ...status,
    busy: ocrBusy,
    current: Math.round(ocrProgress * 100),
    total: 100,
    detail: ocrDetail,
    rate: 0,
    elapsedSeconds: ocrBusy ? (performance.now() - ocrStartedRef.current) / 1000 : ocrElapsed ?? 0,
    error: ocrError,
    finished: false,
    outputCount: 0,
    downloads: [],
  };

  return (
    <div className="space-y-4">
      <StudioModeSwitch mode={mode} onChange={changeMode} />
      <OfficeToolFrame
        title="Bulk Image OCR"
        description="Ekstrak teks dari banyak gambar struk atau dokumen dalam Bahasa Indonesia atau English; hasil dapat disalin dan diunduh."
        actionLabel="Ekstrak teks dan unduh TXT"
        status={ocrStatus}
        onSubmit={runOcr}
        onCancel={cancelOcr}
      >
        <label className="block space-y-2 text-sm font-medium text-gray-700">
          Pilih gambar untuk OCR
          <input required type="file" accept="image/*" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="block w-full rounded-xl border border-gray-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
        </label>
        <label className="block space-y-1.5 text-xs font-semibold text-gray-600">
          Bahasa utama
          <select value={language} onChange={(event) => setLanguage(event.target.value as 'eng' | 'ind')} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
            <option value="ind">Bahasa Indonesia</option>
            <option value="eng">English</option>
          </select>
        </label>
        {ocrBusy && (
          <p className="text-xs text-gray-500">Waktu berjalan: {formatDuration((performance.now() - ocrStartedRef.current) / 1000)} · model bahasa tersedia lokal.</p>
        )}
        {ocrText && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Selesai dalam {formatDuration(ocrElapsed ?? 0)}.</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Hasil OCR</span>
              <button type="button" onClick={() => {
                void navigator.clipboard.writeText(ocrText).then(() => setCopied(true)).catch((error: unknown) => setOcrError(getErrorMessage(error, 'Tidak dapat menyalin teks.')));
              }} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                {copied ? 'Tersalin' : 'Salin teks'}
              </button>
            </div>
            <textarea readOnly value={ocrText} rows={10} className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs" />
          </div>
        )}
      </OfficeToolFrame>
    </div>
  );
}

function StudioModeSwitch({ mode, onChange }: { mode: StudioMode; onChange: (mode: StudioMode) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-gray-200 bg-white p-1">
      <button type="button" onClick={() => onChange('background')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'background' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
        Hapus Latar
      </button>
      <button type="button" onClick={() => onChange('ocr')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${mode === 'ocr' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
        OCR Gambar
      </button>
    </div>
  );
}
