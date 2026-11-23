import type { FormEvent, ReactNode } from 'react';
import type { OfficeJobStatus } from './useOfficeWorker';
import { formatDuration } from '../../../utils/natural-sort';

interface OfficeToolFrameProps {
  title: string;
  description: string;
  actionLabel: string;
  status: OfficeJobStatus;
  onSubmit: () => void;
  onCancel: () => void;
  children: ReactNode;
}

export function OfficeToolFrame({
  title,
  description,
  actionLabel,
  status,
  onSubmit,
  onCancel,
  children,
}: OfficeToolFrameProps) {
  const progress = status.total > 0 ? Math.min(100, Math.round((status.current / status.total) * 100)) : 0;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status.busy) onSubmit();
  };

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <fieldset disabled={status.busy} className="space-y-4 disabled:opacity-70">
          {children}
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status.busy ? 'Sedang memproses...' : actionLabel}
          </button>
        </fieldset>

        {status.busy && (
          <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50 p-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-blue-900">
              <span className="truncate">{status.detail}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-blue-100">
              <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-blue-700">
              <span>{status.current}/{status.total || '—'} · {status.rate.toFixed(1)}/dtk</span>
              <span>{formatDuration(status.elapsedSeconds)}</span>
            </div>
            <button type="button" onClick={onCancel} className="text-xs font-semibold text-red-600 hover:underline">
              Batalkan
            </button>
          </div>
        )}

        {status.finished && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
            <p>
              Selesai dalam <strong>{formatDuration(status.elapsedSeconds)}</strong>.{' '}
              {status.outputCount === 1
                ? 'Unduhan dimulai otomatis.'
                : `${status.outputCount} file siap diunduh satu per satu.`}
            </p>
            {status.downloads.map((download) => (
              <a key={download.url} href={download.url} download={download.name} className="block font-semibold underline underline-offset-2">
                Unduh {download.name}
              </a>
            ))}
          </div>
        )}

        {status.error && (
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            Proses gagal: {status.error}
          </p>
        )}
      </form>
    </section>
  );
}
