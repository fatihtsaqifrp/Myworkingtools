interface SkippedFile {
  name: string;
  error: string;
}

interface ResultPanelProps {
  totalPages: number;
  skippedFiles: SkippedFile[];
  outputFileName: string;
  onFileNameChange: (name: string) => void;
  onDownload: () => void;
  onReset: () => void;
}

export function ResultPanel({
  totalPages,
  skippedFiles,
  outputFileName,
  onFileNameChange,
  onDownload,
  onReset,
}: ResultPanelProps) {
  return (
    <section className="border-t-2 border-blue pt-6">
      <p className="font-serif text-3xl font-medium tracking-tight text-ink">Selesai.</p>
      <p className="mt-1 text-sm text-muted">
        File gabungan berisi <span className="font-mono text-ink">{totalPages}</span> halaman dan siap diunduh.
      </p>

      {skippedFiles.length > 0 && (
        <div className="mt-6 border-l-2 border-red bg-red-tint px-4 py-3">
          <p className="text-sm font-medium text-red">
            {skippedFiles.length} file tidak bisa dibaca dan dilewati:
          </p>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-ink">
            {skippedFiles.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.name}</span>
                <span className="text-muted"> — {f.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6">
        <label htmlFor="result-name" className="block text-xs font-medium uppercase tracking-[0.08em] text-muted">
          Nama file
        </label>
        <div className="mt-1 flex items-baseline border-b border-ink focus-within:border-blue">
          <input
            id="result-name"
            type="text"
            value={outputFileName}
            onChange={(e) => onFileNameChange(e.target.value)}
            className="w-full bg-transparent py-2 text-base text-ink placeholder-muted focus:outline-none"
            placeholder="merged"
          />
          <span className="font-mono text-sm text-muted">.pdf</span>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6">
        <button
          type="button"
          onClick={onDownload}
          className="bg-blue px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2"
        >
          Unduh PDF
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-ink underline decoration-1 underline-offset-4 hover:text-blue"
        >
          Gabungkan file lain
        </button>
      </div>
    </section>
  );
}
