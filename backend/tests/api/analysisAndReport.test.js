import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/app.js';
import { getDatabase, closeDatabase } from '../../src/db/sqlite.js';
import { runMigrations } from '../../../database/migrate.js';
import { runSeeds } from '../../../database/seed.js';

let server;
let baseUrl;
let userCookie;
let otherUserCookie;
let planRunId;

async function request(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}

  return { status: res.status, headers: res.headers, body: json, text, setCookie: res.headers.get('set-cookie') };
}

describe('Analysis and Report Endpoints', () => {
  before(async () => {
    const fs = await import('fs');
    const testDbPath = './data/financial_guidance_test_analysis.sqlite';
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
    baseUrl = `http://localhost:${server.address().port}`;

    // Create primary user
    const reg1 = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'planner@example.com', password: 'Password123!' }
    });
    userCookie = reg1.setCookie.split(';')[0];

    // Seed primary user financial records
    await request('/api/profile', {
      method: 'PUT',
      headers: { Cookie: userCookie },
      body: {
        fullName: 'Deepak Verma',
        dateOfBirth: '1988-08-20',
        dependents: 2,
        retirementAge: 60,
        riskProfile: 'AGGRESSIVE',
        cityTier: 'TIER_1',
        monthlyExpense: '75000.00'
      }
    });

    await request('/api/income', {
      method: 'PUT',
      headers: { Cookie: userCookie },
      body: {
        financialYear: '2026-27',
        grossAnnual: '2500000.00',
        otherIncome: '100000.00',
        eligibleDeductions: '150000.00',
        regimeOpted: 'NEW'
      }
    });

    await request('/api/assets', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        assetType: 'MF',
        label: 'Large & Midcap Equity',
        currentValue: '1500000.00',
        annualContribution: '120000.00'
      }
    });

    await request('/api/assets', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        assetType: 'CASH',
        label: 'Emergency Bank Account',
        currentValue: '250000.00'
      }
    });

    await request('/api/liabilities', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        loanType: 'CAR_LOAN',
        outstanding: '400000.00',
        emi: '15000.00',
        annualInterestRate: '0.085000',
        tenureMonthsLeft: 30
      }
    });

    await request('/api/goals', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        goalType: 'CHILD_EDUCATION',
        label: 'Daughter College Fund',
        targetAmountToday: '2500000.00',
        targetYear: 2038,
        priority: 1,
        inflationKey: 'inflation_education'
      }
    });

    // Create second user
    const reg2 = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'stranger@example.com', password: 'Password123!' }
    });
    otherUserCookie = reg2.setCookie.split(';')[0];
  });

  after(async () => {
    closeDatabase();
    await new Promise((resolve) => server.close(resolve));
  });

  test('POST /api/analysis/run orchestrates engine and writes immutable snapshot', async () => {
    const res = await request('/api/analysis/run', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: { financialYear: '2026-27' }
    });

    assert.equal(res.status, 201);
    assert.ok(res.body.data.planRun.id);
    assert.equal(res.body.data.planRun.engineVersion, '1.0.0');
    assert.equal(res.body.data.planRun.financialYear, '2026-27');

    planRunId = res.body.data.planRun.id;

    // Verify summary values
    assert.equal(res.body.data.summary.totalAssets, '1750000.00'); // 15L + 2.5L
    assert.equal(res.body.data.summary.totalLiabilities, '400000.00');
    assert.equal(res.body.data.summary.netWorth, '1350000.00'); // 17.5L - 4L

    // Verify goals projected
    assert.equal(res.body.data.goals.length, 1);
    assert.ok(parseFloat(res.body.data.goals[0].futureGoalValue) > 2500000);
    assert.ok(parseFloat(res.body.data.goals[0].indicativeMonthlySIP) > 0);

    // Verify diagnostics produced
    assert.ok(res.body.data.diagnostics.length > 0);
  });

  test('GET /api/analysis/history returns list of plan runs for user', async () => {
    const res = await request('/api/analysis/history', {
      headers: { Cookie: userCookie }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].id, planRunId);
  });

  test('GET /api/analysis/:planRunId returns immutable snapshot detail', async () => {
    const res = await request(`/api/analysis/${planRunId}`, {
      headers: { Cookie: userCookie }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.planRun.id, planRunId);
    assert.equal(res.body.data.summary.netWorth, '1350000.00');
  });

  test('TENANT ISOLATION: User 2 cannot access User 1 plan snapshot', async () => {
    const res = await request(`/api/analysis/${planRunId}`, {
      headers: { Cookie: otherUserCookie }
    });
    assert.equal(res.status, 404);
  });

  test('GET /api/report/:planRunId/pdf streams report document', async () => {
    const res = await request(`/api/report/${planRunId}/pdf`, {
      headers: { Cookie: userCookie }
    });
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('application/pdf') || contentType.includes('text/html'));
  });
});
