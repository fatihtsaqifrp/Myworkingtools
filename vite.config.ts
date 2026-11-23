import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
          dest: 'assets/tessdata',
        },
        {
          src: 'node_modules/@tesseract.js-data/ind/4.0.0_best_int/ind.traineddata.gz',
          dest: 'assets/tessdata',
        },
        {
          src: 'node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm*',
          dest: 'assets/tesscore',
        },
        {
          src: 'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm*',
          dest: 'assets/tesscore',
        },
        {
          src: 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm*',
          dest: 'assets/tesscore',
        },
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'fatihworkingtools — PDF, Office & Productivity Tools',
        short_name: 'fatihworkingtools',
        description: 'PDF, spreadsheet, image, QR, mail merge, media, and OCR tools.',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 70 * 1024 * 1024,
        globPatterns: ['**/*.{html,css,ico,png,svg,webmanifest}', 'assets/index-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/.+\.(?:js|mjs|wasm|gz)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'on-demand-tool-assets',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/@imgly\/background-removal@1\.1\.5\/dist\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'background-removal-model',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/pdf-lib')) return 'pdf-lib';
          if (id.includes('node_modules/pdfjs-dist')) return 'pdfjs';
          if (id.includes('node_modules/jszip')) return 'jszip';
          if (id.includes('node_modules/tesseract.js')) return 'tesseract';
          if (id.includes('node_modules/xlsx')) return 'spreadsheet';
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'jszip'],
  },
});
