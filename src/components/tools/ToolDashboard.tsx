import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ToolId } from '../../types';

interface ToolItem {
  id: ToolId;
  title: string;
  description: string;
  group: string;
}

interface ToolDashboardProps {
  onSelectTool: (id: ToolId) => void;
  activeGroup: string | null;
  onActiveGroupChange: (group: string | null) => void;
}

const TOOLS: ToolItem[] = [
  { id: 'background-remover', title: 'Hapus latar foto', description: 'Pilih Cloud untuk hasil lebih detail atau lokal tanpa biaya.', group: 'Gambar' },
  { id: 'bulk-ocr', title: 'Ambil teks dari gambar', description: 'Ekstrak teks dari foto struk atau dokumen dengan OCR.', group: 'Gambar' },
  { id: 'merge', title: 'Gabungkan PDF', description: 'Satukan beberapa PDF menjadi satu file.', group: 'PDF' },
  { id: 'split', title: 'Pisahkan PDF', description: 'Pilih halaman yang ingin dipisah atau ekstrak semuanya.', group: 'PDF' },
  { id: 'organize', title: 'Atur halaman PDF', description: 'Ubah urutan, putar, atau hapus halaman.', group: 'PDF' },
  { id: 'crop', title: 'Potong PDF', description: 'Atur batas halaman dan simpan hasilnya.', group: 'PDF' },
  { id: 'compress', title: 'Kompres PDF', description: 'Kurangi ukuran file PDF.', group: 'PDF' },
  { id: 'sign', title: 'Tanda tangan PDF', description: 'Tambahkan tanda tangan atau stempel.', group: 'PDF' },
  { id: 'img2pdf', title: 'Gambar ke PDF', description: 'Gabungkan gambar menjadi satu PDF.', group: 'PDF' },
  { id: 'pdf2img', title: 'PDF ke gambar', description: 'Ubah halaman PDF menjadi gambar.', group: 'PDF' },
  { id: 'convert-documents', title: 'Konversi dokumen', description: 'Ubah PDF, Word, Excel, PowerPoint, atau gambar.', group: 'Dokumen' },
  { id: 'ocr', title: 'Ekstrak teks dari PDF', description: 'Ambil teks dari PDF atau gambar hasil scan.', group: 'Dokumen' },
  { id: 'watermark', title: 'Watermark PDF', description: 'Tambahkan watermark atau nomor halaman.', group: 'PDF' },
  { id: 'protect', title: 'Sensor atau buka PDF', description: 'Tutup informasi sensitif atau buka proteksi PDF.', group: 'PDF' },
  { id: 'image-optimizer', title: 'Kompres gambar', description: 'Ubah ukuran, format, atau tambahkan watermark.', group: 'Gambar' },
  { id: 'spreadsheet', title: 'Gabungkan Excel atau CSV', description: 'Gabungkan tabel dan hapus baris duplikat.', group: 'Dokumen' },
  { id: 'code-generator', title: 'Buat QR atau barcode', description: 'Buat kode dari teks atau tabel.', group: 'Dokumen' },
  { id: 'mail-merge', title: 'Buat dokumen massal', description: 'Isi template Word dari data Excel atau CSV.', group: 'Dokumen' },
  { id: 'media', title: 'Kompres audio atau video', description: 'Kompres, potong, atau ekstrak audio dari video.', group: 'Media' },
  { id: 'calculator', title: 'Kalkulator ilmiah', description: 'Hitung dengan fungsi ilmiah dan riwayat.', group: 'Lainnya' },
  { id: 'games', title: 'Permainan', description: 'Mainkan Sudoku, 2048, dan Zip.', group: 'Lainnya' },
];

const GROUPS = [
  { name: 'Gambar', description: 'Kompres, bersihkan, atau ambil teks dari gambar.' },
  { name: 'PDF', description: 'Gabungkan, rapikan, kompres, dan ubah halaman PDF.' },
  { name: 'Dokumen', description: 'Konversi, olah tabel, dan buat dokumen.' },
  { name: 'Media', description: 'Kompres atau potong audio dan video.' },
  { name: 'Lainnya', description: 'Alat bantu dan permainan ringan.' },
];

export function ToolDashboard({ onSelectTool, activeGroup, onActiveGroupChange }: ToolDashboardProps) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('id');
  const filteredTools = useMemo(() => {
    if (!query) return TOOLS;
    return TOOLS.filter((tool) => `${tool.title} ${tool.description} ${tool.group}`.toLocaleLowerCase('id').includes(query));
  }, [query]);
  const visibleTools = query ? filteredTools : filteredTools.filter((tool) => tool.group === activeGroup);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="text-sm font-medium text-blue-600">Alat untuk file</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Apa yang ingin kamu lakukan?</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Pilih alat. Unggah file. Selesaikan pekerjaan.</p>
      </header>

      <label className="mb-8 block">
        <span className="sr-only">Cari alat</span>
        <input
          type="search"
          value={search}
          placeholder="Cari alat, misalnya kompres gambar"
          onChange={(event) => setSearch(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        />
      </label>

      {!query && !activeGroup ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((group) => {
            const count = TOOLS.filter((tool) => tool.group === group.name).length;
            return (
              <button
                key={group.name}
                type="button"
                onClick={() => onActiveGroupChange(group.name)}
                className="tool-card group relative isolate flex min-h-36 flex-col items-start overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <span className="tool-card-backdrop" aria-hidden="true" />
                <span className="relative z-10 text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-700">{group.name}</span>
                <span className="relative z-10 mt-2 text-sm leading-5 text-slate-600">{group.description}</span>
                <span className="relative z-10 mt-auto flex w-full items-center justify-between pt-4 text-xs font-medium text-slate-500">
                  <span>{count} alat</span><ArrowRight size={15} className="text-blue-600 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {!query && activeGroup && (
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{activeGroup}</h2>
                <p className="text-sm text-slate-500">Pilih alat yang kamu butuhkan.</p>
              </div>
              <button type="button" onClick={() => onActiveGroupChange(null)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-blue-700">
                <ArrowLeft size={16} /> Semua kategori
              </button>
            </div>
          )}
          {visibleTools.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onSelectTool(tool.id)}
                  className="tool-card group relative isolate min-h-32 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                >
                  <span className="tool-card-backdrop" aria-hidden="true" />
                  <span className="relative z-10 text-xs font-medium text-slate-500">{tool.group}</span>
                  <span className="relative z-10 mt-2 block text-base font-semibold text-slate-900 transition-colors group-hover:text-blue-700">{tool.title}</span>
                  <span className="relative z-10 mt-1 block text-sm leading-5 text-slate-600">{tool.description}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Alat tidak ditemukan. Coba kata kunci lain.</p>
          )}
        </>
      )}
    </div>
  );
}
