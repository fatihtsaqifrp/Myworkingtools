import { useState, useRef } from 'react';
import { DropZone } from '../common/DropZone';
import { ProgressBar } from '../common/ProgressBar';
import { ResultCard } from '../common/ResultCard';
import type { ProcessTelemetry, ProcessResult, SplitMode } from '../../types';
import { formatBytes } from '../../utils/natural-sort';

export function SplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [rangeString, setRangeString] = useState('1-3, 5');
  const [fixedPageCount, setFixedPageCount] = useState(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<ProcessTelemetry | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);

  const handleStartSplit = async () => {
    if (!file) return;

    setIsProcessing(true);
    setResult(null);
    setError(null);
    startTimeRef.current = Date.now();

    const worker = new Worker(new URL('../../workers/split.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setTelemetry((prev) => {
        if (!prev) return null;
        const speed = prev.pagesProcessed > 0 && elapsed > 0 ? prev.pagesProcessed / elapsed : 0;
        return {
          ...prev,
          elapsedSeconds: elapsed,
          speedPagesPerSec: speed,
        };
      });
    }, 500);

    setTelemetry({
      current: 0,
      total: 100,
      pagesProcessed: 0,
      currentFileName: file.name,
      speedPagesPerSec: 0,
      elapsedSeconds: 0,
      etaSeconds: null,
    });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;

      if (msg.type === 'progress') {
        setTelemetry(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          return {
            current: msg.current,
            total: msg.total,
            pagesProcessed: msg.current,
            currentFileName: msg.detail || file.name,
            speedPagesPerSec: msg.current > 0 && elapsed > 0 ? msg.current / elapsed : 0,
            elapsedSeconds: elapsed,
            etaSeconds: null,
          };
        });
      } else if (msg.type === 'done') {
        clearInterval(timerIntervalRef.current);
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob([msg.zipBuffer], { type: 'application/zip' });

        const res: ProcessResult = {
          blob,
          fileName: `${file.name.replace(/\.pdf$/i, '')}_split_bundle`,
          totalPages: msg.totalPages,
          totalFiles: msg.totalFiles,
          originalSize: file.size,
          resultSize: blob.size,
          elapsedSeconds: elapsed,
          speedPagesPerSec: msg.totalPages > 0 && elapsed > 0 ? msg.totalPages / elapsed : 0,
        };

        setResult(res);
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'error') {
        clearInterval(timerIntervalRef.current);
        setError(msg.error);
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    const buffer = await file.arrayBuffer();
    worker.postMessage(
      {
        type: 'start_split',
        fileBuffer: buffer,
        baseName: file.name,
        mode: splitMode,
        rangeString,
        fixedPageCount,
      },
      [buffer]
    );
  };

  const handleCancel = () => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    clearInterval(timerIntervalRef.current);
    setIsProcessing(false);
    setTelemetry(null);
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.zip') ? name : `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Pisahkan PDF (Split)
        </h2>
        <p className="text-xs text-gray-500">
          Pisah halaman berdasarkan rentang atau ekstrak semua halaman ke dalam arsip ZIP.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) setFile(files[0]);
          }}
          title="Pilih file PDF yang ingin dipisahkan"
          subtitle="Pilih 1 dokumen PDF"
        />
      )}

      {file && !result && !isProcessing && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-xs font-bold text-gray-900 truncate max-w-md">
                {file.name}
              </p>
              <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-xs text-red-600 hover:underline"
            >
              Ganti File
            </button>
          </div>

          {/* Mode Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-700">
              Metode Pemisahan:
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                {
                  id: 'all',
                  title: 'Ekstrak Semua Halaman',
                  desc: 'Tiap halaman menjadi 1 file PDF.',
                },
                {
                  id: 'range',
                  title: 'Rentang Halaman',
                  desc: 'Contoh: 1-5, 8, 10-15.',
                },
                {
                  id: 'fixed',
                  title: 'Per X Halaman',
                  desc: 'Bagi rata setiap beberapa halaman.',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setSplitMode(m.id as SplitMode)}
                  className={`cursor-pointer rounded-lg border p-3 transition ${
                    splitMode === m.id
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

          {/* Range Mode Input */}
          {splitMode === 'range' && (
            <div className="rounded-lg bg-gray-50 p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Tuliskan rentang halaman (pisahkan dengan koma):
              </label>
              <input
                type="text"
                value={rangeString}
                onChange={(e) => setRangeString(e.target.value)}
                placeholder="Contoh: 1-5, 8, 10-20"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900"
              />
            </div>
          )}

          {/* Fixed Mode Input */}
          {splitMode === 'fixed' && (
            <div className="rounded-lg bg-gray-50 p-3 space-y-1">
              <label className="text-xs font-medium text-gray-700">
                Pisahkan setiap berapa halaman?
              </label>
              <input
                type="number"
                min={1}
                value={fixedPageCount}
                onChange={(e) => setFixedPageCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-28 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleStartSplit}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
          >
            Pisahkan Dokumen & Buat File ZIP
          </button>
        </div>
      )}

      {isProcessing && telemetry && (
        <ProgressBar
          telemetry={telemetry}
          onCancel={handleCancel}
          title="Sedang Memisahkan Halaman & Menyusun ZIP..."
        />
      )}

      {result && (
        <ResultCard
          result={result}
          onDownload={(customName) => triggerDownload(result.blob, customName || result.fileName)}
          onReset={() => {
            setResult(null);
            setFile(null);
          }}
          title="Pemisahan Dokumen Selesai"
          isZip={true}
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
