import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BriefcaseBusiness,
  FileImage,
  FileText,
  Files,
  Film,
  FolderOpen,
  Gamepad2,
  Minimize2,
  PenTool,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { ToolId, ToolMetadata } from '../../types';
import { getToolFileFormat } from '../../utils/file-format';

interface ToolDashboardProps {
  onSelectTool: (id: ToolId) => void;
}

const TOOLS: ToolMetadata[] = [
  {
    id: 'merge',
    title: 'Gabungkan PDF (Merge)',
    shortDesc: 'Satukan banyak file PDF dalam urutan pilihan. Waktu proses bergantung pada ukuran file dan perangkat.',
    category: 'organize',
    badge: 'Batch',
  },
  {
    id: 'split',
    title: 'Pisahkan PDF (Split)',
    shortDesc: 'Pisah berdasarkan rentang halaman atau ekstrak semua halaman otomatis ke file ZIP.',
    category: 'organize',
    badge: 'ZIP',
  },
  {
    id: 'organize',
    title: 'Atur & Gabungkan Halaman PDF',
    shortDesc: 'Lepas PDF untuk menambah halaman, seret thumbnail untuk menyusun urutan, dan klik untuk melihat halaman lebih besar.',
    category: 'organize',
  },
  {
    id: 'crop',
    title: 'Potong Area PDF',
    shortDesc: 'Lihat pratinjau halaman dan sesuaikan area crop dengan kontrol margin, lalu simpan sebagai PDF.',
    category: 'edit',
  },
  {
    id: 'compress',
    title: 'Kompres PDF',
    shortDesc: 'Kecilkan ukuran file PDF hasil scan dengan pilihan kualitas Ringan, Sedang, atau Ekstrem.',
    category: 'convert',
    badge: 'Hemat Ukuran',
  },
  {
    id: 'sign',
    title: 'Tanda Tangan & Stempel',
    shortDesc: 'Gambar atau unggah tanda tangan, lalu seret langsung ke posisi yang kamu mau di pratinjau PDF.',
    category: 'edit',
  },
  {
    id: 'img2pdf',
    title: 'Gambar ke PDF',
    shortDesc: 'Ubah banyak foto JPG, PNG, atau WebP menjadi satu dokumen PDF rapi.',
    category: 'convert',
  },
  {
    id: 'pdf2img',
    title: 'PDF ke Gambar (ZIP)',
    shortDesc: 'Ekstrak setiap halaman PDF menjadi gambar resolusi tinggi (JPG/PNG) dalam file ZIP.',
    category: 'convert',
  },
  {
    id: 'convert-documents',
    title: 'Konversi Dokumen',
    shortDesc: 'Konversi dua arah antara PDF, Word, Excel/CSV, PowerPoint, dan gambar.',
    category: 'convert',
    badge: 'PDF / DOCX / XLSX',
  },
  {
    id: 'ocr',
    title: 'Ekstrak Teks (OCR)',
    shortDesc: 'Ekstrak teks dari PDF scan atau screenshot PNG, JPG, dan WebP langsung di browser.',
    category: 'convert',
    badge: 'PDF / GAMBAR',
  },
  {
    id: 'watermark',
    title: 'Watermark & Nomor Halaman',
    shortDesc: 'Tambahkan cap dan nomor halaman, lalu seret keduanya langsung di pratinjau PDF yang dapat diperbesar.',
    category: 'edit',
  },
  {
    id: 'protect',
    title: 'Sensor (Redact) & Buka PDF',
    shortDesc: 'Tutup area data sensitif/rahasia secara permanen dengan kotak hitam, atau hilangkan proteksi.',
    category: 'security',
  },
  {
    id: 'spreadsheet',
    title: 'Excel & CSV Merger',
    shortDesc: 'Gabungkan tabel, rapikan isi kolom, dan hapus duplikat sebelum ekspor.',
    category: 'office',
    badge: 'XLSX / CSV',
  },
  {
    id: 'image-optimizer',
    title: 'Bulk Image Optimizer',
    shortDesc: 'Kompres, resize, ubah format, dan beri watermark pada banyak gambar.',
    category: 'convert',
    badge: 'ZIP',
  },
  {
    id: 'code-generator',
    title: 'QR & Barcode Generator',
    shortDesc: 'Susun kode berlabel menjadi lembar cetak PDF ukuran A4.',
    category: 'office',
    badge: 'PDF',
  },
  {
    id: 'mail-merge',
    title: 'Mail Merge DOCX',
    shortDesc: 'Isi template Word dengan data Excel/CSV dan unduh dokumen massal.',
    category: 'office',
    badge: 'DOCX',
  },
  {
    id: 'media',
    title: 'Audio & Video Compressor',
    shortDesc: 'Kompres MP4, potong klip, atau ekstrak audio ke MP3.',
    category: 'media',
    badge: 'WASM',
  },
  {
    id: 'ai-studio',
    title: 'AI Background Remover & OCR',
    shortDesc: 'Hapus latar lokal gratis atau gunakan Cloud untuk detail lebih baik; tersedia juga OCR gambar batch.',
    category: 'office',
    badge: 'LOKAL / CLOUD',
  },
  {
    id: 'calculator',
    title: 'Scientific Calculator',
    shortDesc: 'Kalkulator ilmiah dengan trigonometri, logaritma, pangkat, faktorial, mode DEG/RAD, dan riwayat.',
    category: 'office',
    badge: 'DEG / RAD',
  },
  {
    id: 'games',
    title: 'Mini Games',
    shortDesc: 'Main Sudoku, 2048, atau Zip langsung di browser.',
    category: 'games',
    badge: '3 GAMES',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'Semua', Icon: Files },
  { id: 'organize', label: 'Kelola & Urutkan', Icon: FolderOpen },
  { id: 'convert', label: 'Konversi & Kompres', Icon: RefreshCw },
  { id: 'edit', label: 'Edit & Stempel', Icon: PenTool },
  { id: 'security', label: 'Keamanan', Icon: ShieldCheck },
  { id: 'office', label: 'Office', Icon: BriefcaseBusiness },
  { id: 'media', label: 'Media', Icon: Film },
  { id: 'games', label: 'Games', Icon: Gamepad2 },
];

export function ToolDashboard({ onSelectTool }: ToolDashboardProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const heroRef = useRef<HTMLElement>(null);
  const heroTrackRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let previousTime = 0;
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const animate = (time: number) => {
      const progress = 1 - Math.exp(-(time - previousTime) / 95);
      previousTime = time;
      currentX += (targetX - currentX) * progress;
      currentY += (targetY - currentY) * progress;

      hero.style.setProperty('--parallax-x', `${currentX * 24}px`);
      hero.style.setProperty('--parallax-y', `${currentY * 22}px`);
      hero.style.setProperty('--parallax-x-back', `${currentX * -12}px`);
      hero.style.setProperty('--parallax-y-back', `${currentY * -11}px`);
      hero.style.setProperty('--parallax-x-front', `${currentX * 14}px`);
      hero.style.setProperty('--parallax-y-front', `${currentY * 12}px`);

      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        frame = window.requestAnimationFrame(animate);
      } else {
        currentX = targetX;
        currentY = targetY;
        frame = 0;
      }
    };

    const scheduleAnimation = () => {
      if (!frame) {
        previousTime = performance.now();
        frame = window.requestAnimationFrame(animate);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const bounds = hero.getBoundingClientRect();
      targetX = ((event.clientX - bounds.left - bounds.width / 2) / bounds.width) * 2;
      targetY = ((event.clientY - bounds.top - bounds.height / 2) / bounds.height) * 2;
      scheduleAnimation();
    };

    const handlePointerLeave = () => {
      targetX = 0;
      targetY = 0;
      scheduleAnimation();
    };

    hero.addEventListener('pointermove', handlePointerMove);
    hero.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      window.cancelAnimationFrame(frame);
      hero.removeEventListener('pointermove', handlePointerMove);
      hero.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const track = heroTrackRef.current;
    if (!hero || !track) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        hero.style.setProperty('--parallax-scroll', '0px');
        hero.style.setProperty('--parallax-scroll-back', '0px');
        hero.style.setProperty('--hero-scroll-progress', '0%');
        hero.style.setProperty('--hero-phone-scale', '1');
        hero.style.setProperty('--hero-title-scale', '1');
        return;
      }
      const bounds = track.getBoundingClientRect();
      const holdDistance = Math.max(1, track.offsetHeight - hero.offsetHeight);
      const progress = Math.max(0, Math.min(1, -bounds.top / holdDistance));
      hero.style.setProperty('--parallax-scroll', `${progress * 24}px`);
      hero.style.setProperty('--parallax-scroll-back', `${progress * -18}px`);
      hero.style.setProperty('--hero-scroll-progress', `${progress * 100}%`);
      hero.style.setProperty('--hero-phone-scale', `${1 - progress * 0.5}`);
      hero.style.setProperty(
        '--hero-title-scale',
        `${1 + progress * (window.innerWidth < 640 ? 0.18 : 0.32)}`,
      );
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, []);

  const filteredTools = TOOLS.filter((tool) => {
    const matchCat = activeCategory === 'all' || tool.category === activeCategory;
    const matchSearch =
      tool.title.toLowerCase().includes(search.toLowerCase()) ||
      tool.shortDesc.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="w-full">
      <div ref={heroTrackRef} className="hero-scroll-track">
        <section
          ref={heroRef}
          className="pdf-hero group relative isolate grid min-h-screen grid-cols-1 items-center overflow-hidden px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-4 lg:px-12"
        >
        <div className="pdf-hero-copy relative z-10">
          <h1 className="hero-title max-w-xl text-4xl font-black leading-[0.98] tracking-[-0.06em] text-slate-950 sm:text-5xl lg:text-[4.05rem]">
            Kerjaan file?
            <span className="block">
              <span className="hero-outline">Beres.</span> Lanjut.
            </span>
          </h1>
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              { label: 'PDF', Icon: Files },
              { label: 'Office', Icon: FileText },
              { label: 'Media', Icon: FileImage },
            ].map(({ label, Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 backdrop-blur-md"
              >
                <Icon aria-hidden="true" size={13} className="text-blue-600" />
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => toolsMenuRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(29,78,216,0.22)] transition hover:-translate-y-0.5 hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
          >
            Pilih alat
            <ArrowRight aria-hidden="true" size={16} />
          </button>
        </div>

        <div aria-hidden="true" className="pdf-hero-art relative z-[1] mx-auto mt-7 h-[310px] w-full max-w-[500px] sm:h-[390px] lg:mt-0 lg:h-[450px]">
          <div className="hero-aura absolute left-1/2 top-1/2 h-[78%] w-[75%] rounded-full" />
          <div className="hero-doc-back absolute left-[7%] top-[25%] flex h-[48%] w-[34%] flex-col rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl sm:p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-lg bg-rose-50 p-2 text-rose-500"><FileText size={18} /></span>
              <span className="text-[9px] font-semibold tracking-widest text-slate-400">PDF</span>
            </div>
            <span className="mt-3 h-1.5 w-4/5 rounded-full bg-slate-200" />
            <span className="mt-2 h-1.5 w-full rounded-full bg-slate-100" />
            <span className="mt-2 h-1.5 w-3/5 rounded-full bg-slate-100" />
            <span className="mt-auto text-[9px] text-slate-500">proposal-final.pdf</span>
          </div>
          <div className="hero-doc-front absolute right-[5%] top-[21%] flex h-[43%] w-[31%] flex-col rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl sm:p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Minimize2 size={16} /></span>
            <span className="mt-3 text-[9px] font-semibold text-slate-500">Ukuran file</span>
            <span className="mt-1 text-lg font-bold text-slate-900 sm:text-2xl">−62%</span>
            <span className="mt-auto h-1.5 w-full rounded-full bg-slate-100"><span className="block h-full w-2/3 rounded-full bg-emerald-400" /></span>
          </div>
          <div className="hero-phone-parallax absolute left-1/2 top-1/2 z-10">
            <div className="hero-phone">
              <div className="hero-phone-screen">
                <div className="hero-phone-island" />
                <div className="flex items-center justify-between px-1 pt-2 text-[8px] font-semibold text-slate-500">
                  <span>fatihworkingtools</span><span>•••</span>
                </div>
                <div className="mt-5 text-[9px] font-medium text-slate-500">SEMUA BERES</div>
                <div className="mt-1 text-xl font-bold tracking-tight text-slate-950">File kamu,<br />siap jalan.</div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-blue-50 p-2.5"><Files size={16} className="text-blue-600" /><span className="mt-2 block text-[8px] font-semibold text-slate-700">Gabung PDF</span></div>
                  <div className="rounded-xl bg-violet-50 p-2.5"><FileText size={16} className="text-violet-600" /><span className="mt-2 block text-[8px] font-semibold text-slate-700">Excel & CSV</span></div>
                  <div className="rounded-xl bg-emerald-50 p-2.5"><Minimize2 size={16} className="text-emerald-600" /><span className="mt-2 block text-[8px] font-semibold text-slate-700">Kompres</span></div>
                  <div className="rounded-xl bg-orange-50 p-2.5"><FileImage size={16} className="text-orange-600" /><span className="mt-2 block text-[8px] font-semibold text-slate-700">Gambar</span></div>
                </div>
                <div className="mt-4 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm">
                  <div className="flex items-center justify-between text-[8px] font-semibold text-slate-500"><span>Diproses lokal</span><span className="text-emerald-600">100%</span></div>
                  <div className="mt-2 h-1 rounded-full bg-slate-100"><div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" /></div>
                </div>
              </div>
            </div>
          </div>
          <div className="hero-glass-chip absolute bottom-[13%] left-[5%] z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-700 shadow-lg backdrop-blur-xl sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_2px_rgba(16,185,129,0.25)]" />
            File tetap di perangkatmu
          </div>
          <div className="hero-glass-chip hero-chip-top absolute right-[8%] top-[12%] z-20 flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 text-[10px] font-semibold text-slate-700 shadow-lg backdrop-blur-xl sm:text-xs">
            <Files size={14} className="text-blue-600" />
            Semua tools, satu tempat
          </div>
        </div>
        </section>
      </div>

      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 sm:px-6">
        {/* Filter Tabs & Search */}
        <div ref={toolsMenuRef} className="scroll-mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 pb-2 sm:pb-0">
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeCategory === id}
              onClick={() => setActiveCategory(id)}
              className={`tool-category-button group relative isolate overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeCategory === id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span aria-hidden="true" className="tool-category-icon pointer-events-none absolute -bottom-2 -right-1">
                <Icon size={28} />
              </span>
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari alat..."
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none w-full sm:w-56"
        />
        </div>

        {/* Grid of Tools */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool, index) => {
            const CategoryIcon = CATEGORIES.find((category) => category.id === tool.category)?.Icon ?? Files;
            return (
            <div
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              style={{ animationDelay: `${Math.min(index * 55, 440)}ms` }}
              className="tool-card group relative isolate flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-gray-200 bg-white p-5 transition hover:-translate-y-1 hover:border-blue-400 hover:shadow-md"
            >
              <CategoryIcon aria-hidden="true" className="tool-card-icon pointer-events-none absolute -bottom-5 -right-4 h-28 w-28" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className={`format-chip format-chip-${getToolFileFormat(tool.id).color}`}>
                    {getToolFileFormat(tool.id).label}
                  </span>
                  {tool.badge && (
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-600">
                      {tool.badge}
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                  {tool.shortDesc}
                </p>
              </div>

              <div className="relative z-10 mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-medium text-blue-600">
                <span>Buka alat</span>
                <span className="font-mono">→</span>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
