import { useCallback, useEffect, useRef, useState } from 'react';
import { formatBytes, formatDuration } from '../../../utils/natural-sort';

export interface OfficeOutput {
  name: string;
  mimeType: string;
  buffer: ArrayBuffer;
}

interface OfficeWorkerMessage {
  type: 'progress' | 'inspect' | 'done' | 'error';
  current?: number;
  total?: number;
  detail?: string;
  outputs?: OfficeOutput[];
  error?: string;
  columns?: string[];
}

export interface OfficeJobStatus {
  busy: boolean;
  current: number;
  total: number;
  detail: string;
  rate: number;
  elapsedSeconds: number;
  finished: boolean;
  error: string | null;
  outputBytes: number;
  outputCount: number;
  columns: string[];
  downloads: { name: string; url: string }[];
}

const initialStatus: OfficeJobStatus = {
  busy: false,
  current: 0,
  total: 0,
  detail: '',
  rate: 0,
  elapsedSeconds: 0,
  finished: false,
  error: null,
  outputBytes: 0,
  outputCount: 0,
  columns: [],
  downloads: [],
};

function downloadOutput(output: OfficeOutput, triggerDownload: boolean): { name: string; url: string } {
  const blob = new Blob([output.buffer], { type: output.mimeType });
  const url = URL.createObjectURL(blob);
  if (triggerDownload) {
    const link = document.createElement('a');
    link.href = url;
    link.download = output.name;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { name: output.name, url };
}

export function useOfficeWorker() {
  const workerRef = useRef<Worker | null>(null);
  const startTimeRef = useRef(0);
  const downloadURLsRef = useRef<string[]>([]);
  const [status, setStatus] = useState<OfficeJobStatus>(initialStatus);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStatus((current) => ({ ...current, busy: false, detail: 'Proses dibatalkan.' }));
  }, []);

  const run = useCallback(
    (createWorker: () => Worker, message: unknown, transfer: Transferable[] = []) => {
      workerRef.current?.terminate();
      downloadURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
      downloadURLsRef.current = [];
      startTimeRef.current = performance.now();
      setStatus({ ...initialStatus, busy: true, detail: 'Menyiapkan proses...' });

      let worker: Worker;
      try {
        worker = createWorker();
        workerRef.current = worker;
      } catch (error) {
        setStatus((previous) => ({
          ...previous,
          busy: false,
          error: error instanceof Error ? error.message : 'Tidak dapat memulai worker.',
        }));
        return;
      }

      const finish = () => {
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
      };

      worker.onmessage = (event: MessageEvent<OfficeWorkerMessage>) => {
        const result = event.data;
        const elapsedSeconds = (performance.now() - startTimeRef.current) / 1000;

        if (result.type === 'progress') {
          const current = result.current ?? 0;
          setStatus((previous) => ({
            ...previous,
            current,
            total: result.total ?? previous.total,
            detail: result.detail ?? 'Sedang memproses...',
            rate: elapsedSeconds > 0 ? current / elapsedSeconds : 0,
            elapsedSeconds,
          }));
          return;
        }

        if (result.type === 'inspect') {
          finish();
          setStatus((previous) => ({
            ...previous,
            busy: false,
            detail: result.detail ?? 'Kolom siap dipilih.',
            columns: result.columns ?? [],
          }));
          return;
        }

        if (result.type === 'error') {
          finish();
          setStatus((previous) => ({
            ...previous,
            busy: false,
            elapsedSeconds,
            error: result.error || 'Proses gagal. Periksa file lalu coba kembali.',
          }));
          return;
        }

        if (result.type === 'done') {
          finish();
          const outputs = result.outputs ?? [];
          let outputBytes = 0;
          const downloads: { name: string; url: string }[] = [];
          for (const output of outputs) {
            outputBytes += output.buffer.byteLength;
            downloads.push(downloadOutput(output, outputs.length === 1));
          }
          downloadURLsRef.current = downloads.map((download) => download.url);
          setStatus({
            busy: false,
            current: result.total ?? result.current ?? 1,
            total: result.total ?? result.current ?? 1,
            detail: outputs.length === 1 ? 'Selesai. Unduhan dimulai otomatis.' : 'Selesai. File siap diunduh.',
            rate: elapsedSeconds > 0 ? (result.total ?? 1) / elapsedSeconds : 0,
            elapsedSeconds,
            finished: true,
            error: null,
            outputBytes,
            outputCount: outputs.length,
            columns: [],
            downloads,
          });
        }
      };

      worker.onerror = (event) => {
        finish();
        setStatus((previous) => ({
          ...previous,
          busy: false,
          elapsedSeconds: (performance.now() - startTimeRef.current) / 1000,
          error: event.message || 'Worker gagal dijalankan. Muat ulang halaman dan coba kembali.',
        }));
      };

      try {
        worker.postMessage(message, transfer);
      } catch (error) {
        finish();
        setStatus((previous) => ({
          ...previous,
          busy: false,
          error: error instanceof Error ? error.message : 'Tidak dapat memulai proses.',
        }));
      }
    },
    []
  );

  useEffect(() => () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    downloadURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
    downloadURLsRef.current = [];
  }, []);

  useEffect(() => {
    if (!status.busy) return;
    const interval = window.setInterval(() => {
      setStatus((current) => current.busy
        ? { ...current, elapsedSeconds: (performance.now() - startTimeRef.current) / 1000 }
        : current);
    }, 500);
    return () => window.clearInterval(interval);
  }, [status.busy]);

  const statusText = status.finished
    ? `Selesai dalam ${formatDuration(status.elapsedSeconds)} · ${status.outputCount} file · ${formatBytes(status.outputBytes)}`
    : status.busy
      ? `${status.detail}${status.rate > 0 ? ` · ${status.rate.toFixed(1)}/dtk` : ''} · ${formatDuration(status.elapsedSeconds)}`
      : '';

  return { status, statusText, run, stop };
}
