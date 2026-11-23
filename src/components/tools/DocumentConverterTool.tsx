import { useEffect, useState } from 'react';
import {
  convertDocument,
  detectConversionSource,
  type ConversionFormat,
  type ConversionMode,
} from '../../utils/document-converter';
import { formatBytes } from '../../utils/natural-sort';

interface DownloadResult {
  name: string;
  url: string;
  warnings: string[];
}

const FORMAT_LABELS: Record<ConversionFormat, string> = {
  pdf: 'PDF',
  docx: 'Word (.docx)',
  xlsx: 'Excel (.xlsx)',
  csv: 'CSV (.csv)',
  pptx: 'PowerPoint (.pptx)',
  png: 'Gambar (.png)',
};

const ACCEPTED_FORMATS = '.pdf,.docx,.xlsx,.xls,.csv,.pptx,.jpg,.jpeg,.png,.webp';

export function DocumentConverterTool() {
  const [file, setFile] = useState<File | null>(null);
  const [sourceFormat, setSourceFormat] = useState<ConversionFormat | 'image' | null>(null);
  const [targetFormat, setTargetFormat] = useState<ConversionFormat>('docx');
  const [mode, setMode] = useState<ConversionMode>('editable');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<DownloadResult | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => {
    if (download) URL.revokeObjectURL(download.url);
  }, [download]);

  const selectFile = (selected: File | undefined) => {
    if (!selected) return;
    try {
      const format = detectConversionSource(selected);
      setFile(selected);
      setSourceFormat(format);
      setTargetFormat(format === 'docx' ? 'pdf' : 'docx');
      setMode(format === 'image' ? 'visual' : 'editable');
      setError(null);
      setDownload(null);
    } catch (reason) {
      setFile(null);
      setSourceFormat(null);
      setDownload(null);
      setError(reason instanceof Error ? reason.message : 'Format file tidak didukung.');
    }
  };

  const convert = async () => {
    if (!file || !sourceFormat) return;
    setBusy(true);
    setError(null);
    setDownload(null);
    try {
      const result = await convertDocument(file, targetFormat, mode);
      const url = URL.createObjectURL(result.blob);
      setDownload({ name: result.fileName, url, warnings: result.warnings });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Konversi gagal. Periksa file lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const spreadsheetTarget = targetFormat === 'xlsx' || targetFormat === 'csv';
  const imageSource = sourceFormat === 'image';
  const targetDisabled = (format: ConversionFormat) => (
    (format === sourceFormat && !(format === 'xlsx' && file?.name.toLowerCase().endsWith('.xls'))) ||
    (imageSource && (format === 'xlsx' || format === 'csv'))
  );

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Konversi Dokumen</h1>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          Ubah PDF, Word, Excel/CSV, PowerPoint, dan gambar ke format lain. File diproses langsung di perangkat.
        </p>
      </header>

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (!busy) selectFile(event.dataTransfer.files[0]);
          }}
          className={`rounded-xl border-2 border-dashed p-6 text-center transition sm:p-8 ${
            dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          <label className="block cursor-pointer">
            <span className="text-sm font-semibold text-gray-800">
              {file ? file.name : 'Seret file ke sini atau pilih dari perangkat'}
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              PDF, DOCX, XLSX, CSV, PPTX, JPG, PNG, atau WebP · Maksimal 50 MB
            </span>
            <input
              type="file"
              accept={ACCEPTED_FORMATS}
              disabled={busy}
              onChange={(event) => selectFile(event.target.files?.[0])}
              className="sr-only"
            />
          </label>
          {file && (
            <p className="mt-3 text-xs text-gray-500">
              {FORMAT_LABELS[sourceFormat === 'image' ? 'png' : sourceFormat ?? 'pdf']} · {formatBytes(file.size)}
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-gray-600">
            Format hasil
            <select
              value={targetFormat}
              onChange={(event) => {
                const next = event.target.value as ConversionFormat;
                setTargetFormat(next);
                if (next === 'xlsx' || next === 'csv') setMode('editable');
                else if (next === 'png') setMode('visual');
              }}
              disabled={busy}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800"
            >
              {(Object.keys(FORMAT_LABELS) as ConversionFormat[]).map((format) => (
                <option key={format} value={format} disabled={targetDisabled(format)}>
                  {FORMAT_LABELS[format]}
                  {imageSource && (format === 'xlsx' || format === 'csv') ? ' — perlu OCR' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-semibold text-gray-600">
            Cara konversi
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ConversionMode)}
              disabled={busy || spreadsheetTarget || imageSource || targetFormat === 'png'}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800 disabled:bg-gray-100"
            >
              <option value="editable">Teks dan tabel editable</option>
              <option value="visual">Tampilan visual berbasis halaman</option>
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
          PDF harus memiliki teks yang bisa dipilih; PDF scan dan gambar ke Excel/CSV ditolak karena OCR dinonaktifkan.
          Konversi editable menjaga teks/tabel, tetapi tata letak dan format kompleks bisa berubah. Mode visual merasterkan
          PDF/gambar; file Office dirender ulang dari teks/tabel sederhana, jadi gambar dan dekorasi mungkin tidak terbawa.
          Teks hasil mode visual tidak bisa disalin.
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        {download && (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">
            <p>Konversi selesai.</p>
            <a href={download.url} download={download.name} className="font-semibold underline underline-offset-2">
              Unduh {download.name}
            </a>
            {download.warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-800">{warning}</p>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={convert}
          disabled={!file || !sourceFormat || busy || targetDisabled(targetFormat)}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Sedang mengonversi…' : `Konversi ke ${FORMAT_LABELS[targetFormat]}`}
        </button>
      </div>
    </section>
  );
}
