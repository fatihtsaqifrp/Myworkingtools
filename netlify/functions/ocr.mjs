const OCR_SPACE_URL = 'https://api.ocr.space/parse/image';
const MAX_FILE_SIZE = 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestsByIp = new Map();
const allowedFileName = /\.(pdf|png|jpe?g|gif|tif|tiff|bmp)$/i;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function getErrorMessage(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string').join(' ');
  return typeof value === 'string' ? value : '';
}

function isRateLimited(ip) {
  const now = Date.now();
  const recentRequests = (requestsByIp.get(ip) ?? [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestsByIp.set(ip, recentRequests);
    return true;
  }
  recentRequests.push(now);
  requestsByIp.set(ip, recentRequests);
  return false;
}

function hasSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;

  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get('host');
    return Boolean(requestHost && originHost === requestHost);
  } catch {
    return false;
  }
}

export default async (request, context) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Metode request tidak didukung.' }, 405);
  }

  if (!hasSameOrigin(request)) {
    return jsonResponse({ error: 'Request OCR harus berasal dari aplikasi ini.' }, 403);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 128 * 1024) {
    return jsonResponse({ error: 'Paket gratis OCR.space membatasi ukuran file hingga 1 MB.' }, 413);
  }

  const ip = context?.ip ?? 'unknown';
  if (isRateLimited(ip)) {
    return jsonResponse({ error: 'Terlalu banyak permintaan. Coba lagi satu menit lagi.' }, 429);
  }

  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: 'OCR.space belum dikonfigurasi. Admin perlu mengatur OCR_SPACE_API_KEY di Netlify.' }, 503);
  }

  let input;
  try {
    input = await request.formData();
  } catch {
    return jsonResponse({ error: 'Format upload tidak valid.' }, 400);
  }

  const file = input.get('file');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return jsonResponse({ error: 'Pilih file PDF atau gambar terlebih dahulu.' }, 400);
  }
  if (file.size === 0) {
    return jsonResponse({ error: 'File yang dipilih kosong.' }, 400);
  }
  if (file.size > MAX_FILE_SIZE) {
    return jsonResponse({ error: 'Paket gratis OCR.space membatasi ukuran file hingga 1 MB.' }, 413);
  }
  if (!allowedFileName.test(file.name)) {
    return jsonResponse({ error: 'Format tidak didukung. Gunakan PDF, PNG, JPG, GIF, TIFF, atau BMP.' }, 415);
  }

  const ocrForm = new FormData();
  ocrForm.append('file', file, file.name);
  ocrForm.set('language', 'auto');
  ocrForm.set('OCREngine', '3');
  ocrForm.set('isTable', 'true');
  ocrForm.set('detectOrientation', 'true');
  ocrForm.set('scale', 'true');
  ocrForm.set('isOverlayRequired', 'false');

  let upstream;
  try {
    upstream = await fetch(OCR_SPACE_URL, {
      method: 'POST',
      headers: { apikey: apiKey },
      body: ocrForm,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return jsonResponse({ error: 'OCR.space terlalu lama merespons. Coba lagi dengan file yang lebih kecil.' }, 504);
    }
    return jsonResponse({ error: 'Tidak dapat menghubungi OCR.space. Periksa koneksi lalu coba lagi.' }, 502);
  }

  let result;
  try {
    result = await upstream.json();
  } catch {
    return jsonResponse({ error: 'OCR.space mengirim respons yang tidak valid.' }, 502);
  }

  const apiError = getErrorMessage(result.ErrorMessage) || getErrorMessage(result.ErrorDetails);
  if (!upstream.ok || result.IsErroredOnProcessing) {
    return jsonResponse({ error: apiError || `OCR.space gagal memproses file (HTTP ${upstream.status}).` }, 502);
  }

  const text = Array.isArray(result.ParsedResults)
    ? result.ParsedResults.map((page) => page.ParsedText?.trim() ?? '').filter(Boolean).join('\n\n')
    : '';
  if (!text) {
    const pageError = Array.isArray(result.ParsedResults)
      ? result.ParsedResults
        .map((page) => getErrorMessage(page.ErrorMessage) || getErrorMessage(page.ErrorDetails))
        .find(Boolean)
      : '';
    return jsonResponse({ error: pageError || 'Tidak ada teks yang berhasil dibaca dari file ini.' }, 422);
  }

  const processingTimeMs = Number(result.ProcessingTimeInMilliseconds);
  return jsonResponse({
    text,
    processingTimeMs: Number.isFinite(processingTimeMs) ? processingTimeMs : null,
  });
};
