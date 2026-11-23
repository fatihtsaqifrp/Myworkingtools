import { useState, useRef } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DropZone } from '../common/DropZone';
import { ProgressBar } from '../common/ProgressBar';
import { ResultCard } from '../common/ResultCard';
import type { PDFFileItem, ProcessTelemetry, ProcessResult } from '../../types';
import { naturalSort, formatBytes } from '../../utils/natural-sort';

export function MergeTool() {
  const [files, setFiles] = useState<PDFFileItem[]>([]);
  const [outputFileName, setOutputFileName] = useState('merged_document');
  const [autoDownload, setAutoDownload] = useState(true);
  const [sortOrder, setSortOrder] = useState<'custom' | 'name-asc' | 'name-desc' | 'date-desc'>('custom');

  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetry, setTelemetry] = useState<ProcessTelemetry | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const filesRef = useRef<PDFFileItem[]>([]);
  const startTimeRef = useRef<number>(0);
  const timerIntervalRef = useRef<any>(null);

  const handleFilesSelected = (newFiles: File[]) => {
    const items: PDFFileItem[] = newFiles.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: f,
      name: f.name,
      size: f.size,
      lastModified: f.lastModified,
    }));

    setFiles((prev) => {
      const existing = new Set(prev.map((p) => `${p.name}_${p.size}`));
      const unique = items.filter((i) => !existing.has(`${i.name}_${i.size}`));
      return [...prev, ...unique];
    });
  };

  const handleSort = (mode: 'custom' | 'name-asc' | 'name-desc' | 'date-desc') => {
    setSortOrder(mode);
    if (mode === 'custom') return;

    if (mode === 'name-asc') {
      setFiles((prev) => naturalSort(prev, (f) => f.name, 'asc'));
    } else if (mode === 'name-desc') {
      setFiles((prev) => naturalSort(prev, (f) => f.name, 'desc'));
    } else if (mode === 'date-desc') {
      setFiles((prev) => [...prev].sort((a, b) => b.lastModified - a.lastModified));
    }
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    setFiles((current) => {
      const oldIndex = current.findIndex((file) => file.id === active.id);
      const newIndex = current.findIndex((file) => file.id === over.id);
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
    setSortOrder('custom');
  };

  const handleStartMerge = () => {
    if (files.length < 2) return;

    setIsProcessing(true);
    setResult(null);
    setError(null);
    filesRef.current = files;
    startTimeRef.current = Date.now();

    const worker = new Worker(new URL('../../workers/merge.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    timerIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      setTelemetry((prev) => {
        if (!prev) return null;
        const speed = prev.pagesProcessed > 0 && elapsed > 0 ? prev.pagesProcessed / elapsed : 0;
        const remainingPages = Math.max(0, prev.total - prev.current);
        const eta = speed > 0 ? remainingPages / (speed / 15) : null;
        return {
          ...prev,
          elapsedSeconds: elapsed,
          speedPagesPerSec: speed,
          etaSeconds: eta,
        };
      });
    }, 500);

    setTelemetry({
      current: 0,
      total: files.length,
      pagesProcessed: 0,
      currentFileName: files[0]?.name || '',
      speedPagesPerSec: 0,
      elapsedSeconds: 0,
      etaSeconds: null,
    });

    worker.onmessage = async (e: MessageEvent) => {
      const msg = e.data;

      if (msg.type === 'request_batch') {
        const { startIndex, count } = msg;
        const slice = filesRef.current.slice(startIndex, startIndex + count);
        const batchFiles: { name: string; buffer: ArrayBuffer }[] = [];

        for (const item of slice) {
          try {
            const buf = await item.file.arrayBuffer();
            batchFiles.push({ name: item.name, buffer: buf });
          } catch {
            batchFiles.push({ name: item.name, buffer: new ArrayBuffer(0) });
          }
        }

        const transferables = batchFiles.map((b) => b.buffer);
        worker.postMessage(
          {
            type: 'batch_data',
            files: batchFiles,
            startIndex,
          },
          transferables
        );
      } else if (msg.type === 'progress') {
        setTelemetry((prev) => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const speed = msg.pagesProcessed > 0 && elapsed > 0 ? msg.pagesProcessed / elapsed : 0;
          return {
            current: msg.currentFile,
            total: msg.totalFiles,
            pagesProcessed: msg.pagesProcessed,
            currentFileName: msg.fileName,
            speedPagesPerSec: speed,
            elapsedSeconds: elapsed,
            etaSeconds: prev?.etaSeconds || null,
          };
        });
      } else if (msg.type === 'done') {
        clearInterval(timerIntervalRef.current);
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob([msg.pdfBuffer], { type: 'application/pdf' });
        const speed = msg.totalPages > 0 && elapsed > 0 ? msg.totalPages / elapsed : 0;

        const res: ProcessResult = {
          blob,
          fileName: outputFileName.trim() || 'merged_document',
          totalPages: msg.totalPages,
          totalFiles: filesRef.current.length,
          originalSize: filesRef.current.reduce((sum, f) => sum + f.size, 0),
          resultSize: blob.size,
          elapsedSeconds: elapsed,
          speedPagesPerSec: speed,
          skippedFiles: msg.skippedFiles,
        };

        setResult(res);
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;

        if (autoDownload) {
          triggerDownload(blob, res.fileName);
        }
      } else if (msg.type === 'error') {
        clearInterval(timerIntervalRef.current);
        setError(msg.error);
        setIsProcessing(false);
        worker.terminate();
        workerRef.current = null;
      }
    };

    worker.postMessage({
      type: 'init',
      totalFiles: files.length,
      batchSize: 30,
    });
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
    a.download = name.endsWith('.pdf') ? name : `${name}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Gabungkan PDF (Merge)
        </h2>
        <p className="text-xs text-gray-500">
          Gabungkan beberapa file PDF menjadi satu. Waktu proses bergantung pada ukuran dan kompleksitas PDF serta perangkat Anda.
        </p>
      </div>

      {!result && (
        <DropZone
          onFilesSelected={handleFilesSelected}
          disabled={isProcessing}
          title="Seret file PDF ke sini"
          subtitle="atau klik tombol di bawah untuk memilih file / folder"
        />
      )}

      {files.length > 0 && !result && !isProcessing && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          {/* Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <span className="text-xs font-bold text-gray-900">
                {files.length} file dipilih
              </span>
              <span className="ml-2 text-xs text-gray-400">
                ({formatBytes(files.reduce((s, f) => s + f.size, 0))})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={sortOrder}
                onChange={(e) => handleSort(e.target.value as any)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
              >
                <option value="custom">Urutan Manual</option>
                <option value="name-asc">Nama A → Z</option>
                <option value="name-desc">Nama Z → A</option>
                <option value="date-desc">Terbaru</option>
              </select>

              <button
                type="button"
                onClick={() => setFiles([])}
                className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
              >
                Kosongkan
              </button>
            </div>
          </div>

          {/* Files List */}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-2">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={files.map((file) => file.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {files.map((file, idx) => (
                    <SortableFileRow
                      key={file.id}
                      file={file}
                      index={idx}
                      canReorder={sortOrder === 'custom'}
                      onRemove={() => handleRemove(file.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          {sortOrder === 'custom' && (
            <p className="text-[11px] text-gray-500">Seret ikon di kiri file untuk mengubah urutan penggabungan.</p>
          )}

          {/* Settings */}
          <div className="pt-2 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 max-w-sm">
                <label className="text-xs font-medium text-gray-700">Nama file hasil:</label>
                <div className="mt-1 flex rounded-lg border border-gray-300 bg-white">
                  <input
                    type="text"
                    value={outputFileName}
                    onChange={(e) => setOutputFileName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs text-gray-900 focus:outline-none"
                    placeholder="merged_document"
                  />
                  <span className="flex items-center pr-3 text-xs text-gray-400">.pdf</span>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pt-2 sm:pt-0">
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Unduh otomatis setelah selesai</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleStartMerge}
              disabled={files.length < 2}
              className="w-full rounded-lg bg-blue-600 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
            >
              Gabungkan {files.length} File PDF
            </button>
          </div>
        </div>
      )}

      {isProcessing && telemetry && (
        <ProgressBar
          telemetry={telemetry}
          onCancel={handleCancel}
          title="Sedang Menggabungkan Dokumen..."
        />
      )}

      {result && (
        <ResultCard
          result={result}
          onDownload={(customName) => triggerDownload(result.blob, customName || result.fileName)}
          onReset={() => {
            setResult(null);
            setFiles([]);
          }}
          title="File PDF Berhasil Digabungkan"
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

function SortableFileRow({
  file,
  index,
  canReorder,
  onRemove,
}: {
  file: PDFFileItem;
  index: number;
  canReorder: boolean;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id, disabled: !canReorder });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs ${
        isDragging ? 'z-10 opacity-50' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {canReorder ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="touch-none cursor-grab text-gray-400 active:cursor-grabbing"
            aria-label={`Seret untuk mengubah urutan ${file.name}`}
            {...attributes}
            {...listeners}
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
              <circle cx="5" cy="3" r="1.25" />
              <circle cx="11" cy="3" r="1.25" />
              <circle cx="5" cy="8" r="1.25" />
              <circle cx="11" cy="8" r="1.25" />
              <circle cx="5" cy="13" r="1.25" />
              <circle cx="11" cy="13" r="1.25" />
            </svg>
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <span className="w-6 shrink-0 font-mono text-gray-400">#{index + 1}</span>
        <span className="truncate font-medium text-gray-800" title={file.name}>
          {file.name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-[11px] text-gray-400">{formatBytes(file.size)}</span>
        <button type="button" onClick={onRemove} className="text-xs text-red-500 hover:underline">
          Hapus
        </button>
      </div>
    </div>
  );
}
