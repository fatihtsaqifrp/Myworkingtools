import { useState } from 'react';
import { OfficeToolFrame } from './OfficeToolFrame';
import { useOfficeWorker } from './useOfficeWorker';

export function MailMergeTool() {
  const [template, setTemplate] = useState<File | null>(null);
  const [dataFile, setDataFile] = useState<File | null>(null);
  const [filenameColumn, setFilenameColumn] = useState('');
  const { status, run, stop } = useOfficeWorker();

  const inspectColumns = () => {
    if (!template || !dataFile) return;
    run(
      () => new Worker(new URL('../../../workers/mail-merge.worker.ts', import.meta.url), { type: 'module' }),
      { type: 'inspect', template, dataFile, filenameColumn: '' }
    );
  };

  const merge = () => {
    if (!template || !dataFile) return;
    run(
      () => new Worker(new URL('../../../workers/mail-merge.worker.ts', import.meta.url), { type: 'module' }),
      { type: 'merge', template, dataFile, filenameColumn }
    );
  };

  return (
    <OfficeToolFrame
      title="Mail Merge DOCX"
      description="Isi template Word dengan kolom dari Excel/CSV dan kemas dokumen personalisasi ke satu ZIP."
      actionLabel="Buat dokumen dan unduh ZIP"
      status={status}
      onSubmit={merge}
      onCancel={stop}
    >
      <label className="block space-y-2 text-sm font-medium text-gray-700">
        Template Word (.docx)
        <input required type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setTemplate(event.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-gray-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
        <span className="text-xs font-normal text-gray-400">
          Gunakan tag seperti <code>{'{Nama}'}</code> atau <code>{'{Divisi}'}</code> di template.
        </span>
      </label>

      <label className="block space-y-2 text-sm font-medium text-gray-700">
        Data Excel/CSV
        <input required type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={(event) => {
          setDataFile(event.target.files?.[0] ?? null);
          setFilenameColumn('');
        }} className="block w-full rounded-xl border border-gray-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
      </label>

      <div className="space-y-2">
        <button type="button" disabled={!template || !dataFile || status.busy} onClick={inspectColumns} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">
          Baca kolom data
        </button>
        {status.columns.length > 0 && (
          <label className="block space-y-1.5 text-xs font-semibold text-gray-600">
            Kolom nama file (opsional)
            <select value={filenameColumn} onChange={(event) => setFilenameColumn(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
              <option value="">Nama otomatis: dokumen_001, 002, ...</option>
              {status.columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
        )}
      </div>
    </OfficeToolFrame>
  );
}
