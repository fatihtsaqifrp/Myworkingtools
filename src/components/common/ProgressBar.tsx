import type { ProcessTelemetry } from '../../types';

interface ProgressBarProps {
  telemetry: ProcessTelemetry;
  onCancel: () => void;
  title?: string;
}

export function ProgressBar({ telemetry, onCancel, title = 'Sedang Memproses...' }: ProgressBarProps) {
  const { current, total, pagesProcessed, currentFileName, speedPagesPerSec, elapsedSeconds, etaSeconds } =
    telemetry;

  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
          <h4 className="text-xs font-bold text-blue-900">{title}</h4>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          Batalkan
        </button>
      </div>

      {/* Progress Track */}
      <div className="h-2 overflow-hidden rounded-full bg-blue-200/60">
        <div
          className="h-full bg-blue-600 transition-all duration-200 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Telemetry Stats */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-blue-900">
        <span>
          Memproses <strong>{current.toLocaleString('id-ID')}</strong> dari{' '}
          <strong>{total.toLocaleString('id-ID')}</strong> ({percent}%)
        </span>

        <div className="flex items-center gap-3 text-[11px] text-blue-700">
          <span>Durasi: {formatTime(elapsedSeconds)}</span>
          {speedPagesPerSec > 0 && <span>Kecepatan: {speedPagesPerSec.toFixed(0)} hal/dtk</span>}
          {etaSeconds && etaSeconds > 0 && <span>Sisa: ~{formatTime(etaSeconds)}</span>}
        </div>
      </div>

      {/* Current File */}
      {currentFileName && (
        <p className="truncate text-[11px] text-gray-500" title={currentFileName}>
          File: {currentFileName}
        </p>
      )}
    </div>
  );
}
