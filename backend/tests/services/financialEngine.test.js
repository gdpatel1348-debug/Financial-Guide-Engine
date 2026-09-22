import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan } from '../../src/services/engine/financialEngine.js';

describe('Financial Engine Master Orchestrator Unit Tests', () => {
  const mockPlanInput = {
    profile: {
      fullName: 'Rahul Sharma',
      dateOfBirth: '1990-05-15',
      retirementAge: 60,
      dependents: 2,
      riskProfile: 'MODERATE',
      monthlyExpense: '60000.00'
    },
    income: {
      financialYear: '2026-27',
      grossAnnual: '1800000.00',
      otherIncome: '50000.00',
      eligibleDeductions: '150000.00',
      regimeOpted: 'NEW'
    },
    assets: [
      { id: 'a1', current_value: '1500000.00', asset_type: 'MF', label: 'Index Equity' },
      { id: 'a2', current_value: '500000.00', asset_type: 'FD', label: 'Fixed Deposit' },
      { id: 'a3', current_value: '200000.00', asset_type: 'CASH', label: 'Savings Account' }
    ],
    insurance: [
      { policy_type: 'TERM', sum_assured: '25000000.00', annual_premium: '20000.00' }
    ],
    liabilities: [
      { outstanding: '3000000.00', emi: '35000.00', loan_type: 'HOME_LOAN' }
    ],
    goals: [
      {
        id: 'g1',
        goal_type: 'EDUCATION',
        label: 'Higher Education',
        target_amount_today: '2000000.00',
        target_year: 2036,
        priority: 1,
        inflation_key: 'inflation_education',
        linked_asset_ids: ['a1']
      }
    ],
    assumptions: {
      inflation_general: '0.060000',
      inflation_education: '0.080000',
      return_equity: '0.120000',
      return_mf: '0.120000',
      return_fd: '0.065000',
      return_cash: '0.035000',
      emergency_fund_months: '6.00',
      term_cover_income_multiple: '15.00',
      debt_to_income_ratio_warning: '0.400000',
      default_life_expectancy: '85',
      post_retirement_return: '0.070000'
    },
    taxRuleSets: {
      newRegime: {
        standardDeduction: '75000.00',
        rebateLimit: '700000.00',
        rebateAmount: '25000.00',
        cessRate: '0.040000',
        slabs: [
          { slabFrom: '0.00', slabTo: '300000.00', rate: '0.000000' },
          { slabFrom: '300000.00', slabTo: '700000.00', rate: '0.050000' },
          { slabFrom: '700000.00', slabTo: '1000000.00', rate: '0.100000' },
          { slabFrom: '1000000.00', slabTo: '1200000.00', rate: '0.150000' },
          { slabFrom: '1200000.00', slabTo: '1500000.00', rate: '0.200000' },
          { slabFrom: '1500000.00', slabTo: null, rate: '0.300000' }
        ]
      },
      oldRegime: {
        standardDeduction: '50000.00',
        rebateLimit: '500000.00',
        rebateAmount: '12500.00',
        cessRate: '0.040000',
        slabs: [
          { slabFrom: '0.00', slabTo: '250000.00', rate: '0.000000' },
          { slabFrom: '250000.00', slabTo: '500000.00', rate: '0.050000' },
          { slabFrom: '500000.00', slabTo: '1000000.00', rate: '0.200000' },
          { slabFrom: '1000000.00', slabTo: null, rate: '0.300000' }
        ]
      }
    },
    currentYear: 2026
  };

  test('calculatePlan returns complete immutable plan structure without errors', () => {
    const plan = calculatePlan(mockPlanInput);

    assert.equal(plan.engineVersion, '1.0.0');
    assert.equal(plan.financialYear, '2026-27');

    // Total assets: 15L + 5L + 2L = 22L. Liabilities = 30L. Net worth = -8L
    assert.equal(plan.summary.totalAssets, '2200000.00');
    assert.equal(plan.summary.totalLiabilities, '3000000.00');
    assert.equal(plan.summary.netWorth, '-800000.00');

    // Goals evaluated
    assert.equal(plan.goals.length, 1);
    assert.equal(plan.goals[0].goalType, 'EDUCATION');
    assert.ok(parseFloat(plan.goals[0].futureGoalValue) > 2000000);

    // Diagnostics emitted
    assert.ok(plan.diagnostics.length > 0);
    assert.ok(plan.diagnostics.some(d => d.code === 'NET_WORTH_NEGATIVE'));

    // Assumptions tracked
    assert.equal(plan.assumptionsUsed.inflation_education, '0.080000');
  });
});
