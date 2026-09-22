import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/app.js';
import { runMigrations } from '../../../database/migrate.js';
import { runSeeds } from '../../../database/seed.js';
import { AnalysisOrchestrator } from '../../src/services/analysisOrchestrator.js';

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

describe('User Data Model & Intake Upgrade Integration Tests', () => {
  let cookieUser1 = null;
  let cookieUser2 = null;
  let user1Id = null;
  let user2Id = null;

  before(async () => {
    runMigrations();
    runSeeds();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;

    // Register User 1
    const res1 = await requestJson('/api/auth/register', {
      method: 'POST',
      body: {
        email: `model_test_user1_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Priya Verma'
      }
    });
    assert.equal(res1.status, 201);
    cookieUser1 = res1.setCookie;
    user1Id = res1.body.data.user.id;

    // Register User 2
    const res2 = await requestJson('/api/auth/register', {
      method: 'POST',
      body: {
        email: `model_test_user2_${Date.now()}@example.com`,
        password: 'Password123!',
        name: 'Amit Patel'
      }
    });
    assert.equal(res2.status, 201);
    cookieUser2 = res2.setCookie;
    user2Id = res2.body.data.user.id;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Profile creation and update with complete occupation and personal identity', async () => {
    const profilePayload = {
      fullName: 'Priya Verma',
      displayName: 'Priya',
      dateOfBirth: '1991-08-20',
      gender: 'FEMALE',
      maritalStatus: 'MARRIED',
      phoneNumber: '+919876543210',
      city: 'Mumbai',
      state: 'Maharashtra',
      cityTier: 'TIER_1',
      occupationType: 'SALARIED',
      employerOrBusinessName: 'Tata Consultancy Services',
      jobTitleOrBusinessType: 'Senior Software Engineer',
      employmentStartYear: 2015,
      dependents: 2,
      retirementAge: 58,
      riskProfile: 'MODERATE',
      monthlyExpense: '60000.00',
      monthlyLifestyleExpenses: '25000.00'
    };

    const res = await requestJson('/api/profile', {
      method: 'PUT',
      headers: { Cookie: cookieUser1 },
      body: profilePayload
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.full_name, 'Priya Verma');
    assert.equal(res.body.data.occupation_type, 'SALARIED');
    assert.equal(res.body.data.city, 'Mumbai');
    assert.equal(res.body.data.employer_or_business_name, 'Tata Consultancy Services');
  });

  test('2. Income storage per financial year with detailed breakdown', async () => {
    const incomePayload = {
      financialYear: '2026-27',
      grossAnnual: '2400000.00',
      netAnnual: '1800000.00',
      monthlyGrossIncome: '200000.00',
      monthlyNetIncome: '150000.00',
      otherIncome: '50000.00',
      rentalIncome: '120000.00',
      businessIncome: '0.00',
      interestIncome: '30000.00',
      dividendIncome: '15000.00',
      capitalGains: '40000.00',
      eligibleDeductions: '200000.00',
      regimeOpted: 'NEW'
    };

    const res = await requestJson('/api/income', {
      method: 'PUT',
      headers: { Cookie: cookieUser1 },
      body: incomePayload
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.gross_annual, '2400000.00');
    assert.equal(res.body.data.rental_income, '120000.00');
    assert.equal(res.body.data.monthly_gross_income, '200000.00');
  });

  test('3. Tax inputs storage per financial year', async () => {
    const taxPayload = {
      financialYear: '2026-27',
      regimeOpted: 'NEW',
      standardDeduction: '75000.00',
      section80cDeductions: '150000.00',
      section80dDeductions: '25000.00',
      homeLoanInterestDeduction: '200000.00',
      otherEligibleDeductions: '50000.00',
      tdsPaid: '180000.00',
      advanceTaxPaid: '20000.00',
      capitalGainsTaxable: '40000.00'
    };

    const res = await requestJson('/api/tax-inputs', {
      method: 'PUT',
      headers: { Cookie: cookieUser1 },
      body: taxPayload
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.section_80c_deductions, '150000.00');
    assert.equal(res.body.data.tds_paid, '180000.00');
  });

  test('4. Expense breakdown storage per financial year', async () => {
    const expensePayload = {
      financialYear: '2026-27',
      monthlyEssentialExpenses: '45000.00',
      monthlyLifestyleExpenses: '20000.00',
      monthlyEducationExpenses: '15000.00',
      monthlyMedicalExpenses: '5000.00',
      monthlyDebtPayments: '35000.00',
      monthlyOtherExpenses: '5000.00'
    };

    const res = await requestJson('/api/expenses', {
      method: 'PUT',
      headers: { Cookie: cookieUser1 },
      body: expensePayload
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.monthly_essential_expenses, '45000.00');
    assert.equal(res.body.data.monthly_education_expenses, '15000.00');
  });

  test('5. Pure term insurance flag and policy name storage', async () => {
    const insPayload = {
      policyType: 'TERM',
      insurer: 'HDFC Life',
      policyName: 'Click 2 Protect Super',
      sumAssured: '20000000.00',
      annualPremium: '24000.00',
      maturityYear: 2055,
      policyStartYear: 2021,
      isPureTerm: true,
      isActive: true
    };

    const res = await requestJson('/api/insurance', {
      method: 'POST',
      headers: { Cookie: cookieUser1 },
      body: insPayload
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.policy_name, 'Click 2 Protect Super');
    assert.equal(res.body.data.is_pure_term, 1);
  });

  test('6. Liability storage with lender name and start year', async () => {
    const liabPayload = {
      loanType: 'HOME_LOAN',
      lenderName: 'State Bank of India',
      outstanding: '4500000.00',
      emi: '42000.00',
      annualInterestRate: '0.085000',
      tenureMonthsLeft: 180,
      startYear: 2020
    };

    const res = await requestJson('/api/liabilities', {
      method: 'POST',
      headers: { Cookie: cookieUser1 },
      body: liabPayload
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.lender_name, 'State Bank of India');
    assert.equal(res.body.data.start_year, 2020);
  });

  test('7. Tenant Isolation: User 2 cannot access or view User 1 tax_inputs or expenses', async () => {
    const resTax = await requestJson('/api/tax-inputs', {
      method: 'GET',
      headers: { Cookie: cookieUser2 }
    });
    assert.equal(resTax.status, 200);
    assert.equal(resTax.body.data, null, 'User 2 should not see User 1 tax inputs');

    const resExp = await requestJson('/api/expenses', {
      method: 'GET',
      headers: { Cookie: cookieUser2 }
    });
    assert.equal(resExp.status, 200);
    assert.equal(resExp.body.data, null, 'User 2 should not see User 1 expenses');
  });

  test('8. Analysis Orchestrator incorporates complete normalized user inputs', async () => {
    const planRun = AnalysisOrchestrator.runForUser(user1Id, { financialYear: '2026-27' });
    assert.ok(planRun);
    assert.equal(planRun.financialYear, '2026-27');

    const snapshotInput = planRun.inputSnapshot;
    assert.equal(snapshotInput.profile.occupationType, 'SALARIED');
    assert.equal(snapshotInput.profile.city, 'Mumbai');
    assert.equal(snapshotInput.income.rentalIncome, '120000.00');
    assert.equal(snapshotInput.taxInputs.section80cDeductions, '150000.00');
    assert.equal(snapshotInput.expenses.monthlyEducationExpenses, '15000.00');
    assert.equal(snapshotInput.insurance[0].isPureTerm, true);
    assert.equal(snapshotInput.liabilities[0].lenderName, 'State Bank of India');
  });
});
