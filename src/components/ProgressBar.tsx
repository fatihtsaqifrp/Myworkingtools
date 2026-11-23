import { useMemo } from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  fileName: string;
  startTime: number | null;
  onCancel: () => void;
}

export function ProgressBar({ current, total, fileName, startTime, onCancel }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  const eta = useMemo(() => {
    if (!startTime || current === 0) return null;

    const elapsed = (Date.now() - startTime) / 1000;
    const rate = current / elapsed;
    const remaining = (total - current) / rate;

    if (remaining < 60) return `sekitar ${Math.ceil(remaining)} detik lagi`;
    if (remaining < 3600) return `sekitar ${Math.ceil(remaining / 60)} menit lagi`;
    return `sekitar ${(remaining / 3600).toFixed(1)} jam lagi`;
  }, [current, total, startTime]);

  return (
    <section className="border-t border-ink pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-serif text-xl font-medium text-ink">Sedang menggabungkan…</p>
        <p className="font-mono text-2xl tabular-nums text-blue">{percentage}%</p>
      </div>

      <div className="mt-4 h-1 w-full bg-line">
        <div
          className="h-full bg-blue transition-[width] duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted">
        <span>
          <span className="font-mono tabular-nums text-ink">{current}</span> dari{' '}
          <span className="font-mono tabular-nums text-ink">{total}</span> file
          {eta && <> &middot; {eta}</>}
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-red underline decoration-1 underline-offset-4 hover:no-underline"
        >
          Batalkan
        </button>
      </div>

      <p className="mt-2 truncate font-mono text-xs text-muted" title={fileName}>
        {fileName}
      </p>
    </section>
  );
}
