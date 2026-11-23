import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import ocrHandler from '../netlify/functions/ocr.mjs';

const originalApiKey = process.env.OCR_SPACE_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.OCR_SPACE_API_KEY;
  else process.env.OCR_SPACE_API_KEY = originalApiKey;
  globalThis.fetch = originalFetch;
});

function createRequest(formData) {
  return new Request('https://app.example/.netlify/functions/ocr', {
    method: 'POST',
    headers: { origin: 'https://app.example', host: 'app.example' },
    body: formData,
  });
}

test('rejects requests from a different origin', async () => {
  const request = new Request('https://app.example/.netlify/functions/ocr', {
    method: 'POST',
    headers: { origin: 'https://untrusted.example', host: 'app.example' },
    body: new FormData(),
  });

  const response = await ocrHandler(request, { ip: 'origin-test' });
  assert.equal(response.status, 403);
});

test('requires a server-side OCR.space API key', async () => {
  delete process.env.OCR_SPACE_API_KEY;
  const response = await ocrHandler(createRequest(new FormData()), { ip: 'missing-key-test' });

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /OCR_SPACE_API_KEY/);
});

test('forwards image and OCR settings, then returns extracted text', async () => {
  process.env.OCR_SPACE_API_KEY = 'test-api-key';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.ocr.space/parse/image');
    assert.equal(options.headers.apikey, 'test-api-key');
    assert.equal(options.body.get('language'), 'auto');
    assert.equal(options.body.get('OCREngine'), '3');
    assert.equal(options.body.get('isTable'), 'true');
    assert.equal(options.body.get('detectOrientation'), 'true');
    assert.equal(options.body.get('scale'), 'true');
    assert.equal(options.body.get('isOverlayRequired'), 'false');
    assert.equal(options.body.get('file').name, 'receipt.png');

    return Response.json({
      ParsedResults: [{ ParsedText: 'Invoice total: 120.00' }],
      ProcessingTimeInMilliseconds: '850',
    });
  };

  const formData = new FormData();
  formData.append('file', new File([new Uint8Array([1, 2, 3])], 'receipt.png', { type: 'image/png' }));
  const response = await ocrHandler(createRequest(formData), { ip: 'success-test' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    text: 'Invoice total: 120.00',
    processingTimeMs: 850,
  });
});

test('rejects uploads larger than 1 MB', async () => {
  process.env.OCR_SPACE_API_KEY = 'test-api-key';
  const formData = new FormData();
  formData.append('file', new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', { type: 'image/png' }));

  const response = await ocrHandler(createRequest(formData), { ip: 'size-limit-test' });
  assert.equal(response.status, 413);
});

test('limits requests to ten per minute per IP', async () => {
  process.env.OCR_SPACE_API_KEY = 'test-api-key';
  const ip = 'rate-limit-test';
  for (let index = 0; index < 10; index += 1) {
    const response = await ocrHandler(createRequest(new FormData()), { ip });
    assert.equal(response.status, 400);
  }

  const limitedResponse = await ocrHandler(createRequest(new FormData()), { ip });
  assert.equal(limitedResponse.status, 429);
});
