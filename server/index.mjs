import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT) || 10000;
const DIST_DIR = resolve('dist');
const MAX_BG_BYTES = 20 * 1024 * 1024;
const MAX_OCR_BYTES = 1024 * 1024;
const MIME_TYPES = {
  '.avif': 'image/avif', '.css': 'text/css; charset=utf-8', '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8', '.ico': 'image/x-icon', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const recentRequests = new Map();

function setHeaders(response) {
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob: data: https://unpkg.com https://huggingface.co https://hf.co https://*.huggingface.co https://*.hf.co; font-src 'self' data:; object-src 'none'");
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function isSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return request.headers['sec-fetch-site'] !== 'cross-site';
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

function isRateLimited(ip, max = 10) {
  const now = Date.now();
  const requests = (recentRequests.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (requests.length >= max) {
    recentRequests.set(ip, requests);
    return true;
  }
  requests.push(now);
  recentRequests.set(ip, requests);
  return false;
}

function getClientIp(request) {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length) return forwardedFor.split(',')[0].trim();
  return request.socket.remoteAddress ?? 'unknown';
}

async function parseForm(request, response, maxBytes) {
  const length = Number(request.headers['content-length']);
  if (Number.isFinite(length) && length > maxBytes + 128 * 1024) {
    json(response, 413, { error: 'Ukuran unggahan melewati batas.' });
    request.resume();
    return null;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes + 128 * 1024) {
      json(response, 413, { error: 'Ukuran unggahan melewati batas.' });
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  try {
    const body = Buffer.concat(chunks);
    const webRequest = new Request(`http://${request.headers.host}${request.url}`, {
      method: request.method,
      headers: { 'content-type': request.headers['content-type'] ?? '' },
      body: Readable.toWeb(Readable.from([body])),
      duplex: 'half',
    });
    return await webRequest.formData();
  } catch {
    json(response, 400, { error: 'Format unggahan tidak valid.' });
    return null;
  }
}

async function removeBackgroundCloud(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Metode request tidak didukung.' });
  if (!isSameOrigin(request)) return json(response, 403, { error: 'Request harus berasal dari aplikasi ini.' });
  if (isRateLimited(getClientIp(request), 10)) {
    return json(response, 429, { error: 'Terlalu banyak permintaan. Coba lagi satu menit lagi.' });
  }
  const apiKey = process.env.WITHOUTBG_API_KEY;
  if (!apiKey) return json(response, 503, { error: 'Cloud belum dikonfigurasi. Admin perlu mengatur WITHOUTBG_API_KEY di Render.' });

  const form = await parseForm(request, response, MAX_BG_BYTES);
  if (!form) return;
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) return json(response, 400, { error: 'Pilih foto yang valid.' });
  if (file.size > MAX_BG_BYTES) return json(response, 413, { error: 'Ukuran maksimum foto adalah 20 MB.' });
  const accepted = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/tiff', 'image/bmp', 'image/gif']);
  if (!accepted.has(file.type)) return json(response, 415, { error: 'Format tidak didukung oleh layanan Cloud.' });

  const upstreamForm = new FormData();
  upstreamForm.append('file', file, file.name || 'image');
  let upstream;
  try {
    upstream = await fetch('https://api.withoutbg.com/v1.0/image-without-background', {
      method: 'POST', headers: { 'X-API-Key': apiKey }, body: upstreamForm,
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError';
    return json(response, timeout ? 504 : 502, { error: timeout ? 'Cloud terlalu lama merespons. Coba lagi.' : 'Tidak dapat menghubungi layanan Cloud.' });
  }
  if (!upstream.ok) {
    const messages = {
      401: 'Key Cloud tidak valid.', 402: 'Kredit API habis.', 403: 'Kredit API kedaluwarsa.',
      413: 'Ukuran maksimum foto adalah 20 MB.', 415: 'Format foto tidak didukung.',
      422: 'Layanan tidak dapat memproses foto ini.', 429: 'Layanan sedang sibuk. Coba lagi nanti.',
    };
    return json(response, upstream.status >= 500 ? 502 : upstream.status, {
      error: messages[upstream.status] ?? `Layanan gagal memproses foto (HTTP ${upstream.status}).`,
    });
  }
  const result = Buffer.from(await upstream.arrayBuffer());
  if (!result.length || !upstream.headers.get('content-type')?.includes('image/png')) {
    return json(response, 502, { error: 'Layanan mengirim hasil gambar yang tidak valid.' });
  }
  response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
  response.end(result);
}

async function getWithoutBgCredits(request, response) {
  if (request.method !== 'GET') return json(response, 405, { error: 'Metode request tidak didukung.' });
  if (!isSameOrigin(request)) return json(response, 403, { error: 'Request harus berasal dari aplikasi ini.' });
  const apiKey = process.env.WITHOUTBG_API_KEY;
  if (!apiKey) return json(response, 503, { error: 'WITHOUTBG_API_KEY belum diatur di Render.' });
  try {
    const upstream = await fetch('https://api.withoutbg.com/available-credit', {
      headers: { 'X-API-Key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    let result;
    try { result = await upstream.json(); }
    catch { return json(response, 502, { error: 'Layanan kredit mengirim respons yang tidak valid.' }); }
    if (!upstream.ok || !Number.isInteger(result?.credit) || typeof result?.expiration_date !== 'string') {
      return json(response, upstream.status >= 500 ? 502 : upstream.status || 502, {
        error: upstream.status === 401 ? 'WITHOUTBG_API_KEY tidak valid.' : 'Saldo kredit tidak dapat dibaca dari withoutBG.',
      });
    }
    return json(response, 200, { credit: result.credit, expiration_date: result.expiration_date });
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError';
    return json(response, timeout ? 504 : 502, { error: timeout ? 'Layanan kredit terlalu lama merespons.' : 'Tidak dapat menghubungi withoutBG.' });
  }
}

async function runOcr(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Metode request tidak didukung.' });
  if (!isSameOrigin(request)) return json(response, 403, { error: 'Request harus berasal dari aplikasi ini.' });
  if (isRateLimited(getClientIp(request))) {
    return json(response, 429, { error: 'Terlalu banyak permintaan. Coba lagi satu menit lagi.' });
  }
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) return json(response, 503, { error: 'OCR.space belum dikonfigurasi. Atur OCR_SPACE_API_KEY di Render.' });
  const form = await parseForm(request, response, MAX_OCR_BYTES);
  if (!form) return;
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size) return json(response, 400, { error: 'Pilih file PDF atau gambar terlebih dahulu.' });
  if (file.size > MAX_OCR_BYTES) return json(response, 413, { error: 'Paket gratis OCR.space membatasi ukuran file hingga 1 MB.' });
  if (!/\.(pdf|png|jpe?g|gif|tif|tiff|bmp)$/i.test(file.name)) return json(response, 415, { error: 'Format tidak didukung.' });
  const requestedLanguage = form.get('language');
  if (requestedLanguage !== null && requestedLanguage !== 'auto' && requestedLanguage !== 'ind' && requestedLanguage !== 'eng') {
    return json(response, 400, { error: 'Bahasa OCR tidak didukung.' });
  }

  const ocrForm = new FormData();
  ocrForm.append('file', file, file.name);
  ocrForm.set('language', requestedLanguage ?? 'auto');
  ocrForm.set('OCREngine', '3');
  ocrForm.set('isTable', 'true');
  ocrForm.set('detectOrientation', 'true');
  ocrForm.set('scale', 'true');
  ocrForm.set('isOverlayRequired', 'false');
  try {
    const upstream = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST', headers: { apikey: apiKey }, body: ocrForm, signal: AbortSignal.timeout(25_000),
    });
    let result;
    try { result = await upstream.json(); } catch { return json(response, 502, { error: 'OCR.space mengirim respons yang tidak valid.' }); }
    const errorMessage = Array.isArray(result?.ErrorMessage) ? result.ErrorMessage.join(' ') : result?.ErrorMessage;
    if (!upstream.ok || result?.IsErroredOnProcessing) {
      return json(response, upstream.status >= 500 ? 502 : upstream.status, { error: errorMessage || `OCR.space gagal memproses file (HTTP ${upstream.status}).` });
    }
    const text = Array.isArray(result?.ParsedResults) ? result.ParsedResults.map((entry) => entry.ParsedText || '').join('\n').trim() : '';
    if (!text) return json(response, 422, { error: errorMessage || 'Tidak ada teks yang berhasil dibaca dari file ini.' });
    return json(response, 200, { text, processingTimeMs: result?.ProcessingTimeInMilliseconds });
  } catch (error) {
    const timeout = error instanceof Error && error.name === 'TimeoutError';
    return json(response, timeout ? 504 : 502, { error: timeout ? 'OCR.space terlalu lama merespons.' : 'Tidak dapat menghubungi OCR.space.' });
  }
}

async function serveStatic(request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { return json(response, 400, { error: 'URL tidak valid.' }); }
  const candidate = resolve(DIST_DIR, `.${pathname}`);
  if (candidate !== DIST_DIR && !candidate.startsWith(`${DIST_DIR}${sep}`)) return json(response, 404, { error: 'Tidak ditemukan.' });
  let filePath = candidate;
  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = resolve(filePath, 'index.html');
    await stat(filePath);
  } catch {
    filePath = resolve(DIST_DIR, 'index.html');
  }
  try {
    const body = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    const immutable = pathname.startsWith('/assets/') && /\.[a-f0-9]{8,}\./i.test(pathname);
    const serviceWorkerAsset = /^\/(?:sw\.js|registerSW\.js|workbox-[^/]+\.js)$/.test(pathname);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'Cache-Control': filePath.endsWith('index.html') || serviceWorkerAsset
        ? 'no-cache, no-store, must-revalidate'
        : immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    });
    response.end(body);
  } catch {
    json(response, 404, { error: 'Tidak ditemukan.' });
  }
}

const server = createServer(async (request, response) => {
  setHeaders(response);
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/health') return json(response, 200, { ok: true });
    if (pathname === '/api/remove-background-cloud') return await removeBackgroundCloud(request, response);
    if (pathname === '/api/withoutbg/credits') return await getWithoutBgCredits(request, response);
    if (pathname === '/api/ocr') return await runOcr(request, response);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Metode request tidak didukung.' });
    return await serveStatic(request, response);
  } catch (error) {
    console.error('Request failed:', error);
    if (!response.headersSent) return json(response, 500, { error: 'Terjadi kesalahan server. Coba lagi.' });
    response.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on ${PORT}`));
