# fatihworkingtools — PDF, Office & Productivity Tools

Aplikasi web untuk PDF, spreadsheet, gambar, QR/barcode, mail merge, audio/video, background removal, OCR, kalkulator ilmiah, dan mini games. Background removal menyediakan mode lokal di browser dan mode Cloud withoutBG; OCR memakai OCR.space Engine 3 melalui server. Aplikasi mendukung PWA dan dapat di-deploy di Render tanpa database.

Waktu proses aktual ditampilkan setelah pekerjaan selesai, tetapi tidak dapat dijamin di bawah satu menit untuk semua file. Ukuran/jumlah file, WASM yang perlu dimuat pertama kali, memori, dan kecepatan perangkat memengaruhi hasil.

---

## ⚡ Arsitektur & Rekayasa Performa Tinggi

1. **Chunked Tree-Merging (Divide & Conquer)**:
   - Menghindari bottleneck internal tabel objek `pdf-lib` saat menyatukan ribuan halaman.
   - Menggabungkan halaman ke dalam *intermediate buffer* (per 250–500 halaman) terlebih dahulu, lalu menyatukan pohon dokumen di level kedua (*final consolidation*).

2. **Dedicated Web Workers & Transferable Objects**:
   - Operasi berat seperti Merge, Split, Watermark, dan konversi gambar dijalankan di latar belakang menggunakan *Web Worker*.
   - Menggunakan `Transferable Objects` (`ArrayBuffer`) untuk memindahkan data antar-thread tanpa overhead duplikasi memori (*zero-copy transfer*).

3. **Menjaga Kualitas Dokumen**:
   - Tidak pernah melakukan kompresi ulang gambar raster saat operasi merge/split, menjaga kualitas asli dokumen 100%.
   - Preview dan konversi halaman membersihkan canvas setelah pemakaian untuk mengurangi penggunaan memori.

4. **Progress Bar & Telemetri Real-Time**:
   - Menghitung kecepatan proses secara langsung (`halaman/detik`).
   - Stopwatch durasi pengerjaan, estimasi waktu tersisa (ETA), dan ringkasan total waktu setelah selesai.
   - Operasi yang mendukungnya menyediakan tombol pembatalan.

5. **PWA**:
   - Menggunakan `vite-plugin-pwa`; app shell di-precache dan aset fitur opsional dimuat saat digunakan agar ukuran unduhan awal tetap kecil.
   - Dapat diinstal sebagai aplikasi desktop atau mobile. Modul OCR mengirim gambar melalui server ke OCR.space.

---

## 🛠️ Daftar Fitur Lengkap (19 Alat Power-User)

| Alat | Deskripsi & Keunggulan |
| :--- | :--- |
| **1. Super Merge PDF** | Gabungkan beberapa file dengan *Natural Alphanumeric Sort* (A-Z, 1, 2, 10...), drag-and-drop folder, stopwatch durasi, dan auto-download. |
| **2. Batch Split PDF** | Pisah PDF berdasarkan rentang (`1-5, 8, 10-20`), per X halaman, atau ekstrak semua halaman. Otomatis dikemas dalam file **.ZIP** via `jszip`. |
| **3. Atur & Gabungkan Halaman PDF** | Lepas PDF untuk menambahkan halaman, seret thumbnail untuk menyusun urutan, buka pratinjau besar, putar, dan hapus halaman. |
| **4. Crop PDF** | Pratinjau halaman dan sesuaikan margin crop. Area potong dapat diterapkan ke semua halaman dan diekspor sebagai PDF. |
| **5. Sign & Stamp PDF** | Gambar tanda tangan, unggah PNG transparan, atau buat stempel teks; seret langsung di pratinjau PDF yang dapat diperbesar untuk menentukan posisi. |
| **6. Batch Compress PDF** | Perkecil ukuran PDF hasil scan dengan 3 tingkat kompresi: **Ringan** (DPI 150), **Sedang/Rekomendasi** (DPI 100), atau **Ekstrem** (DPI 72, hemat s/d 85%). |
| **7. Images ke PDF** | Ubah ratusan foto/gambar (JPG, PNG, WebP) menjadi satu dokumen PDF rapi dengan opsi ukuran A4 atau menyesuaikan dimensi gambar (*fit*). |
| **8. PDF ke Images (ZIP)** | Ekstrak setiap lembar halaman PDF menjadi file gambar beresolusi tinggi (JPG/PNG) dan otomatis diunduh dalam file `.zip`. |
| **9. Watermark & Nomor Halaman** | Tambahkan cap teks dan nomor halaman otomatis, lalu seret keduanya langsung di pratinjau PDF yang dapat diperbesar. |
| **10. Protect & Redact PDF** | Sensor (*redact*) area informasi rahasia secara permanen (menutup teks agar tidak bisa disalin) serta fitur dekripsi/buka proteksi PDF. |
| **11. OCR.space Scanner** | Ekstrak teks dari gambar atau PDF dengan Engine 3, deteksi orientasi, deteksi bahasa, dan mode tabel. File dikirim melalui server ke OCR.space. |
| **12. Excel & CSV Merger** | Gabungkan CSV/XLS/XLSX, normalisasi teks, deduplikasi kolom, dan ekspor CSV/XLSX. |
| **13. Bulk Image Optimizer** | Kompres dan ubah format gambar, resize, watermark teks/logo, lalu unduh ZIP. |
| **14. QR & Barcode Generator** | Buat QR/Code 128 dari teks, CSV, atau Excel dan susun sebagai PDF A4. |
| **15. DOCX Mail Merge** | Isi template Word dari CSV/Excel lalu unduh dokumen personalisasi dalam ZIP. |
| **16. Audio & Video Tools** | Kompres MP4, trim klip, atau ekstrak MP3 dengan FFmpeg WebAssembly. |
| **17. Background Remover & OCR** | Hapus latar foto melalui API cloud withoutBG atau proses gratis secara lokal; OCR gambar dikirim ke OCR.space dalam Bahasa Indonesia/English. |
| **18. Scientific Calculator** | Kalkulator ilmiah lokal dengan fungsi trigonometri (DEG/RAD), logaritma, akar, pangkat, faktorial, konstanta, dan riwayat perhitungan. |
| **19. Mini Games** | Main Sudoku, 2048, Zip, Patches (susun patch warna dengan drag-and-drop), dan Queens langsung di browser tanpa backend. |

### Batas pemrosesan dan ketergantungan

- Untuk melindungi memori tab, beberapa modul membatasi jumlah/ukuran file dan jumlah baris/dokumen per batch; batas yang tepat ditampilkan pada pesan validasi.
- OCR.space Scanner dan Bulk Image OCR memerlukan `OCR_SPACE_API_KEY` di environment server. File dikirim ke server lalu diteruskan ke OCR.space; jangan gunakan untuk dokumen rahasia jika tidak menyetujui pemrosesan pihak ketiga. Server membatasi file hingga 1 MB dan 10 permintaan per menit per IP pada tiap instance (best effort, bukan kuota global). Paket gratis OCR.space membatasi PDF hingga 3 halaman dan Engine 3 hingga 1.000 konversi per bulan. Lihat [dokumentasi OCR.space](https://ocr.space/ocrapi).
- Background removal mode lokal memakai model MODNet melalui Transformers.js; model/runtime sekitar 34 MB diunduh saat pertama digunakan dan gambar tidak dikirim ke server. Mode Cloud withoutBG memakai 1 kredit per gambar yang berhasil dan mengirim gambar ke layanan; maksimum 20 MB per gambar dan 10 gambar per menit.
- Crop PDF mengubah batas tampilan (`CropBox`); konten di luar batas crop tidak dihapus permanen dan mungkin masih bisa dipulihkan.
- Output background removal disediakan sebagai file PNG terpisah. Untuk batch, unduh tiap gambar dari tautan hasil agar browser tidak memblokir unduhan otomatis bertubi-tubi.
- Semua alat berat dijalankan di Web Worker bila didukung. Batas memori dan codec browser/perangkat tetap berlaku; error proses ditampilkan di UI dan tidak dianggap berhasil.
- Paket Excel menggunakan API SheetJS Community Edition melalui distribusi kompatibel `@e965/xlsx` 0.20.3 (Apache-2.0) untuk menghindari versi `xlsx` npm lama yang tidak memiliki rilis perbaikan keamanan.
- Pengguna menyetujui dependensi copyleft: `@ffmpeg/core` (GPL-2.0-or-later). Distribusi publik perlu mematuhi lisensi sumbernya.

---

## 📁 Struktur Direktori Proyek

```
/Users/fatihtsaqif/Downloads/Merge/
├── index.html                           # Entry HTML dengan metadata PWA
├── netlify.toml                         # Konfigurasi Netlify (COOP, COEP, CSP, Cache)
├── netlify/functions/ocr.mjs            # Proxy serverless OCR.space dengan API key rahasia
├── package.json                         # Dependensi PDF, Office, media, OCR, dan WASM
├── tsconfig.json                        # Konfigurasi TypeScript ES2022
├── vite.config.ts                       # Konfigurasi Vite, PWA, & manual chunk splitting
├── README.md                            # Dokumentasi lengkap arsitektur
├── public/
│   └── favicon.svg                      # Favicon aplikasi
└── src/
    ├── App.tsx                          # Router state dashboard & navigasi alat
    ├── index.css                        # Styling Tailwind CSS v4
    ├── main.tsx                         # Entry React DOM
    ├── vite-env.d.ts                    # Tipe lingkungan Vite
    ├── types/
    │   └── index.ts                     # Definisi interface & data model lengkap
    ├── utils/
    │   ├── natural-sort.ts              # Natural sorting & formater durasi/bytes
    │   └── pdfjs-config.ts              # Inisialisasi Mozilla PDF.js & canvas renderer
    ├── workers/
    │   ├── merge.worker.ts              # Engine Chunked Tree-Merging (15.000+ hal)
    │   ├── split.worker.ts              # Engine pemisah halaman & generator ZIP
    │   ├── crop.worker.ts               # Crop area PDF
    │   ├── image-converter.worker.ts    # Engine Images <-> PDF & kompresor ZIP
    │   ├── watermark.worker.ts          # Engine Watermark, stempel, rotasi, & nomor halaman
    │   ├── table-merge.worker.ts        # Merge/deduplikasi CSV dan Excel
    │   ├── image-optimizer.worker.ts    # Kompres gambar, resize, watermark, ZIP
    │   ├── code-pdf.worker.ts           # Rasterisasi kode dan layout PDF A4
    │   ├── mail-merge.worker.ts         # Render template DOCX dan paket ZIP
    │   ├── media.worker.ts              # FFmpeg WebAssembly untuk media
    │   ├── background-removal.worker.ts # Mask AI lokal dan perapian tepi terpandu
    │   └── office/
    │       └── table-data.ts            # Parser dan sanitasi tabel bersama
    └── components/
        ├── layout/
        │   ├── Navbar.tsx               # Header navigasi, badge privasi & PWA status
        │   └── Footer.tsx               # Catatan arsitektur & jaminan privasi
        ├── common/
        │   ├── DropZone.tsx             # Area drop multi-file & folder rekursif
        │   ├── ProgressBar.tsx          # Telemetri live: stopwatch, speed, ETA, & batal
        │   └── ResultCard.tsx           # Panel hasil, laporan waktu/efisiensi, & unduh
        └── tools/
            ├── ToolDashboard.tsx        # Katalog 17 alat
            ├── MergeTool.tsx            # Super Merge PDF
            ├── SplitTool.tsx            # Batch Split PDF
            ├── OrganizeTool.tsx         # Drag-and-drop pages, zoom preview, rotate & delete
            ├── CropTool.tsx             # Pratinjau dan crop area PDF
            ├── SignStampTool.tsx        # Sign & Stamp PDF
            ├── CompressTool.tsx         # Batch Compress PDF
            ├── ImagePdfTool.tsx         # PDF <-> Images Bulk Converter
            ├── WatermarkTool.tsx        # Watermark & Nomor Halaman
            ├── ProtectTool.tsx          # Protect & Redact PDF
            ├── OcrTool.tsx              # WebAssembly OCR Scanner
            └── office/                  # Enam alat Office/media yang lazy-loaded
                ├── SpreadsheetTool.tsx
                ├── ImageOptimizerTool.tsx
                ├── CodeGeneratorTool.tsx
                ├── MailMergeTool.tsx
                ├── MediaTool.tsx
                ├── AIStudioTool.tsx
                ├── OfficeToolFrame.tsx
                └── useOfficeWorker.ts
```

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
# 1. Masuk ke direktori
cd /Users/fatihtsaqif/Downloads/Merge

# 2. Pasang dependensi
npm install

# 3. Jalankan server pengembangan
npm run dev
# Buka http://localhost:5173

# 4. Tes build produksi statis
npm run build
npm run preview
```

---

## 🌐 Deploy ke Render (tanpa database)

Blueprint `render.yaml` membuat satu Node web service yang menyajikan frontend dan API proxy. Tidak ada database.

1. Push repository ke GitHub dan buat Blueprint di Render dari repository tersebut.
2. Isi `OCR_SPACE_API_KEY` bila ingin menggunakan OCR.
3. Render menjalankan `npm ci && npm run build`, lalu `npm start`. Health check tersedia di `/api/health`.

Mode lokal background removal tidak memakai key atau kredit. Untuk mode Cloud, isi `WITHOUTBG_API_KEY` di environment variables Render. Kedua OCR memerlukan `OCR_SPACE_API_KEY`. Semua key tetap rahasia di server.
# Myworkingtools
