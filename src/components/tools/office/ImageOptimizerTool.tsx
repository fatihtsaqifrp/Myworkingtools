import { useState } from 'react';
import { OfficeToolFrame } from './OfficeToolFrame';
import { useOfficeWorker } from './useOfficeWorker';

export function ImageOptimizerTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<'image/jpeg' | 'image/png' | 'image/webp'>('image/webp');
  const [maxDimension, setMaxDimension] = useState(2000);
  const [quality, setQuality] = useState(0.82);
  const [watermarkText, setWatermarkText] = useState('');
  const [watermarkLogo, setWatermarkLogo] = useState<File | null>(null);
  const { status, run, stop } = useOfficeWorker();

  const optimize = () => {
    if (!files.length) return;
    run(
      () => new Worker(new URL('../../../workers/image-optimizer.worker.ts', import.meta.url), { type: 'module' }),
      { files, format, maxDimension, quality, watermarkText, watermarkLogo }
    );
  };

  return (
    <OfficeToolFrame
      title="Bulk Image Optimizer"
      description="Kompres banyak gambar, samakan batas dimensi, ubah ke JPG/PNG/WebP, dan tambahkan watermark teks atau logo."
      actionLabel="Optimalkan dan unduh ZIP"
      status={status}
      onSubmit={optimize}
      onCancel={stop}
    >
      <label className="block space-y-2 text-sm font-medium text-gray-700">
        Pilih gambar
        <input required type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="block w-full rounded-xl border border-gray-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
        <span className="text-xs font-normal text-gray-400">{files.length ? `${files.length} gambar dipilih` : 'Mendukung JPG, PNG, dan WebP.'}</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Format
          <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
            <option value="image/webp">WebP</option>
            <option value="image/jpeg">JPG</option>
            <option value="image/png">PNG</option>
          </select>
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Sisi terpanjang (px)
          <input type="number" min={128} max={12000} step={1} value={maxDimension} onChange={(event) => setMaxDimension(Number(event.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Kualitas {Math.round(quality * 100)}%
          <input type="range" min={0.4} max={1} step={0.02} value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="w-full accent-blue-600" />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Watermark teks
          <input value={watermarkText} maxLength={120} onChange={(event) => setWatermarkText(event.target.value)} placeholder="Opsional" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal" />
        </label>
        <label className="space-y-1.5 text-xs font-semibold text-gray-600">
          Logo watermark
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setWatermarkLogo(event.target.files?.[0] ?? null)} className="block w-full rounded-lg border border-gray-200 p-2 text-xs font-normal" />
        </label>
      </div>
    </OfficeToolFrame>
  );
}
