import { useState } from 'react';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { OfficeToolFrame } from './OfficeToolFrame';
import { useOfficeWorker } from './useOfficeWorker';

type CodeKind = 'qr' | 'barcode';

function barcodeSvg(value: string): string {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  JsBarcode(svg, value, { format: 'CODE128', displayValue: false, height: 90, margin: 8 });
  return new XMLSerializer().serializeToString(svg);
}

async function svgToPng(svg: string): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas tidak tersedia untuk merender barcode.');
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Gagal merender barcode PNG.')), 'image/png');
    });
    canvas.width = 0;
    canvas.height = 0;
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CodeGeneratorTool() {
  const [values, setValues] = useState('');
  const [kind, setKind] = useState<CodeKind>('qr');
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const { status, run, stop } = useOfficeWorker();
  const entries = values.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  const displayStatus = preparing
    ? {
        ...status,
        busy: true,
        current: prepareProgress,
        total: entries.length,
        detail: 'Menyiapkan kode...',
      }
    : prepareError
      ? { ...status, error: prepareError }
      : status;

  const loadList = async (file: File) => {
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('Ukuran maksimal file daftar adalah 25 MB.');
      let valuesFromFile: string[] = [];
      if (/\.csv$/i.test(file.name)) {
        const { default: Papa } = await import('papaparse');
        const result = Papa.parse<string[]>(await file.text(), { skipEmptyLines: 'greedy' });
        if (result.errors.length) throw new Error(result.errors[0].message);
        valuesFromFile = result.data.map((row) => row[0] ?? '');
      } else {
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet) throw new Error('Workbook tidak memiliki sheet.');
        valuesFromFile = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false })
          .slice(1)
          .map((row) => String(row[0] ?? ''));
      }
      const entriesFromFile = valuesFromFile.filter((value) => value.trim());
      if (entriesFromFile.length > 500) {
        throw new Error('Maksimal 500 kode per PDF. Bagi daftar menjadi beberapa batch.');
      }
      if (entriesFromFile.some((value) => value.length > 1_000)) {
        throw new Error('Setiap nilai kode maksimal 1.000 karakter.');
      }
      setValues(entriesFromFile.join('\n'));
      setPrepareError(null);
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : 'Tidak bisa membaca file daftar.');
    }
  };

  const generate = async () => {
    if (!entries.length) return;
    if (entries.length > 500) {
      setPrepareError('Batas aman adalah 500 kode per PDF. Bagi daftar menjadi beberapa batch.');
      return;
    }
    if (entries.some((value) => value.length > 1_000)) {
      setPrepareError('Setiap nilai kode maksimal 1.000 karakter.');
      return;
    }

    setPrepareError(null);
    setPreparing(true);
    setPrepareProgress(0);
    try {
      const assets: { label: string; image: Blob }[] = [];
      for (let index = 0; index < entries.length; index += 1) {
        const value = entries[index];
        const image = kind === 'qr'
          ? await fetch(await QRCode.toDataURL(value, { margin: 2, width: 256 })).then((response) => response.blob())
          : await svgToPng(barcodeSvg(value));
        assets.push({ label: value, image });
        setPrepareProgress(index + 1);
        if (index % 8 === 7) await new Promise((resolve) => setTimeout(resolve, 0));
      }

      run(
        () => new Worker(new URL('../../../workers/code-pdf.worker.ts', import.meta.url), { type: 'module' }),
        { entries: assets }
      );
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : 'Pembuatan QR/barcode gagal.');
    } finally {
      setPreparing(false);
    }
  };

  return (
    <OfficeToolFrame
      title="QR & Barcode Generator"
      description="Buat QR atau barcode Code 128 dari daftar teks/Excel/CSV, lengkap dengan label dan tata letak grid PDF A4."
      actionLabel={`Buat ${entries.length || ''} kode dan unduh PDF`}
      status={displayStatus}
      onSubmit={generate}
      onCancel={() => {
        setPreparing(false);
        stop();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Jenis kode
          <select value={kind} onChange={(event) => setKind(event.target.value as CodeKind)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
            <option value="qr">QR Code</option>
            <option value="barcode">Barcode Code 128</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Impor daftar CSV / Excel
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void loadList(file);
          }} className="block w-full rounded-lg border border-gray-200 p-2 text-xs font-normal" />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-medium text-gray-700">
        Satu nilai per baris
        <textarea required value={values} onChange={(event) => setValues(event.target.value)} rows={8} maxLength={500_000} placeholder={'INV-001\nINV-002\nINV-003'} className="w-full rounded-xl border border-gray-200 p-3 font-mono text-sm" />
        <span className="text-xs font-normal text-gray-400">{entries.length.toLocaleString()} kode · maksimal 500 per batch.</span>
      </label>
    </OfficeToolFrame>
  );
}
