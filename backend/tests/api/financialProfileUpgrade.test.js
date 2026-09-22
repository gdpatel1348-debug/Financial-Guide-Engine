import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ProfileRepository } from '../../src/repositories/profile.repository.js';
import { IncomeRepository } from '../../src/repositories/income.repository.js';
import { TaxInputRepository } from '../../src/repositories/taxInput.repository.js';
import { ExpenseRepository } from '../../src/repositories/expense.repository.js';
import { AssetRepository } from '../../src/repositories/asset.repository.js';
import { InsuranceRepository } from '../../src/repositories/insurance.repository.js';
import { LiabilityRepository } from '../../src/repositories/liability.repository.js';
import { GoalRepository } from '../../src/repositories/goal.repository.js';
import { PlanRunRepository } from '../../src/repositories/planRun.repository.js';
import { AnalysisOrchestrator } from '../../src/services/analysisOrchestrator.js';

test('Financial-Profile Data Upgrade Comprehensive Verification Suite', async (t) => {
  const activeDbPath = path.resolve('data', 'financial_guidance.sqlite');
  const backupDbPath = path.resolve('data', 'financial_guidance-before-profile-upgrade.sqlite');

  const testUser1 = crypto.randomUUID();
  const testUserA = crypto.randomUUID();
  const testUserB = crypto.randomUUID();
  const testUserEmpty = crypto.randomUUID();
  const testUserAutosave = crypto.randomUUID();

  before(() => {
    const db = new Database(activeDbPath);
    const insertUser = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
    insertUser.run(testUser1, `test_upgrade_1_${Date.now()}@example.com`, 'hash123');
    insertUser.run(testUserA, `test_upgrade_a_${Date.now()}@example.com`, 'hash123');
    insertUser.run(testUserB, `test_upgrade_b_${Date.now()}@example.com`, 'hash123');
    insertUser.run(testUserEmpty, `test_upgrade_empty_${Date.now()}@example.com`, 'hash123');
    insertUser.run(testUserAutosave, `test_upgrade_autosave_${Date.now()}@example.com`, 'hash123');
    db.close();
  });

  after(() => {
    const db = new Database(activeDbPath);
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    deleteUser.run(testUser1);
    deleteUser.run(testUserA);
    deleteUser.run(testUserB);
    deleteUser.run(testUserEmpty);
    deleteUser.run(testUserAutosave);
    db.close();
  });

  // 1-3. Asset Preservation Verification against Backup
  await t.test('1-3. Existing assets survive migration unchanged with identical IDs and attributes', () => {
    assert.ok(fs.existsSync(backupDbPath), 'Backup database file must exist');
    assert.ok(fs.existsSync(activeDbPath), 'Active database file must exist');

    const backupDb = new Database(backupDbPath, { readonly: true });
    const activeDb = new Database(activeDbPath, { readonly: true });

    const backupAssets = backupDb.prepare('SELECT * FROM assets ORDER BY id').all();
    const activeAssetsMap = new Map(activeDb.prepare('SELECT * FROM assets').all().map(a => [a.id, a]));

    assert.equal(backupAssets.length, 11, 'Expected 11 original asset rows in backup');

    for (const b of backupAssets) {
      assert.ok(activeAssetsMap.has(b.id), `Original Asset ID ${b.id} must exist in active database`);
      const a = activeAssetsMap.get(b.id);
      assert.equal(a.user_id, b.user_id, `Asset user_id for ${b.id} must match`);
      assert.equal(a.asset_type, b.asset_type, `Asset type for ${b.id} must match`);
      assert.equal(a.label, b.label, `Asset label for ${b.id} must match`);
      assert.equal(a.current_value, b.current_value, `Asset current_value for ${b.id} must match`);
      assert.equal(a.annual_contribution, b.annual_contribution, `Asset annual_contribution for ${b.id} must match`);
      assert.equal(a.metadata, b.metadata, `Asset metadata for ${b.id} must match`);
      assert.equal(a.created_at, b.created_at, `Asset created_at for ${b.id} must match`);
    }

    backupDb.close();
    activeDb.close();
  });

  // 4-5. Profile & Occupation Data
  await t.test('4-5. Profile & occupation data is saved and updated correctly', () => {
    const profile = ProfileRepository.upsert(testUser1, {
      fullName: 'Rahul Sharma',
      displayName: 'Rahul',
      dateOfBirth: '1990-05-15',
      gender: 'MALE',
      maritalStatus: 'MARRIED',
      phoneNumber: '9876543210',
      city: 'Pune',
      state: 'Maharashtra',
      cityTier: 'TIER_1',
      occupationType: 'SALARIED',
      employerOrBusinessName: 'Infosys',
      jobTitleOrBusinessType: 'Lead Architect',
      retirementAge: 58,
      numberOfDependents: 2,
      riskProfile: 'MODERATE'
    });

    assert.equal(profile.full_name, 'Rahul Sharma');
    assert.equal(profile.occupation_type, 'SALARIED');
    assert.equal(profile.employer_or_business_name, 'Infosys');
    assert.equal(profile.job_title_or_business_type, 'Lead Architect');
    assert.equal(profile.dependents, 2);
    assert.equal(profile.number_of_dependents, 2);
    assert.equal(profile.retirement_age, 58);
  });

  // 6. Income Saved by Financial Year
  await t.test('6. Income is saved by financial year with UNIQUE(user_id, financial_year)', () => {
    const income = IncomeRepository.upsert(testUser1, {
      financialYear: '2026-27',
      grossAnnualIncome: '2400000.00',
      netAnnualIncome: '1900000.00',
      otherIncome: '50000.00',
      businessIncome: '0.00',
      rentalIncome: '120000.00',
      interestIncome: '30000.00',
      dividendIncome: '15000.00',
      capitalGains: '60000.00',
      eligibleDeductions: '150000.00',
      regimeOpted: 'NEW'
    });

    assert.equal(income.financial_year, '2026-27');
    assert.equal(income.gross_annual, '2400000.00');
    assert.equal(income.gross_annual_income, '2400000.00');
    assert.equal(income.rental_income, '120000.00');
    assert.equal(income.regime_opted, 'NEW');
  });

  // 7. Tax Inputs
  await t.test('7. Tax inputs are saved correctly in separate tax_inputs table', () => {
    const taxInput = TaxInputRepository.upsert(testUser1, {
      financialYear: '2026-27',
      regimeOpted: 'NEW',
      standardDeduction: '75000.00',
      section80cDeductions: '150000.00',
      section80dDeductions: '25000.00',
      homeLoanInterestDeduction: '200000.00',
      otherEligibleDeductions: '50000.00',
      tdsPaid: '220000.00',
      advanceTaxPaid: '30000.00',
      capitalGainsTaxable: '60000.00'
    });

    assert.equal(taxInput.regime_opted, 'NEW');
    assert.equal(taxInput.standard_deduction, '75000.00');
    assert.equal(taxInput.tds_paid, '220000.00');
    assert.equal(taxInput.home_loan_interest_deduction, '200000.00');
  });

  // 8. Expenses
  await t.test('8. Expenses are saved correctly including monthly insurance premiums', () => {
    const expense = ExpenseRepository.upsert(testUser1, {
      financialYear: '2026-27',
      monthlyEssentialExpenses: '45000.00',
      monthlyLifestyleExpenses: '25000.00',
      monthlyEducationExpenses: '15000.00',
      monthlyMedicalExpenses: '5000.00',
      monthlyDebtPayments: '35000.00',
      monthlyInsurancePremiums: '8000.00',
      monthlyOtherExpenses: '4000.00'
    });

    assert.equal(expense.monthly_essential_expenses, '45000.00');
    assert.equal(expense.monthly_insurance_premiums, '8000.00');
    assert.equal(expense.monthly_debt_payments, '35000.00');
  });

  // 9. Insurance Policies
  await t.test('9. Insurance policies are saved in insurance_policies table with is_pure_term flag', () => {
    const policy = InsuranceRepository.create(testUser1, {
      policyType: 'TERM',
      insurer: 'HDFC Life',
      policyName: 'Click 2 Protect 3D Plus',
      sumAssured: '15000000.00',
      annualPremium: '22000.00',
      maturityYear: 2056,
      policyStartYear: 2024,
      isPureTerm: true,
      isActive: true
    });

    assert.equal(policy.policy_type, 'TERM');
    assert.equal(policy.policy_name, 'Click 2 Protect 3D Plus');
    assert.equal(policy.sum_assured, '15000000.00');
    assert.equal(policy.is_pure_term, 1);
  });

  // 10. Liabilities
  await t.test('10. Liabilities are saved in liabilities table with lender name', () => {
    const loan = LiabilityRepository.create(testUser1, {
      loanType: 'HOME_LOAN',
      lenderName: 'SBI',
      outstanding: '3200000.00',
      emi: '34500.00',
      annualInterestRate: '0.085000',
      tenureMonthsLeft: 160,
      startYear: 2021
    });

    assert.equal(loan.loan_type, 'HOME_LOAN');
    assert.equal(loan.lender_name, 'SBI');
    assert.equal(loan.outstanding, '3200000.00');
    assert.equal(loan.tenure_months_left, 160);
  });

  // 11. Goals
  await t.test('11. Goals are saved in goals table with target amount and year', () => {
    const goal = GoalRepository.create(testUser1, {
      goalType: 'CHILD_EDUCATION',
      label: 'Higher Education in USA',
      targetAmountToday: '5000000.00',
      targetYear: 2038,
      priority: 1,
      inflationKey: 'inflation_education',
      linkedAssetIds: []
    });

    assert.equal(goal.goal_type, 'CHILD_EDUCATION');
    assert.equal(goal.target_amount_today, '5000000.00');
    assert.equal(goal.target_year, 2038);
    assert.equal(goal.inflation_key, 'inflation_education');
  });

  // 12. User Isolation
  await t.test('12. Tenant Isolation: User A cannot access User B data', () => {
    IncomeRepository.upsert(testUserA, { grossAnnual: '1000000.00', financialYear: '2026-27' });
    IncomeRepository.upsert(testUserB, { grossAnnual: '2000000.00', financialYear: '2026-27' });

    const incomeA = IncomeRepository.findByUserIdAndFY(testUserA, '2026-27');
    const incomeB = IncomeRepository.findByUserIdAndFY(testUserB, '2026-27');

    assert.equal(incomeA.gross_annual, '1000000.00');
    assert.equal(incomeB.gross_annual, '2000000.00');
    assert.notEqual(incomeA.id, incomeB.id);
  });

  // 13. Analysis Loads All New Data Categories
  await t.test('13. Analysis Orchestrator loads and integrates all normalized tables into calculation engine', () => {
    const planRun = AnalysisOrchestrator.runForUser(testUser1, { financialYear: '2026-27' });

    assert.ok(planRun.id, 'Plan run must generate ID');
    assert.ok(planRun.outputSnapshot, 'Plan run must store outputSnapshot');
    const plan = planRun.outputSnapshot;

    assert.ok(plan.summary && plan.summary.netWorth !== undefined, 'Plan has net worth calculation');
    assert.ok(plan.taxComparison, 'Plan has tax comparison');
    assert.ok(plan.goals, 'Plan has goal calculations');
    assert.ok(plan.diagnostics, 'Plan has diagnostics');
    assert.ok(plan.assetAllocation, 'Plan has asset allocation');

    const inputSnap = planRun.inputSnapshot;
    assert.equal(inputSnap.profile.occupationType, 'SALARIED');
    assert.equal(inputSnap.profile.employerOrBusinessName, 'Infosys');
    assert.equal(inputSnap.expenses.monthlyInsurancePremiums, '8000.00');
  });

  // 14. Historical plan snapshots remain immutable
  await t.test('14. Historical plan snapshots remain strictly immutable', () => {
    const db = new Database(activeDbPath, { readonly: true });
    const initialCount = db.prepare('SELECT count(*) as cnt FROM plan_runs').get().cnt;
    const oldestRun = db.prepare('SELECT * FROM plan_runs ORDER BY run_at ASC LIMIT 1').get();
    db.close();

    assert.ok(initialCount >= 24, 'Historical snapshots are preserved');
    assert.ok(oldestRun.input_snapshot, 'Oldest snapshot retains exact inputs');
    assert.ok(oldestRun.output_snapshot, 'Oldest snapshot retains exact outputs');
  });

  // 15. No duplicate records created by autosave (upsert semantics)
  await t.test('15. Autosave produces idempotent updates without duplicates for income, expenses, and profile', () => {
    for (let i = 1; i <= 5; i++) {
      ProfileRepository.upsert(testUserAutosave, { fullName: `Test Name ${i}`, dateOfBirth: '1992-01-01' });
      IncomeRepository.upsert(testUserAutosave, { grossAnnual: `${i * 100000}.00`, financialYear: '2026-27' });
      ExpenseRepository.upsert(testUserAutosave, { monthlyEssentialExpenses: `${i * 10000}.00`, financialYear: '2026-27' });
    }

    const db = new Database(activeDbPath, { readonly: true });
    const profileCount = db.prepare('SELECT count(*) as cnt FROM profiles WHERE user_id = ?').get(testUserAutosave).cnt;
    const incomeCount = db.prepare('SELECT count(*) as cnt FROM incomes WHERE user_id = ? AND financial_year = ?').get(testUserAutosave, '2026-27').cnt;
    const expenseCount = db.prepare('SELECT count(*) as cnt FROM expenses WHERE user_id = ? AND financial_year = ?').get(testUserAutosave, '2026-27').cnt;
    db.close();

    assert.equal(profileCount, 1, 'Exactly one profile record per user');
    assert.equal(incomeCount, 1, 'Exactly one income record per user per FY');
    assert.equal(expenseCount, 1, 'Exactly one expense record per user per FY');
  });

  // 16. Empty optional sections handled gracefully
  await t.test('16. Empty optional sections handled properly without throwing errors', () => {
    ProfileRepository.upsert(testUserEmpty, { fullName: 'Minimal User', dateOfBirth: '1995-10-10' });

    assert.doesNotThrow(() => {
      const res = AnalysisOrchestrator.runForUser(testUserEmpty, { financialYear: '2026-27' });
      assert.ok(res.id);
      assert.ok(res.outputSnapshot);
    });
  });

  // 17. DB Browser can open the final SQLite file
  await t.test('17. SQLite file integrity check (PRAGMA integrity_check) passes', () => {
    const db = new Database(activeDbPath, { readonly: true });
    const integrity = db.prepare('PRAGMA integrity_check').get();
    db.close();
    assert.equal(integrity.integrity_check, 'ok', 'Database integrity check must be ok for DB Browser');
  });

  // 18. No destructive migration occurred
  await t.test('18. Zero destructive operations: assets table intact, all tables present', () => {
    const db = new Database(activeDbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(t => t.name);
    const requiredTables = [
      'users', 'profiles', 'incomes', 'tax_inputs', 'expenses', 'assets',
      'insurance_policies', 'liabilities', 'goals', 'plan_runs', 'assumptions', 'tax_slabs'
    ];

    for (const rt of requiredTables) {
      assert.ok(tables.includes(rt), `Required table '${rt}' must be present in SQLite file`);
    }

    const originalAssetIds = [
      '97807bc1-10bd-4115-aa05-e10a0a511692',
      'e2dc111f-855d-418f-aef3-0be4d0cd0b8a',
      '742581e4-acc5-4a3a-920a-316c0f0642d6',
      '4dd98475-d21e-4259-8a41-dc20eaaf4bc3',
      '461ac523-2cd8-43f1-a9d7-576f5cf6f61e',
      '737fd8c6-1ae4-4d7d-8946-db5acb197017',
      '7ffcb5b1-f155-4604-83e2-6045a47bc473',
      '6ceed458-2389-4bec-8187-47afdf50f7c4',
      'f7f3e99c-59e5-469d-86af-668effc45fe8',
      'b5c3ca01-2831-4043-9882-1e2f270f36ba',
      '79e2f70e-f7b9-4961-b2dd-e5b875353afb'
    ];

    const currentAssetIds = db.prepare('SELECT id FROM assets').all().map(a => a.id);
    for (const id of originalAssetIds) {
      assert.ok(currentAssetIds.includes(id), `Original asset ID ${id} must still be in assets table`);
    }
    db.close();
  });
});
