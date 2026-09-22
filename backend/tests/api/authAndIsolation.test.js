import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/app.js';
import { getDatabase, closeDatabase } from '../../src/db/sqlite.js';
import { runMigrations } from '../../../database/migrate.js';
import { runSeeds } from '../../../database/seed.js';

let server;
let baseUrl;

// Helper for making JSON HTTP requests and tracking cookies
async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: 'manual'
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {}

  // Extract set-cookie
  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, headers: res.headers, body: json, text, setCookie };
}

describe('Auth and Isolation Endpoints', () => {
  before(async () => {
    const fs = await import('fs');
    const testDbPath = './data/financial_guidance_test_auth.sqlite';
    for (const ext of ['', '-wal', '-shm']) {
      if (fs.existsSync(testDbPath + ext)) {
        try { fs.unlinkSync(testDbPath + ext); } catch (e) {}
      }
    }
    process.env.SQLITE_DATABASE_PATH = testDbPath;
    const db = getDatabase(testDbPath);
    runMigrations(db);
    runSeeds(db);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
  });

  after(async () => {
    closeDatabase();
    await new Promise((resolve) => server.close(resolve));
  });

  let user1Cookie;
  let user2Cookie;
  let user1AssetId;

  test('Health check returns 200 and version', async () => {
    const res = await request('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'healthy');
  });

  test('Register User 1 returns 201 and sets auth cookie', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'user1@example.com', password: 'Password123!' }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.user.email, 'user1@example.com');
    assert.ok(res.setCookie);
    user1Cookie = res.setCookie.split(';')[0];
  });

  test('Duplicate registration returns 409 Conflict', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'USER1@example.com', password: 'Password123!' }
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  test('User 1 can fetch current user info (/api/auth/me)', async () => {
    const res = await request('/api/auth/me', {
      headers: { Cookie: user1Cookie }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.email, 'user1@example.com');
  });

  test('User 1 creates profile and asset', async () => {
    // 1. Profile
    const profRes = await request('/api/profile', {
      method: 'PUT',
      headers: { Cookie: user1Cookie },
      body: {
        fullName: 'User One',
        dateOfBirth: '1992-04-10',
        dependents: 1,
        retirementAge: 60,
        riskProfile: 'MODERATE',
        cityTier: 'TIER_1',
        monthlyExpense: '45000.00'
      }
    });
    assert.equal(profRes.status, 200);
    assert.equal(profRes.body.data.full_name, 'User One');

    // 2. Asset
    const assetRes = await request('/api/assets', {
      method: 'POST',
      headers: { Cookie: user1Cookie },
      body: {
        assetType: 'MF',
        label: 'User 1 Nifty 50 Fund',
        currentValue: '500000.00',
        annualContribution: '60000.00'
      }
    });
    assert.equal(assetRes.status, 201);
    user1AssetId = assetRes.body.data.id;
    assert.ok(user1AssetId);
  });

  test('Register User 2', async () => {
    const res = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'user2@example.com', password: 'Password123!' }
    });
    assert.equal(res.status, 201);
    user2Cookie = res.setCookie.split(';')[0];
  });

  test('TENANT ISOLATION: User 2 cannot list User 1 assets', async () => {
    const res = await request('/api/assets', {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 200);
    // User 2 has no assets yet
    assert.equal(res.body.data.length, 0);
  });

  test('TENANT ISOLATION: User 2 cannot modify or delete User 1 asset (returns 404)', async () => {
    const updateRes = await request(`/api/assets/${user1AssetId}`, {
      method: 'PUT',
      headers: { Cookie: user2Cookie },
      body: {
        assetType: 'CASH',
        label: 'Hacked Asset',
        currentValue: '9999999.00'
      }
    });
    assert.equal(updateRes.status, 404);

    const deleteRes = await request(`/api/assets/${user1AssetId}`, {
      method: 'DELETE',
      headers: { Cookie: user2Cookie }
    });
    assert.equal(deleteRes.status, 404);

    // Verify User 1 still has the original asset
    const verifyRes = await request('/api/assets', {
      headers: { Cookie: user1Cookie }
    });
    assert.equal(verifyRes.body.data.length, 1);
    assert.equal(verifyRes.body.data[0].label, 'User 1 Nifty 50 Fund');
  });

  test('User 1 logout revokes token', async () => {
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: user1Cookie }
    });
    assert.equal(logoutRes.status, 200);

    // Subsequent call with same cookie should be rejected
    const meRes = await request('/api/auth/me', {
      headers: { Cookie: user1Cookie }
    });
    assert.equal(meRes.status, 401);
    assert.equal(meRes.body.error.code, 'TOKEN_REVOKED');
  });

  // ── POST-LOGOUT: User 2 cannot see User 1 data ────────────────────────

  test('DATA ISOLATION: User 2 profile is empty (not User 1 data)', async () => {
    const res = await request('/api/profile', {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 200);
    // User 2 has no profile — must return null, not User 1's profile
    assert.equal(res.body.data, null);
  });

  test('DATA ISOLATION: User 2 income is empty', async () => {
    const res = await request('/api/income', {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
  });

  test('DATA ISOLATION: User 2 assets list is empty', async () => {
    const res = await request('/api/assets', {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  test('DATA ISOLATION: User 2 goals list is empty', async () => {
    const res = await request('/api/goals', {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  test('DATA ISOLATION: User 2 analysis history is empty', async () => {
    const res = await request('/api/analysis/history', {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  test('CROSS-USER ATTACK: User 2 cannot fetch User 1 asset by ID → 404', async () => {
    const res = await request(`/api/assets/${user1AssetId}`, {
      headers: { Cookie: user2Cookie }
    });
    assert.equal(res.status, 404);
  });

  test('CROSS-USER ATTACK: Revoked User 1 cookie cannot access any protected route', async () => {
    const profRes = await request('/api/profile', {
      headers: { Cookie: user1Cookie }
    });
    assert.equal(profRes.status, 401);

    const assetsRes = await request('/api/assets', {
      headers: { Cookie: user1Cookie }
    });
    assert.equal(assetsRes.status, 401);
  });
});
