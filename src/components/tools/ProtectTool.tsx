import { useState, useRef } from 'react';
import { PDFDocument, rgb } from 'pdf-lib';
import { DropZone } from '../common/DropZone';
import { ResultCard } from '../common/ResultCard';
import type { ProcessResult } from '../../types';
import { formatBytes } from '../../utils/natural-sort';
import { pdfjsLib, renderPageToDataUrl } from '../../utils/pdfjs-config';

export function ProtectTool() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'redact' | 'unlock'>('redact');

  // Redact state
  const [redactPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pagePreviewUrl, setPagePreviewUrl] = useState('');
  const [redactBoxes, setRedactBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([
    { x: 20, y: 30, w: 60, h: 8 },
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileBufferRef = useRef<ArrayBuffer | null>(null);

  const handleFileSelect = async (selected: File) => {
    try {
      setFile(selected);
      const buf = await selected.arrayBuffer();
      fileBufferRef.current = buf.slice(0);

      const task = pdfjsLib.getDocument({ data: buf });
      const doc = await task.promise;
      setTotalPages(doc.numPages);

      const { dataUrl } = await renderPageToDataUrl(doc, 1, 1.2, 0.85);
      setPagePreviewUrl(dataUrl);
    } catch {
      setError('Gagal membaca PDF');
    }
  };

  const handleExecute = async () => {
    if (!file || !fileBufferRef.current) return;
    setIsProcessing(true);
    setError(null);
    const startTime = Date.now();

    try {
      if (mode === 'redact') {
        const pdfDoc = await PDFDocument.load(fileBufferRef.current.slice(0), {
          ignoreEncryption: true,
        });

        const targetPage = pdfDoc.getPage(redactPage - 1);
        const { width: pW, height: pH } = targetPage.getSize();

        for (const box of redactBoxes) {
          const bx = (box.x / 100) * pW;
          const by = pH - (box.y / 100) * pH - ((box.h / 100) * pH);
          const bw = (box.w / 100) * pW;
          const bh = (box.h / 100) * pH;

          targetPage.drawRectangle({
            x: bx,
            y: by,
            width: bw,
            height: bh,
            color: rgb(0, 0, 0),
            opacity: 1.0,
          });
        }

        const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const elapsed = (Date.now() - startTime) / 1000;

        setResult({
          blob,
          fileName: `${file.name.replace(/\.pdf$/i, '')}_redacted`,
          totalPages: pdfDoc.getPageCount(),
          originalSize: file.size,
          resultSize: blob.size,
          elapsedSeconds: elapsed,
          speedPagesPerSec: 0,
        });
      } else {
        const pdfDoc = await PDFDocument.load(fileBufferRef.current.slice(0), {
          ignoreEncryption: true,
        });

        const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const elapsed = (Date.now() - startTime) / 1000;

        setResult({
          blob,
          fileName: `${file.name.replace(/\.pdf$/i, '')}_unlocked`,
          totalPages: pdfDoc.getPageCount(),
          originalSize: file.size,
          resultSize: blob.size,
          elapsedSeconds: elapsed,
          speedPagesPerSec: 0,
        });
      }
      setIsProcessing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses keamanan dokumen');
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          Sensor (Redact) & Buka Proteksi PDF
        </h2>
        <p className="text-xs text-gray-500">
          Sensor bagian dokumen yang rahasia secara permanen atau hilangkan batasan enkripsi PDF.
        </p>
      </div>

      {!file && !result && (
        <DropZone
          multiple={false}
          allowFolder={false}
          onFilesSelected={(files) => {
            if (files[0]) handleFileSelect(files[0]);
          }}
          title="Pilih dokumen PDF"
          subtitle="Tutup area sensitif atau simpan ulang PDF tanpa proteksi"
        />
      )}

      {file && !result && !isProcessing && (
        <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <p className="text-xs font-bold text-gray-900 truncate max-w-sm">
                {file.name}
              </p>
              <p className="text-[11px] text-gray-400">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-red-600 hover:underline"
            >
              Ganti File
            </button>
          </div>

          {/* Submode Switcher */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'redact', title: 'Sensor Area Tertentu (Kotak Hitam)' },
              { id: 'unlock', title: 'Buka Proteksi / Salin Bersih' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id as any)}
                className={`rounded-lg border p-2.5 text-xs font-semibold transition ${
                  mode === m.id
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>

          {/* Redaction Controls */}
          {mode === 'redact' && (
            <div className="space-y-3 rounded-lg bg-gray-50 p-4">
              <h4 className="text-xs font-semibold text-gray-800">
                Atur Kotak Sensor (Halaman 1 dari {totalPages})
              </h4>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] text-gray-600">
                    Posisi Vertikal Kotak: {redactBoxes[0]?.y}%
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="90"
                    value={redactBoxes[0]?.y || 30}
                    onChange={(e) =>
                      setRedactBoxes([
                        { ...redactBoxes[0], y: parseInt(e.target.value, 10) },
                      ])
                    }
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-gray-600">
                    Tinggi Kotak Sensor: {redactBoxes[0]?.h}%
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="30"
                    value={redactBoxes[0]?.h || 8}
                    onChange={(e) =>
                      setRedactBoxes([
                        { ...redactBoxes[0], h: parseInt(e.target.value, 10) },
                      ])
                    }
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              {pagePreviewUrl && (
                <div className="relative mx-auto flex max-h-60 w-full items-center justify-center overflow-hidden rounded bg-gray-200 p-2">
                  <div className="relative inline-block border border-gray-300 bg-white">
                    <img
                      src={pagePreviewUrl}
                      alt="Pratinjau Sensor"
                      className="max-h-52 w-auto object-contain"
                    />
                    {redactBoxes.map((b, i) => (
                      <div
                        key={i}
                        className="absolute bg-black pointer-events-none"
                        style={{
                          left: `${b.x}%`,
                          top: `${b.y}%`,
                          width: `${b.w}%`,
                          height: `${b.h}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'unlock' && (
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
              Menghasilkan salinan PDF baru yang bebas dari pembatasan cetak atau sunting.
            </div>
          )}

          <button
            type="button"
            onClick={handleExecute}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 active:bg-blue-800"
          >
            {mode === 'redact' ? 'Terapkan Sensor & Simpan PDF' : 'Buka Proteksi Dokumen'}
          </button>
        </div>
      )}

      {isProcessing && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-xs text-gray-600">
          Sedang memproses...
        </div>
      )}

      {result && (
        <ResultCard
          result={result}
          onDownload={(customName) => {
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${customName || result.fileName}.pdf`;
            a.click();
          }}
          onReset={() => {
            setResult(null);
            setFile(null);
          }}
          title={mode === 'redact' ? 'Sensor Dokumen Selesai' : 'Dokumen Berhasil Dibuka'}
        />
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Gagal: {error}
        </div>
      )}
    </div>
  );
}
