import { FFmpeg } from '@ffmpeg/ffmpeg';
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';
import classWorkerURL from '@ffmpeg/ffmpeg/worker?url';
import { toTransferableBuffer } from './office/table-data';

type MediaJob = {
  file: File;
  mode: 'compress' | 'trim' | 'audio';
  startSeconds: number;
  durationSeconds: number;
};

self.onmessage = async (event: MessageEvent<MediaJob>) => {
  const { file, mode, startSeconds, durationSeconds } = event.data;
  const ffmpeg = new FFmpeg();
  const report = (progress: { progress: number; time: number }) => {
    self.postMessage({
      type: 'progress',
      current: Math.max(0, Math.min(99, Math.round(progress.progress * 100))),
      total: 100,
      detail: progress.progress > 0 ? 'Transcoding media...' : 'Loading FFmpeg WebAssembly...',
    });
  };

  try {
    if (!file) throw new Error('Pilih file audio atau video.');
    if (file.size > 250 * 1024 * 1024) {
      throw new Error('Ukuran maksimal file audio/video adalah 250 MB agar pemrosesan tetap stabil di browser.');
    }
    if (!['compress', 'trim', 'audio'].includes(mode)) throw new Error('Aksi media tidak dikenal.');
    if (mode === 'trim' && (!Number.isFinite(startSeconds) || !Number.isFinite(durationSeconds) || startSeconds < 0 || durationSeconds <= 0)) {
      throw new Error('Waktu mulai harus >= 0 dan durasi potong harus lebih besar dari 0.');
    }

    ffmpeg.on('progress', report);
    ffmpeg.on('log', ({ message }) => {
      if (/error|invalid|failed/i.test(message)) {
        self.postMessage({ type: 'progress', current: 0, total: 100, detail: message.slice(0, 180) });
      }
    });

    self.postMessage({ type: 'progress', current: 0, total: 100, detail: 'Memuat FFmpeg WebAssembly...' });
    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });

    const sourceExtension = file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase() ?? 'bin';
    const inputName = `source.${sourceExtension}`;
    const outputName = mode === 'audio' ? 'hasil.mp3' : 'hasil.mp4';
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

    let args: string[];
    if (mode === 'audio') {
      args = ['-i', inputName, '-map', '0:a:0', '-vn', '-codec:a', 'libmp3lame', '-q:a', '4', outputName];
    } else if (mode === 'trim') {
      args = [
        '-i', inputName,
        '-ss', String(startSeconds),
        '-t', String(durationSeconds),
        '-map', '0:v:0?',
        '-map', '0:a:0?',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '27',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName,
      ];
    } else {
      args = [
        '-i', inputName,
        '-map', '0:v:0?',
        '-map', '0:a:0?',
        '-vf', "scale='min(1280,iw)':-2",
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        outputName,
      ];
    }

    const exitCode = await ffmpeg.exec(args);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg berhenti dengan kode ${exitCode}. Pastikan codec/file input didukung dan file memiliki stream yang sesuai.`);
    }

    const result = await ffmpeg.readFile(outputName);
    if (typeof result === 'string') throw new Error('FFmpeg menghasilkan keluaran yang tidak valid.');
    const buffer = toTransferableBuffer(result);
    const safeBaseName = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .slice(0, 100) || 'media';
    self.postMessage(
      {
        type: 'done',
        total: 100,
        outputs: [{
          name: `${safeBaseName}_${mode === 'audio' ? 'audio' : mode === 'trim' ? 'trim' : 'compressed'}.${mode === 'audio' ? 'mp3' : 'mp4'}`,
          mimeType: mode === 'audio' ? 'audio/mpeg' : 'video/mp4',
          buffer,
        }],
      },
      { transfer: [buffer] }
    );
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Proses media gagal. Coba format lain atau file yang lebih kecil.',
    });
  } finally {
    ffmpeg.terminate();
  }
};
