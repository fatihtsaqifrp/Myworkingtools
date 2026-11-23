import { useEffect, useRef, useState } from 'react';
import { DropZone } from '../common/DropZone';
import { formatBytes, formatDuration } from '../../utils/natural-sort';

const OCR_FUNCTION_URL = '/.netlify/functions/ocr';
const MAX_FILE_SIZE = 1024 * 1024;
const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.gif,.tif,.tiff,.bmp,application/pdf,image/png,image/jpeg,image/gif,image/tiff,image/bmp';

interface OcrResponse {
  text?: unknown;
  error?: unknown;
  processingTimeMs?: unknown;
}

export function OcrTool() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);
  const [apiProcessingMs, setApiProcessingMs] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  useEffect(() => {
    if (file || isProcessing) return;

    const handlePaste = (event: ClipboardEvent) => {
      const image = Array.from(event.clipboardData?.items ?? [])
        .find((item) => item.type.startsWith('image/'))
        ?.getAsFile();
      if (!image) return;

      const extension = image.type === 'image/jpeg' ? 'jpg' : image.type.split('/')[1] || 'png';
      setFile(new File([image], `screenshot.${extension}`, { type: image.type }));
      setExtractedText('');
      setError(null);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [file, isProcessing]);

  const handleStartOcr = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setError('Paket gratis OCR.space membatasi ukuran file hingga 1 MB.');
      return;
    }

    setIsProcessing(true);
    setExtractedText('');
    setError(null);
    setElapsedSeconds(null);
    setApiProcessingMs(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const response = await fetch(OCR_FUNCTION_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      let result: OcrResponse;
      try {
        result = await response.json() as OcrResponse;
      } catch {
        throw new Error('Layanan OCR tidak tersedia. Pastikan aplikasi dijalankan melalui Netlify.');
      }

      if (!response.ok) {
        throw new Error(typeof result.error === 'string'
          ? result.error
          : `Layanan OCR gagal memproses file (HTTP ${response.status}).`);
      }

      if (typeof result.text !== 'string' || !result.text.trim()) {
        throw new Error('Tidak ada teks yang berhasil dibaca dari file ini.');
      }

      setExtractedText(result.text.trim());
      setElapsedSeconds((performance.now() - startTime) / 1000);
      const processingTime = Number(result.processingTimeMs);
      if (Number.isFinite(processingTime)) setApiProcessingMs(processingTime);
    } catch (requestError) {
      if (requestError instanceof Error && requestError.name === 'AbortError') return;
      setError(requestError instanceof TypeError
        ? 'Tidak dapat menghubungi fungsi OCR. Jalankan atau deploy aplikasi melalui Netlify.'
        : requestError instanceof Error
          ? requestError.message
          : 'Gagal memproses OCR. Coba lagi.');
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
        setIsProcessing(false);
      }
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsProcessing(false);
  };

  const handleCopy = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Tidak dapat menyalin teks. Periksa izin clipboard browser.');
    }
  };

  const handleDownloadTxt = () => {
    if (!extractedText) return;
    const blob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file?.name.replace(/\.[^.]+$/, '') || 'hasil_ocr'}_ocr.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Ekstrak Teks (OCR)</h2>
        <p className="text-xs text-gray-500">
          OCR.space Engine 3 melalui Netlify Function, dengan deteksi bahasa, tabel, dan orientasi otomatis.
        </p>
      </div>

      {!file && (
        <DropZone
          multiple={false}
          allowFolder={false}
          accept={ACCEPTED_FILES}
          fileSizeLabel="1 MB (PDF maks. 3 halaman)"
          onFilesSelected={(files) => {
            if (files[0]) {
              setFile(files[0]);
              setExtractedText('');
              setError(null);
            }
          }}
          title="Pilih PDF atau gambar untuk OCR"
          subtitle="Seret file ke sini, atau tempel screenshot dari clipboard (Cmd/Ctrl+V)"
        />
      )}

      {file && !isProcessing && !extractedText && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-xs font-bold text-gray-900">{file.name}</p>
              <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setError(null);
              }}
              className="text-xs text-red-600 hover:underline"
            >
              Ganti File
            </button>
          </div>

          <p className="text-[11px] text-amber-800">
            File dikirim ke Netlify Function lalu diteruskan ke OCR.space. Jangan proses dokumen rahasia. API key disimpan sebagai environment variable rahasia di Netlify, bukan di browser. Paket gratis: maksimal 1 MB per file dan PDF 3 halaman.
          </p>

          <button
            type="button"
            onClick={handleStartOcr}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
          >
            Mulai OCR dengan OCR.space
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center gap-3" role="status">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <div>
              <p className="text-xs font-semibold text-blue-900">OCR.space sedang membaca file...</p>
              <p className="text-[11px] text-blue-700">Waktu proses tergantung ukuran file dan antrean layanan.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Batalkan
          </button>
        </div>
      )}

      {extractedText && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
            <h3 className="text-xs font-bold text-gray-900">Teks Hasil Ekstraksi:</h3>
            <div className="flex items-center gap-2">
              {elapsedSeconds !== null && (
                <span className="text-[11px] text-gray-400">
                  Waktu: {formatDuration(elapsedSeconds)}
                  {apiProcessingMs !== null && ` (server ${formatDuration(apiProcessingMs / 1000)})`}
                </span>
              )}
              <button
                type="button"
                onClick={handleCopy}
                className="rounded border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                {copied ? 'Tersalin' : 'Salin Teks'}
              </button>
              <button
                type="button"
                onClick={handleDownloadTxt}
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
              >
                Unduh .TXT
              </button>
            </div>
          </div>

          <textarea
            readOnly
            value={extractedText}
            rows={12}
            className="w-full rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => {
              setExtractedText('');
              setFile(null);
              setError(null);
              setApiProcessingMs(null);
            }}
            className="text-xs text-gray-500 hover:underline"
          >
            ← Pindai Dokumen Lain
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Gagal: {error}
        </div>
      )}
    </div>
  );
}
