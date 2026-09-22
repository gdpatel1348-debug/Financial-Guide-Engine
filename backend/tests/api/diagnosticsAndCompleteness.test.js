import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { runDiagnostics } from '../../src/services/engine/diagnostics.js';
import { calculatePlan } from '../../src/services/engine/financialEngine.js';

describe('Diagnostics & Completeness Engine Tests', () => {

  const baseProfile = {
    fullName: 'Test User',
    dateOfBirth: '1990-01-01',
    dependents: 2,
    retirementAge: 60,
    riskProfile: 'MODERATE',
    monthlyExpense: '30000.00'
  };

  const baseIncome = {
    financialYear: '2026-27',
    grossAnnual: '1200000.00',
    otherIncome: '0.00',
    regimeOpted: 'NEW'
  };

  const defaultAssumptions = {
    emergency_fund_months: '6',
    term_cover_income_multiple: '15',
    return_equity: '0.120000'
  };

  test('1. Missing emergency assets produces INFORMATION_NEEDED', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [], // No liquid assets entered
      insurance: [],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    const emDiag = diags.find(d => d.code === 'EMERGENCY_RESERVE_MISSING');
    assert.ok(emDiag, 'Should find EMERGENCY_RESERVE_MISSING diagnostic');
    assert.equal(emDiag.severity, 'INFORMATION_NEEDED');
    assert.equal(emDiag.dataCompleteness, 'INCOMPLETE');
    assert.equal(emDiag.title, 'Emergency reserve details have not been entered');
  });

  test('2. Complete liquid-asset data below target produces REVIEW_RECOMMENDED', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [
        { asset_type: 'CASH', current_value: '50000.00' } // Covers ~1.6 months vs 6 target
      ],
      insurance: [],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    const emDiag = diags.find(d => d.code === 'EMERGENCY_RESERVE_BELOW_TARGET');
    assert.ok(emDiag, 'Should find EMERGENCY_RESERVE_BELOW_TARGET diagnostic');
    assert.equal(emDiag.severity, 'REVIEW_RECOMMENDED');
    assert.equal(emDiag.dataCompleteness, 'COMPLETE');
    assert.ok(emDiag.message.includes('1.7 months'));
  });

  test('3. Missing insurance produces INFORMATION_NEEDED', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [],
      insurance: [],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    const insDiag = diags.find(d => d.code === 'TERM_INSURANCE_MISSING');
    assert.ok(insDiag, 'Should find TERM_INSURANCE_MISSING diagnostic');
    assert.equal(insDiag.severity, 'INFORMATION_NEEDED');
    assert.equal(insDiag.dataCompleteness, 'INCOMPLETE');
    assert.equal(insDiag.title, 'No term-life insurance policy has been entered');
  });

  test('4. Entered low term cover produces REVIEW_RECOMMENDED', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [],
      insurance: [
        { policy_type: 'TERM', sum_assured: '5000000.00' } // 50L vs 1.8Cr target (15x of 12L)
      ],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    const insDiag = diags.find(d => d.code === 'TERM_INSURANCE_BELOW_TARGET');
    assert.ok(insDiag, 'Should find TERM_INSURANCE_BELOW_TARGET diagnostic');
    assert.equal(insDiag.severity, 'REVIEW_RECOMMENDED');
    assert.equal(insDiag.dataCompleteness, 'COMPLETE');
    assert.ok(insDiag.message.includes('configured reference range'));
  });

  test('5. Net worth appears in Financial Snapshot, not Diagnostics', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets: [{ asset_type: 'EQUITY', current_value: '200000.00' }],
      insurance: [],
      liabilities: [],
      goals: [],
      assumptions: defaultAssumptions
    });

    // Check financialSnapshot
    assert.ok(plan.financialSnapshot);
    assert.equal(plan.financialSnapshot.netWorth, '200000.00');
    assert.ok(plan.financialSnapshot.calculationExplanation.includes('Total assets'));

    // Check diagnostics list — MUST NOT contain "Net Worth Health" or NET_WORTH_SUMMARY
    const nwDiag = plan.diagnostics.find(d => d.code === 'NET_WORTH_SUMMARY' || d.title === 'Net Worth Health');
    assert.equal(nwDiag, undefined, 'Net Worth Health must not be listed as a diagnostic item');
  });

  test('6. Missing goals produces an empty state, not misleading zero totals', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets: [{ asset_type: 'EQUITY', current_value: '200000.00' }],
      insurance: [],
      liabilities: [],
      goals: [], // Empty goals
      assumptions: defaultAssumptions
    });

    assert.equal(plan.summary.hasGoals, false);
    assert.equal(plan.summary.totalFutureGoalValue, null);
    assert.equal(plan.summary.totalProjectedCorpus, null);
    assert.equal(plan.summary.totalShortfall, null);

    const goalDiag = plan.diagnostics.find(d => d.code === 'GOALS_MISSING');
    assert.ok(goalDiag);
    assert.equal(goalDiag.severity, 'INFORMATION_NEEDED');
  });

  test('7. Missing mutual-fund holdings produces INFORMATION_NEEDED', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [{ asset_type: 'CASH', current_value: '100000.00' }],
      insurance: [],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    const mfDiag = diags.find(d => d.code === 'MF_HOLDINGS_MISSING');
    assert.ok(mfDiag, 'Should find MF_HOLDINGS_MISSING diagnostic');
    assert.equal(mfDiag.severity, 'INFORMATION_NEEDED');
    assert.equal(mfDiag.title, 'Mutual-fund overlap analysis');
  });

  test('8. Diagnostic severity is returned by backend with structured fields', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [],
      insurance: [],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    for (const d of diags) {
      assert.ok(d.code, 'Diagnostic must have a code');
      assert.ok(d.severity, 'Diagnostic must have a severity');
      assert.ok(['INFO', 'INFORMATION_NEEDED', 'REVIEW_RECOMMENDED', 'ATTENTION', 'WARNING', 'CRITICAL'].includes(d.severity), `Invalid severity: ${d.severity}`);
      assert.ok(d.title, 'Diagnostic must have a title');
      assert.ok(d.message, 'Diagnostic must have a message');
      assert.ok(d.nextAction, 'Diagnostic must have a nextAction');
      assert.ok(d.dataCompleteness, 'Diagnostic must have dataCompleteness');
    }
  });

  test('9. Portfolio 100% equity produces REVIEW_RECOMMENDED', () => {
    const diags = runDiagnostics({
      profile: baseProfile,
      income: baseIncome,
      assets: [{ asset_type: 'EQUITY', current_value: '500000.00' }],
      insurance: [],
      liabilities: [],
      assumptions: defaultAssumptions
    });

    const eqDiag = diags.find(d => d.code === 'ASSET_ALLOCATION_100_EQUITY');
    assert.ok(eqDiag);
    assert.equal(eqDiag.severity, 'REVIEW_RECOMMENDED');
    assert.ok(eqDiag.message.includes('100% equity'));
  });

  test('10. No diagnostic is incorrectly labeled CRITICAL merely because a field is missing', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets: [], // All financial sections empty
      insurance: [],
      liabilities: [],
      goals: [],
      assumptions: defaultAssumptions
    });

    const criticalDiags = plan.diagnostics.filter(d => d.severity === 'CRITICAL');
    assert.equal(criticalDiags.length, 0, 'No diagnostic should be CRITICAL simply due to empty/missing input fields');
  });
});
