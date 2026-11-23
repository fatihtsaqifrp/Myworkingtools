import { useState, useRef } from 'react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DropZone } from '../common/DropZone';
import { ResultCard } from '../common/ResultCard';
import type { PageThumbnailItem, ProcessResult } from '../../types';
import { pdfjsLib, renderPageToDataUrl, renderThumbnail } from '../../utils/pdfjs-config';

export function OrganizeTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumbnailItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPage, setPreviewPage] = useState<{ label: string; url: string; rotation: number } | null>(null);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileBuffersRef = useRef<ArrayBuffer[]>([]);
  const sourceFilesRef = useRef<File[]>([]);
  const pageCountRef = useRef(0);

  const loadPdfThumbnails = async (selectedFile: File, append = false) => {
    setError(null);
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    try {
      if (selectedFile.size > 100 * 1024 * 1024) {
        throw new Error(`${selectedFile.name}: ukuran maksimal per PDF adalah 100 MB.`);
      }
      const buffer = await selectedFile.arrayBuffer();

      const sourceFileIndex = append ? sourceFilesRef.current.length : 0;
      loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const pdfDoc = await loadingTask.promise;
      const count = pdfDoc.numPages;
      const currentPageCount = append ? pageCountRef.current : 0;
      if (count + currentPageCount > 1000) {
        throw new Error('Maksimal 1.000 halaman dalam satu dokumen hasil.');
      }

      const firstPageNumber = currentPageCount + 1;
      const items: PageThumbnailItem[] = [];
      for (let i = 1; i <= count; i++) {
        items.push({
          pageNumber: firstPageNumber + i - 1,
          originalPageNumber: i,
          sourceFileIndex,
          rotation: 0,
          deleted: false,
        });
      }
      if (append) {
        sourceFilesRef.current = [...sourceFilesRef.current, selectedFile];
        fileBuffersRef.current = [...fileBuffersRef.current, buffer];
        setPages((previous) => [...previous, ...items]);
      } else {
        sourceFilesRef.current = [selectedFile];
        fileBuffersRef.current = [buffer];
        setPages(items);
      }
      pageCountRef.current = currentPageCount + count;

      for (let i = 1; i <= count; i++) {
        try {
          const thumb = await renderThumbnail(pdfDoc, i, 160);
          setPages((prev) =>
            prev.map((p) => (p.pageNumber === firstPageNumber + i - 1 ? { ...p, thumbnailUrl: thumb } : p))
          );
        } catch {
          // Ignore thumb render error
        }
      }
      await loadingTask.destroy();
      loadingTask = null;
    } catch (err) {
      await loadingTask?.destroy();
      setError(err instanceof Error ? err.message : 'Gagal membaca dokumen PDF');
    }
  };

  const loadInitialPdf = async (selectedFile: File) => {
    setFile(selectedFile);
    fileBuffersRef.current = [];
    sourceFilesRef.current = [];
    pageCountRef.current = 0;
    setPages([]);
    setIsLoadingFiles(true);
    try {
      await loadPdfThumbnails(selectedFile);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleAddPdfs = async (selectedFiles: File[]) => {
    if (isLoadingFiles || isProcessing) return;
    const pdfFiles = selectedFiles.filter((selectedFile) => selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf'));
    if (!pdfFiles.length) {
      setError('Pilih atau lepaskan file PDF untuk menambahkan halaman.');
      return;
    }
    if (pdfFiles.length !== selectedFiles.length) {
      setError('Semua file harus berupa PDF. File yang dipilih tidak ditambahkan.');
      return;
    }
    if (sourceFilesRef.current.length + pdfFiles.length > 20) {
      setError('Maksimal 20 file PDF dapat digabungkan dalam satu dokumen.');
      return;
    }
    const totalBytes = sourceFilesRef.current.reduce((total, source) => total + source.size, 0)
      + pdfFiles.reduce((total, selectedFile) => total + selectedFile.size, 0);
    if (totalBytes > 250 * 1024 * 1024) {
      setError('Total ukuran semua PDF maksimal 250 MB.');
      return;
    }
    setIsLoadingFiles(true);
    try {
      for (const selectedFile of pdfFiles) {
        await loadPdfThumbnails(selectedFile, true);
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleRotate = (pageNumber: number, delta: number) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p
      )
    );
  };

  const handleRotateAll = (delta: number) => {
    setPages((prev) =>
      prev.map((p) => (!p.deleted ? { ...p, rotation: (p.rotation + delta + 360) % 360 } : p))
    );
  };

  const handleDelete = (pageNumber: number) => {
    setPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, deleted: !p.deleted } : p))
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setPages((current) => {
      const oldIndex = current.findIndex((page) => page.pageNumber === active.id);
      const newIndex = current.findIndex((page) => page.pageNumber === over.id);
      return oldIndex < 0 || newIndex < 0 ? current : arrayMove(current, oldIndex, newIndex);
    });
  };

  const showPagePreview = async (item: PageThumbnailItem) => {
    const fileIndex = item.sourceFileIndex ?? 0;
    const sourceFile = sourceFilesRef.current[fileIndex];
    const buffer = fileBuffersRef.current[fileIndex];
    if (!sourceFile || !buffer) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewPage(null);
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    try {
      task = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const doc = await task.promise;
      const { dataUrl } = await renderPageToDataUrl(doc, item.originalPageNumber, 1.8, 0.9);
      setPreviewPage({ label: `${sourceFile.name} · halaman ${item.originalPageNumber}`, url: dataUrl ?? '', rotation: item.rotation });
    } catch (previewError) {
      setPreviewOpen(false);
      setError(previewError instanceof Error ? previewError.message : 'Gagal memperbesar pratinjau halaman.');
    } finally {
      await task?.destroy();
      setPreviewLoading(false);
    }
  };

  const handleExport = () => {
    if (!fileBuffersRef.current.length) return;

    setIsProcessing(true);
    setError(null);
    const startTime = Date.now();
    const worker = new Worker(new URL('../../workers/watermark.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'done') {
        const blob = new Blob([msg.pdfBuffer], { type: 'application/pdf' });
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        setResult({
          blob,
          fileName: `${file?.name.replace(/\.pdf$/i, '')}_organized`,
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

    const buffers = fileBuffersRef.current.map((buffer) => buffer.slice(0));
    worker.postMessage(
      {
        type: 'organize_pages',
        fileBuffers: buffers,
        pageConfig: pages,
      },
      buffers
    );
  };

  const activePagesCount = pages.filter((p) => !p.deleted).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Atur & Gabungkan Halaman PDF
        </h2>
        <p className="text-xs text-gray-500">
          Tambahkan halaman dari PDF lain, lalu putar, hapus, atau susun ulang sebelum menyimpan.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) void loadInitialPdf(files[0]);
          }}
          title="Pilih dokumen PDF untuk diatur"
          subtitle="Thumbnail seluruh halaman akan dimuat langsung di browser"
        />
      )}

      {file && !result && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <p className="text-xs font-bold text-gray-900 truncate max-w-sm">
                {sourceFilesRef.current.length > 1
                  ? `${sourceFilesRef.current.length} file PDF`
                  : file.name}
              </p>
              <p className="text-[11px] text-gray-400">
                {activePagesCount} dari {pages.length} halaman aktif
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                Tambah PDF
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  disabled={isLoadingFiles || isProcessing}
                  onChange={(event) => {
                    void handleAddPdfs(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => handleRotateAll(90)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Putar Semua (90°)
              </button>

              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPages([]);
                  fileBuffersRef.current = [];
                  sourceFilesRef.current = [];
                  pageCountRef.current = 0;
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Ganti File
              </button>
            </div>
          </div>
          {isLoadingFiles && (
            <p role="status" className="text-xs text-blue-700">Memuat halaman PDF tambahan...</p>
          )}

          <div
            className={`relative rounded-xl transition ${isDraggingPdf ? 'bg-blue-50 ring-2 ring-dashed ring-blue-400' : ''}`}
            onDragEnter={(event) => {
              if (Array.from(event.dataTransfer.types).includes('Files')) setIsDraggingPdf(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingPdf(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingPdf(false);
              void handleAddPdfs(Array.from(event.dataTransfer.files));
            }}
          >
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={pages.map((item) => item.pageNumber)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {pages.map((item) => (
                    <SortablePageCard
                      key={item.pageNumber}
                      item={item}
                      fileName={sourceFilesRef.current[item.sourceFileIndex ?? 0]?.name ?? file.name}
                      multipleFiles={sourceFilesRef.current.length > 1}
                      onPreview={() => void showPagePreview(item)}
                      onRotate={handleRotate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {isDraggingPdf && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-blue-50/90 text-sm font-semibold text-blue-800">
                Lepaskan PDF untuk menambahkan halaman
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-gray-500">Seret kartu halaman untuk mengubah urutan. Klik thumbnail untuk memperbesar.</p>

          <button
            type="button"
            disabled={activePagesCount === 0 || isProcessing || isLoadingFiles}
            onClick={handleExport}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
          >
            Simpan Dokumen ({activePagesCount} Halaman)
          </button>
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
            setPages([]);
            fileBuffersRef.current = [];
            sourceFilesRef.current = [];
            pageCountRef.current = 0;
          }}
          title="Penataan Halaman Selesai"
        />
      )}

      {previewOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau halaman PDF"
          onClick={() => setPreviewOpen(false)}
        >
          <button type="button" onClick={() => setPreviewOpen(false)} className="absolute right-4 top-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-800">Tutup</button>
          {previewLoading ? <p className="text-sm text-white">Memuat pratinjau...</p> : previewPage && (
            <figure className="max-h-full max-w-full" onClick={(event) => event.stopPropagation()}>
              <img src={previewPage.url} alt={previewPage.label} className="max-h-[88vh] max-w-[92vw] object-contain" style={{ transform: `rotate(${previewPage.rotation}deg)` }} />
              <figcaption className="mt-2 text-center text-xs text-white">{previewPage.label}</figcaption>
            </figure>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Gagal: {error}
        </div>
      )}
    </div>
  );
}

function SortablePageCard({
  item,
  fileName,
  multipleFiles,
  onPreview,
  onRotate,
  onDelete,
}: {
  item: PageThumbnailItem;
  fileName: string;
  multipleFiles: boolean;
  onPreview: () => void;
  onRotate: (pageNumber: number, delta: number) => void;
  onDelete: (pageNumber: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.pageNumber });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-col items-center rounded-lg border p-2.5 transition ${
        item.deleted ? 'border-red-200 bg-red-50/50 opacity-40' : 'border-gray-200 bg-white hover:border-gray-300'
      } ${isDragging ? 'z-20 opacity-60 shadow-lg' : ''}`}
    >
      <button type="button" onClick={onPreview} className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded bg-gray-50" aria-label={`Perbesar halaman ${item.originalPageNumber}`}>
        {item.thumbnailUrl ? (
          <img
            src={item.thumbnailUrl}
            alt={`Halaman ${item.originalPageNumber} · ${fileName}`}
            className="max-h-full max-w-full object-contain"
            style={{ transform: `rotate(${item.rotation}deg)` }}
          />
        ) : <span className="text-[11px] text-gray-400">Memuat...</span>}
        {item.deleted && (
          <span className="absolute inset-0 flex items-center justify-center bg-red-600/20">
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">Dihapus</span>
          </span>
        )}
      </button>
      <div className="mt-2 flex w-full items-center justify-between gap-1 text-xs">
        <span className="truncate font-semibold text-gray-700">
          {multipleFiles ? `${fileName} · hal ${item.originalPageNumber}` : `Hal #${item.originalPageNumber}`}
        </span>
        {item.rotation > 0 && <span className="text-[10px] text-gray-400">{item.rotation}°</span>}
      </div>
      <div className="mt-2 flex w-full items-center justify-between border-t border-gray-100 pt-1.5 text-[11px]">
        <div className="flex gap-1">
          <button type="button" onClick={() => onRotate(item.pageNumber, -90)} className="text-gray-500 hover:text-blue-600" title="Putar Kiri 90°">↺</button>
          <button type="button" onClick={() => onRotate(item.pageNumber, 90)} className="text-gray-500 hover:text-blue-600" title="Putar Kanan 90°">↻</button>
        </div>
        <button type="button" onClick={() => onDelete(item.pageNumber)} className={`font-medium ${item.deleted ? 'text-blue-600 hover:underline' : 'text-red-500 hover:underline'}`}>
          {item.deleted ? 'Batal' : 'Hapus'}
        </button>
        <button type="button" {...attributes} {...listeners} className="cursor-grab touch-none rounded px-1 text-gray-500 hover:bg-gray-100 active:cursor-grabbing" aria-label={`Seret halaman ${item.originalPageNumber}`} title="Seret untuk mengubah urutan">
          ⠿
        </button>
      </div>
    </div>
  );
}
