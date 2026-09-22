import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../../src/app.js';
import { runMigrations } from '../../../database/migrate.js';
import { runSeeds } from '../../../database/seed.js';

let server;
let baseUrl;

async function requestJson(path, options = {}) {
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
  try { json = JSON.parse(text); } catch (e) {}

  const setCookie = res.headers.get('set-cookie');
  return { status: res.status, body: json, rawText: text, setCookie };
}

describe('Personal Financial Command Center & Scenario Simulation Tests', () => {
  before(async () => {
    runMigrations();
    runSeeds();
    await new Promise((res) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        res();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((res) => server.close(res));
  });

  let userCookie;
  const email = `command_center_${Date.now()}@example.com`;

  it('1. Register user and setup baseline profile & financial data', async () => {
    const regRes = await requestJson('/api/auth/register', {
      method: 'POST',
      body: {
        email,
        password: 'Password123!',
        name: 'Command Center User'
      }
    });
    assert.equal(regRes.status, 201);
    userCookie = regRes.setCookie;

    // Save profile
    await requestJson('/api/profile', {
      method: 'PUT',
      headers: { Cookie: userCookie },
      body: {
        fullName: 'Command Center User',
        dateOfBirth: '1990-05-15',
        cityTier: 'TIER_1',
        retirementAge: 60,
        dependents: 2
      }
    });

    // Save income
    await requestJson('/api/income', {
      method: 'PUT',
      headers: { Cookie: userCookie },
      body: {
        grossAnnual: 1800000,
        otherIncome: 100000,
        regimeOpted: 'NEW'
      }
    });

    // Save expenses
    await requestJson('/api/expenses', {
      method: 'PUT',
      headers: { Cookie: userCookie },
      body: {
        monthlyEssentialExpenses: 50000,
        monthlyLifestyleExpenses: 20000
      }
    });

    // Save assets
    const astRes = await requestJson('/api/assets', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        assetType: 'MF',
        label: 'Flexi Cap Fund',
        currentValue: 1200000,
        annualContribution: 180000
      }
    });
    const mfId = astRes.body.data.id;

    await requestJson('/api/assets', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        assetType: 'CASH',
        label: 'HDFC Savings Account',
        currentValue: 400000
      }
    });

    // Save goal linked to MF asset
    await requestJson('/api/goals', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        goalType: 'RETIREMENT',
        label: 'Retirement Corpus',
        targetAmountToday: 20000000,
        targetYear: 2050,
        priority: 1,
        linkedAssetIds: [mfId]
      }
    });

    // Run baseline analysis
    const runRes = await requestJson('/api/analysis/run', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: { financialYear: '2026-27' }
    });
    assert.equal(runRes.status, 201);
    assert.ok(runRes.body.data.planRun.id);
  });

  it('2. Scenario Simulation calculates live what-if projections without mutating database', async () => {
    // Count plan runs before scenario
    const historyBefore = await requestJson('/api/analysis/history', {
      headers: { Cookie: userCookie }
    });
    const runsCountBefore = historyBefore.body.data.length;

    // Run scenario with retirementAge: 55 and returnEquity: 14%
    const scRes = await requestJson('/api/analysis/scenario', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        overrides: {
          retirementAge: 55,
          returnEquity: 14,
          inflationGeneral: 7,
          monthlyExtraSavings: 25000
        }
      }
    });

    assert.equal(scRes.status, 200);
    assert.equal(scRes.body.data.isScenarioEstimate, true);
    assert.equal(scRes.body.data.appliedOverrides.retirementAge, 55);
    assert.ok(scRes.body.data.outputSnapshot.summary);
    assert.ok(scRes.body.data.outputSnapshot.goals);

    // Verify zero database writes — plan_runs count must be UNCHANGED
    const historyAfter = await requestJson('/api/analysis/history', {
      headers: { Cookie: userCookie }
    });
    assert.equal(historyAfter.body.data.length, runsCountBefore);

    // Verify profile retirementAge is UNCHANGED (still 60)
    const profRes = await requestJson('/api/profile', {
      headers: { Cookie: userCookie }
    });
    assert.equal(profRes.body.data.retirement_age, 60);
  });

  it('3. Scenario Simulation accurately modifies calculation outputs', async () => {
    const highReturn = await requestJson('/api/analysis/scenario', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        overrides: { returnEquity: 15 }
      }
    });

    const lowReturn = await requestJson('/api/analysis/scenario', {
      method: 'POST',
      headers: { Cookie: userCookie },
      body: {
        overrides: { returnEquity: 8 }
      }
    });

    const highCorpus = Number(highReturn.body.data.outputSnapshot.goals[0]?.futureAllocatedCorpus || 0);
    const lowCorpus = Number(lowReturn.body.data.outputSnapshot.goals[0]?.futureAllocatedCorpus || 0);

    assert.ok(highCorpus > lowCorpus, `Higher expected return should yield higher projected corpus (High: ${highCorpus}, Low: ${lowCorpus})`);
  });

  it('4. Tenant Isolation: User B cannot run scenario on User A data', async () => {
    const user2Res = await requestJson('/api/auth/register', {
      method: 'POST',
      body: {
        email: `user_b_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'User B'
      }
    });
    const user2Cookie = user2Res.setCookie;

    const user2Scenario = await requestJson('/api/analysis/scenario', {
      method: 'POST',
      headers: { Cookie: user2Cookie },
      body: {
        overrides: { retirementAge: 58 }
      }
    });

    assert.equal(user2Scenario.status, 200);
    assert.equal(Number(user2Scenario.body.data.outputSnapshot.summary.totalAssets), 0);
  });
});
