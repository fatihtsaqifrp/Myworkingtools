import { useState } from 'react';
import { OfficeToolFrame } from './OfficeToolFrame';
import { useOfficeWorker } from './useOfficeWorker';

export function SpreadsheetTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [deduplicateColumn, setDeduplicateColumn] = useState('');
  const [outputFormat, setOutputFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [capitalization, setCapitalization] = useState<'keep' | 'lower' | 'title'>('keep');
  const { status, run, stop } = useOfficeWorker();

  const inspectColumns = () => {
    if (!files.length) return;
    run(
      () => new Worker(new URL('../../../workers/table-merge.worker.ts', import.meta.url), { type: 'module' }),
      { type: 'inspect', files, outputFormat, deduplicateColumn: '', capitalization }
    );
  };

  const mergeFiles = () => {
    if (!files.length) return;
    run(
      () => new Worker(new URL('../../../workers/table-merge.worker.ts', import.meta.url), { type: 'module' }),
      { type: 'merge', files, outputFormat, deduplicateColumn, capitalization }
    );
  };

  return (
    <OfficeToolFrame
      title="Excel & CSV Merger"
      description="Gabungkan file CSV/XLS/XLSX, rapikan spasi dan kapitalisasi, hapus baris duplikat, lalu unduh file master."
      actionLabel="Gabungkan dan unduh"
      status={status}
      onSubmit={mergeFiles}
      onCancel={stop}
    >
      <label className="block space-y-2 text-sm font-medium text-gray-700">
        Pilih file data
        <input
          required
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          multiple
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setDeduplicateColumn('');
          }}
          className="block w-full rounded-xl border border-gray-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
        />
        <span className="text-xs font-normal text-gray-400">
          {files.length ? `${files.length} file dipilih` : 'Pilih satu atau beberapa file CSV/XLS/XLSX.'}
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Format hasil
          <select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value as 'xlsx' | 'csv')} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Rapikan kapitalisasi
          <select value={capitalization} onChange={(event) => setCapitalization(event.target.value as typeof capitalization)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
            <option value="keep">Pertahankan</option>
            <option value="title">Awal Kata Kapital</option>
            <option value="lower">Huruf kecil</option>
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <button type="button" disabled={!files.length || status.busy} onClick={inspectColumns} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">
          Baca kolom untuk deduplikasi
        </button>
        {status.columns.length > 0 && (
          <label className="block space-y-1.5 text-xs font-semibold text-gray-600">
            Hapus duplikat berdasarkan kolom
            <select value={deduplicateColumn} onChange={(event) => setDeduplicateColumn(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
              <option value="">Jangan hapus duplikat</option>
              {status.columns.map((column) => <option key={column} value={column}>{column}</option>)}
            </select>
          </label>
        )}
      </div>
    </OfficeToolFrame>
  );
}
