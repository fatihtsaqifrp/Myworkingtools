import { useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, Calculator, Combine, Crop, Eraser, FileImage,
  FileSearch, FileSignature, Files, Film, Gamepad2, Image, Images, Minimize2,
  PanelsTopLeft, QrCode, ScanText, Scissors, Shield, Sparkles, Table2,
  type LucideIcon,
} from 'lucide-react';
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
  { name: 'Gambar', description: 'Kompres, bersihkan, atau ambil teks dari gambar.', icon: Image },
  { name: 'PDF', description: 'Gabungkan, rapikan, kompres, dan ubah halaman PDF.', icon: Files },
  { name: 'Dokumen', description: 'Konversi, olah tabel, dan buat dokumen.', icon: PanelsTopLeft },
  { name: 'Media', description: 'Kompres atau potong audio dan video.', icon: Film },
  { name: 'Lainnya', description: 'Alat bantu dan permainan ringan.', icon: Sparkles },
];

const TOOL_ICONS: Partial<Record<ToolId, LucideIcon>> = {
  'background-remover': Eraser, 'bulk-ocr': ScanText, merge: Combine, split: Scissors,
  organize: PanelsTopLeft, crop: Crop, compress: Minimize2, sign: FileSignature,
  img2pdf: Images, pdf2img: FileImage, 'convert-documents': Files, ocr: FileSearch,
  watermark: Sparkles, protect: Shield, 'image-optimizer': Image, spreadsheet: Table2,
  'code-generator': QrCode, 'mail-merge': Files, media: Film, calculator: Calculator, games: Gamepad2,
};

export function ToolDashboard({ onSelectTool, activeGroup, onActiveGroupChange }: ToolDashboardProps) {
  const [search, setSearch] = useState('');
  const groupsRef = useRef<HTMLElement>(null);
  const query = search.trim().toLocaleLowerCase('id');
  const filteredTools = useMemo(() => {
    if (!query) return TOOLS;
    return TOOLS.filter((tool) => `${tool.title} ${tool.description} ${tool.group}`.toLocaleLowerCase('id').includes(query));
  }, [query]);
  const visibleTools = query ? filteredTools : filteredTools.filter((tool) => tool.group === activeGroup);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
      <header className="dashboard-hero relative mb-8 px-2 py-12 text-center sm:mb-10 sm:py-16">
        <span className="dashboard-hero-orbit dashboard-hero-orbit-one" aria-hidden="true"><FileImage size={30} /></span>
        <span className="dashboard-hero-orbit dashboard-hero-orbit-two" aria-hidden="true"><Scissors size={26} /></span>
        <span className="dashboard-hero-orbit dashboard-hero-orbit-three" aria-hidden="true"><Minimize2 size={25} /></span>
        <div className="relative z-10 mx-auto max-w-3xl">
          <p className="text-sm font-semibold tracking-wide text-blue-700">Alat untuk file</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">Beresin file, <span className="text-blue-600">tanpa ribet.</span></h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">Pilih alat, masukkan file, lalu beres. Semua bisa dilakukan langsung di sini.</p>
          <label className="mx-auto mt-7 block max-w-2xl text-left">
            <span className="sr-only">Cari alat</span>
            <input
              type="search"
              value={search}
              placeholder="Mau ngapain? Cari alat di sini..."
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 text-base text-slate-900 shadow-lg shadow-blue-900/5 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </label>
          {!search && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {([
                ['Kompres PDF', 'compress'], ['Gabungkan PDF', 'merge'], ['Kompres gambar', 'image-optimizer'],
              ] as const).map(([label, id]) => (
                <button key={id} type="button" onClick={() => onSelectTool(id)} className="rounded-full border border-blue-100 bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-blue-300 hover:text-blue-700 hover:shadow-md">
                  {label}<ArrowRight size={14} className="ml-1.5 inline-block" />
                </button>
              ))}
            </div>
          )}
          {!search && !activeGroup && (
            <button type="button" onClick={() => groupsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:gap-3">
              Lihat semua alat <ArrowDown size={16} />
            </button>
          )}
        </div>
      </header>

      {!query && !activeGroup ? (
        <section ref={groupsRef} className="scroll-mt-8">
        <div className="mb-5">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Pilih kategori</h2>
          <p className="mt-1 text-sm text-slate-500">Semua alat tersusun rapi, tinggal pilih yang kamu perlu.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((group) => {
            const count = TOOLS.filter((tool) => tool.group === group.name).length;
            const GroupIcon = group.icon;
            return (
              <button
                key={group.name}
                type="button"
                onClick={() => onActiveGroupChange(group.name)}
                className="tool-card group relative isolate flex min-h-36 flex-col items-start overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <GroupIcon className="tool-card-icon" size={76} strokeWidth={1.2} aria-hidden="true" />
                <span className="relative z-10 text-lg font-semibold text-slate-900 transition-colors group-hover:text-blue-700">{group.name}</span>
                <span className="relative z-10 mt-2 text-sm leading-5 text-slate-600">{group.description}</span>
                <span className="relative z-10 mt-auto flex w-full items-center justify-between pt-4 text-xs font-medium text-slate-500">
                  <span>{count} alat</span><ArrowRight size={15} className="text-blue-600 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            );
          })}
        </div>
        </section>
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
                  {(() => {
                    const ToolIcon = TOOL_ICONS[tool.id] ?? Files;
                    return <ToolIcon className="tool-card-icon" size={70} strokeWidth={1.2} aria-hidden="true" />;
                  })()}
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
