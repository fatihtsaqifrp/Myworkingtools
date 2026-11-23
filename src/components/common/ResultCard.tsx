import { useState } from 'react';
import type { ProcessResult } from '../../types';
import { formatBytes, formatDuration } from '../../utils/natural-sort';

interface ResultCardProps {
  result: ProcessResult;
  onDownload: (customName?: string) => void;
  onReset: () => void;
  title?: string;
  isZip?: boolean;
}

export function ResultCard({
  result,
  onDownload,
  onReset,
  title = 'Selesai!',
  isZip = false,
}: ResultCardProps) {
  const [fileName, setFileName] = useState(result.fileName);

  const sizeSavings =
    result.originalSize && result.resultSize && result.originalSize > result.resultSize
      ? Math.round(((result.originalSize - result.resultSize) / result.originalSize) * 100)
      : null;

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">
            {result.totalPages ? `${result.totalPages.toLocaleString('id-ID')} halaman • ` : ''}
            Ukuran: {formatBytes(result.resultSize || result.blob.size)}
            {sizeSavings !== null && (
              <span className="ml-1 text-emerald-600 font-semibold">
                (Hemat {sizeSavings}%)
              </span>
            )}
          </p>
        </div>

        <span className="text-xs text-gray-400">
          Waktu: {formatDuration(result.elapsedSeconds)}
        </span>
      </div>

      {/* Skipped files warning if any */}
      {result.skippedFiles && result.skippedFiles.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-semibold">
            {result.skippedFiles.length} file dilewati (rusak / ber-password):
          </p>
          <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto pl-4 list-disc">
            {result.skippedFiles.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.name}</span>: {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Output Filename */}
      <div>
        <label className="text-xs font-medium text-gray-700">Nama file hasil:</label>
        <div className="mt-1 flex rounded-lg border border-gray-300 bg-white">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="flex-1 px-3 py-2 text-xs text-gray-900 focus:outline-none"
            placeholder="hasil"
          />
          <span className="flex items-center pr-3 text-xs text-gray-400">
            {isZip ? '.zip' : '.pdf'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onDownload(fileName)}
          className="flex-1 rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
        >
          Unduh {isZip ? 'File ZIP' : 'Dokumen PDF'}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
        >
          Mulai Baru
        </button>
      </div>
    </div>
  );
}
