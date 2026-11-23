import { useState } from 'react';
import { OfficeToolFrame } from './OfficeToolFrame';
import { useOfficeWorker } from './useOfficeWorker';

type MediaMode = 'compress' | 'trim' | 'audio';

export function MediaTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<MediaMode>('compress');
  const [startSeconds, setStartSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(30);
  const { status, run, stop } = useOfficeWorker();

  const process = () => {
    if (!file) return;
    run(
      () => new Worker(new URL('../../../workers/media.worker.ts', import.meta.url), { type: 'module' }),
      { file, mode, startSeconds, durationSeconds }
    );
  };

  return (
    <OfficeToolFrame
      title="Audio & Video Compressor"
      description="Kompres video ke MP4, potong klip berdasarkan waktu, atau ekstrak audio MP3. FFmpeg WebAssembly dimuat hanya saat alat ini dijalankan."
      actionLabel={mode === 'audio' ? 'Ekstrak MP3' : mode === 'trim' ? 'Potong video' : 'Kompres video'}
      status={status}
      onSubmit={process}
      onCancel={stop}
    >
      <label className="block space-y-2 text-sm font-medium text-gray-700">
        Pilih audio atau video
        <input required type="file" accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-gray-200 p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700" />
        <span className="text-xs font-normal text-gray-400">
          File media disimpan seluruhnya di memori tab. File besar memerlukan RAM dan waktu lebih banyak.
        </span>
      </label>

      <label className="block space-y-1.5 text-xs font-semibold text-gray-600">
        Aksi
        <select value={mode} onChange={(event) => setMode(event.target.value as MediaMode)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-800">
          <option value="compress">Kompres ke MP4 (H.264)</option>
          <option value="trim">Potong klip ke MP4</option>
          <option value="audio">Ekstrak audio ke MP3</option>
        </select>
      </label>

      {mode === 'trim' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-gray-600">
            Mulai (detik)
            <input type="number" min={0} step={0.1} value={startSeconds} onChange={(event) => setStartSeconds(Number(event.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal" />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-gray-600">
            Durasi potongan (detik)
            <input type="number" min={0.1} step={0.1} value={durationSeconds} onChange={(event) => setDurationSeconds(Number(event.target.value))} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-normal" />
          </label>
        </div>
      )}
    </OfficeToolFrame>
  );
}
