import { useState, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import { DropZone } from '../common/DropZone';
import { ProgressBar } from '../common/ProgressBar';
import { ResultCard } from '../common/ResultCard';
import type { ProcessTelemetry, ProcessResult, CompressionLevel } from '../../types';
import { pdfjsLib, renderPageToDataUrl } from '../../utils/pdfjs-config';
import { formatBytes } from '../../utils/natural-sort';

export function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('medium');

  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<ProcessTelemetry | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCancelledRef = useRef(false);

  const handleStartCompress = async () => {
    if (!file) return;

    setIsProcessing(true);
    setResult(null);
    setError(null);
    isCancelledRef.current = false;
    const startTime = Date.now();

    try {
      const buffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdfDoc = await loadingTask.promise;
      const totalPages = pdfDoc.numPages;

      const newPdfDoc = await PDFDocument.create();

      let scale = 1.0;
      let quality = 0.65;
      if (level === 'low') {
        scale = 1.3;
        quality = 0.85;
      } else if (level === 'extreme') {
        scale = 0.75;
        quality = 0.45;
      }

      for (let i = 1; i <= totalPages; i++) {
        if (isCancelledRef.current) {
          setIsProcessing(false);
          setTelemetry(null);
          return;
        }

        const elapsed = (Date.now() - startTime) / 1000;
        const speed = i > 0 && elapsed > 0 ? i / elapsed : 0;
        const remaining = totalPages - i;
        const eta = speed > 0 ? remaining / speed : null;

        setTelemetry({
          current: i,
          total: totalPages,
          pagesProcessed: i,
          currentFileName: `Halaman ${i} dari ${totalPages}...`,
          speedPagesPerSec: speed,
          elapsedSeconds: elapsed,
          etaSeconds: eta,
        });

        const { blob, width, height } = await renderPageToDataUrl(pdfDoc, i, scale, quality, 'blob');
        const imgBytes = await blob.arrayBuffer();

        const embeddedImage = await newPdfDoc.embedJpg(imgBytes);

        const ptWidth = width / scale;
        const ptHeight = height / scale;

        const page = newPdfDoc.addPage([ptWidth, ptHeight]);
        page.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: ptWidth,
          height: ptHeight,
        });

        if (i % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const compressedBytes = await newPdfDoc.save({ useObjectStreams: false });
      const compressedBlob = new Blob([compressedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const elapsed = (Date.now() - startTime) / 1000;

      setResult({
        blob: compressedBlob,
        fileName: `${file.name.replace(/\.pdf$/i, '')}_compressed`,
        totalPages,
        originalSize: file.size,
        resultSize: compressedBlob.size,
        elapsedSeconds: elapsed,
        speedPagesPerSec: totalPages > 0 && elapsed > 0 ? totalPages / elapsed : 0,
      });

      setIsProcessing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengompresi PDF');
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    setTelemetry(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Kompres PDF (Kecilkan Ukuran)
        </h2>
        <p className="text-xs text-gray-500">
          Perkecil ukuran PDF hasil scan dengan pilihan kualitas Ringan, Sedang, atau Ekstrem.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) setFile(files[0]);
          }}
          title="Pilih dokumen PDF yang ingin dikompres"
          subtitle="Cocok untuk PDF scan yang berukuran besar"
        />
      )}

      {file && !result && !isProcessing && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-xs font-bold text-gray-900 truncate max-w-md">
                {file.name}
              </p>
              <p className="text-[11px] text-gray-400">Ukuran awal: {formatBytes(file.size)}</p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-red-600 hover:underline"
            >
              Ganti File
            </button>
          </div>

          {/* Level Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">
              Tingkat Kompresi:
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  id: 'extreme',
                  title: 'Kompresi Ekstrem',
                  desc: 'Ukuran paling kecil (hemat s/d 80%).',
                },
                {
                  id: 'medium',
                  title: 'Sedang (Rekomendasi)',
                  desc: 'Teks tetap jelas, ukuran hemat ~50%.',
                },
                {
                  id: 'low',
                  title: 'Kompresi Ringan',
                  desc: 'Kualitas gambar maksimal, hemat ~25%.',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setLevel(m.id as CompressionLevel)}
                  className={`cursor-pointer rounded-lg border p-3 transition ${
                    level === m.id
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-xs font-bold">{m.title}</p>
                  <p className="mt-1 text-[11px] text-gray-500">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartCompress}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
          >
            Mulai Kompresi PDF
          </button>
        </div>
      )}

      {isProcessing && telemetry && (
        <ProgressBar
          telemetry={telemetry}
          onCancel={handleCancel}
          title="Sedang Mengompresi Halaman PDF..."
        />
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
          title="Kompresi PDF Selesai"
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
