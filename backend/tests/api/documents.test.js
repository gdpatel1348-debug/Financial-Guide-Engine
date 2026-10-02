import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/app.js';
import { runMigrations } from '../../../database/migrate.js';
import { runSeeds } from '../../../database/seed.js';
import { Form16Extractor } from '../../src/services/form16Extractor.js';

let server;
let baseUrl;

describe('Form 16 Documents API Integration Tests', () => {
  let userCookie = null;

  before(async () => {
    runMigrations();
    runSeeds();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    // Register test user
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `doc_user_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Form16 Test User'
      })
    });
    assert.strictEqual(res.status, 201);
    userCookie = res.headers.get('set-cookie');
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('POST /api/documents/form16 rejects unauthenticated requests', async () => {
    const res = await fetch(`${baseUrl}/api/documents/form16`, {
      method: 'POST'
    });
    assert.strictEqual(res.status, 401);
  });

  test('POST /api/documents/form16 rejects request when no file uploaded', async () => {
    const formData = new FormData();
    const res = await fetch(`${baseUrl}/api/documents/form16`, {
      method: 'POST',
      headers: { cookie: userCookie },
      body: formData
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'FILE_MISSING');
  });

  test('POST /api/documents/form16 rejects invalid file types (e.g. .txt)', async () => {
    const formData = new FormData();
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    formData.append('file', blob, 'notes.txt');

    const res = await fetch(`${baseUrl}/api/documents/form16`, {
      method: 'POST',
      headers: { cookie: userCookie },
      body: formData
    });
    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.error.code, 'INVALID_FILE_TYPE');
  });

  test('POST /api/documents/form16 extracts data from Form 16 and returns structured response', async () => {
    // Stub Form16Extractor.extractRawText for reliable integration test
    const sampleText = `
      Certificate under section 203 of the Income-tax Act, 1961
      Assessment Year : 2027-28
      PAN of employee : ABCDE1234F
      Whether opting out of taxation u/s 115BAC? : No
      1. Gross Salary (d) Total: Rs. 18,00,000.00
      Total Deductions under Chapter VI-A
      (a) Section 80C : Rs. 1,50,000.00
      (b) Section 80D : Rs. 25,000.00
      Total tax deducted at source: Rs. 1,42,000.00
    `;

    const origRaw = Form16Extractor.extractRawText;
    Form16Extractor.extractRawText = async () => ({ text: sampleText, source: 'text' });

    try {
      const formData = new FormData();
      const fakePdf = new Blob(['%PDF-1.4 test'], { type: 'application/pdf' });
      formData.append('file', fakePdf, 'form16_traces.pdf');

      const res = await fetch(`${baseUrl}/api/documents/form16`, {
        method: 'POST',
        headers: { cookie: userCookie },
        body: formData
      });

      assert.strictEqual(res.status, 200);
      const json = await res.json();

      // Check extracted fields
      const ext = json.data.extracted;
      assert.strictEqual(ext.financial_year.value, '2026-27');
      assert.strictEqual(ext.financial_year.confidence, 'high');
      assert.strictEqual(ext.regime_opted.value, 'NEW');
      assert.strictEqual(ext.gross_annual_salary.value, 1800000);
      assert.strictEqual(ext.gross_annual_salary.confidence, 'high');
      assert.strictEqual(ext.section_80c_deductions.value, 150000);
      assert.strictEqual(ext.section_80d_deductions.value, 25000);
      assert.strictEqual(ext.tds_paid.value, 142000);
      assert.strictEqual(ext.tds_paid.confidence, 'high');

      // Check masked PAN
      assert.strictEqual(json.data.meta.panMasked, 'ABCDE****F');

      // Check top-level envelope compatibility
      assert.ok(json.extracted);
      assert.ok(Array.isArray(json.warnings));
    } finally {
      Form16Extractor.extractRawText = origRaw;
    }
  });

  test('POST /api/documents/form16 returns 422 if document contains no financial figures', async () => {
    const origRaw = Form16Extractor.extractRawText;
    Form16Extractor.extractRawText = async () => ({ text: 'Random unrelated PDF text with no tax data', source: 'text' });

    try {
      const formData = new FormData();
      const fakePdf = new Blob(['%PDF-1.4 blank'], { type: 'application/pdf' });
      formData.append('file', fakePdf, 'recipe.pdf');

      const res = await fetch(`${baseUrl}/api/documents/form16`, {
        method: 'POST',
        headers: { cookie: userCookie },
        body: formData
      });

      assert.strictEqual(res.status, 422);
      const json = await res.json();
      assert.strictEqual(json.error.code, 'EXTRACTION_EMPTY');
    } finally {
      Form16Extractor.extractRawText = origRaw;
    }
  });
});
