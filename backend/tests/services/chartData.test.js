import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlan } from '../../src/services/engine/financialEngine.js';

describe('Chart Data Engine Unit Tests', () => {

  const baseProfile = {
    fullName: 'Rahul Sharma',
    dateOfBirth: '1992-05-15',
    dependents: 2,
    retirementAge: 60,
    riskProfile: 'MODERATE',
    monthlyExpense: '50000.00'
  };

  const baseIncome = {
    financialYear: '2026-27',
    grossAnnual: '1800000.00',
    otherIncome: '100000.00',
    eligibleDeductions: '150000.00',
    regimeOpted: 'NEW'
  };

  const taxRuleSets = {
    newRegime: {
      id: 'tax_new_2026',
      financialYear: '2026-27',
      regime: 'NEW',
      slabs: [
        { slabFrom: '0.00', slabTo: '400000.00', rate: '0.000000' },
        { slabFrom: '400000.00', slabTo: '800000.00', rate: '0.050000' },
        { slabFrom: '800000.00', slabTo: '1200000.00', rate: '0.100000' },
        { slabFrom: '1200001.00', slabTo: '1600000.00', rate: '0.150000' },
        { slabFrom: '1600001.00', slabTo: '2000000.00', rate: '0.200000' },
        { slabFrom: '2000001.00', slabTo: null, rate: '0.300000' }
      ],
      standardDeduction: '75000.00',
      rebateLimit: '700000.00',
      rebateAmount: '25000.00',
      cessRate: '0.040000'
    },
    oldRegime: {
      id: 'tax_old_2026',
      financialYear: '2026-27',
      regime: 'OLD',
      slabs: [
        { slabFrom: '0.00', slabTo: '250000.00', rate: '0.000000' },
        { slabFrom: '250001.00', slabTo: '500000.00', rate: '0.050000' },
        { slabFrom: '500001.00', slabTo: '1000000.00', rate: '0.200000' },
        { slabFrom: '1000001.00', slabTo: null, rate: '0.300000' }
      ],
      standardDeduction: '50000.00',
      rebateLimit: '500000.00',
      rebateAmount: '12500.00',
      cessRate: '0.040000'
    }
  };

  const defaultAssumptions = {
    emergency_fund_months: '6',
    term_cover_income_multiple: '15',
    return_equity: '0.120000',
    return_debt: '0.070000',
    return_gold: '0.080000',
    return_real_estate: '0.090000',
    return_cash: '0.040000',
    return_other: '0.060000',
    inflation_general: '0.060000'
  };

  test('1. Asset allocation percentages sum correctly to 100%', () => {
    const assets = [
      { id: 'a1', asset_type: 'EQUITY', current_value: '500000.00' },
      { id: 'a2', asset_type: 'DEBT', current_value: '300000.00' },
      { id: 'a3', asset_type: 'GOLD', current_value: '200000.00' }
    ];

    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets,
      taxRuleSets,
      assumptions: defaultAssumptions
    });

    const alloc = plan.charts.assetAllocation;
    assert.equal(alloc.hasData, true);
    assert.equal(alloc.totalAssets, '1000000.00');

    const totalPct = alloc.categories.reduce((sum, c) => sum + Number(c.pct), 0);
    assert.equal(totalPct.toFixed(1), '100.0');
  });

  test('2. Goal funded and shortfall values match analysis API', () => {
    const assets = [{ id: 'a1', asset_type: 'EQUITY', current_value: '500000.00' }];
    const goals = [
      { id: 'g1', label: 'Child Education', goal_type: 'EDUCATION', target_amount_today: '1000000.00', target_year: 2031, priority: 1, linked_asset_ids: ['a1'] }
    ];

    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets,
      goals,
      taxRuleSets,
      assumptions: defaultAssumptions,
      currentYear: 2026
    });

    const goalChart = plan.charts.goalFunding;
    assert.equal(goalChart.hasData, true);
    assert.equal(goalChart.goals.length, 1);

    const chartGoal = goalChart.goals[0];
    const engineGoal = plan.goals[0];

    assert.equal(chartGoal.futureGoalValue, engineGoal.futureGoalValue);
    assert.equal(chartGoal.shortfall, engineGoal.shortfall);
    assert.equal(chartGoal.monthlySip, engineGoal.indicativeMonthlySIP);
  });

  test('3. Corpus projection chart uses backend projection time series', () => {
    const assets = [{ id: 'a1', asset_type: 'EQUITY', current_value: '1000000.00', annual_contribution: '100000.00' }];

    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets,
      taxRuleSets,
      assumptions: defaultAssumptions,
      currentYear: 2026
    });

    const projChart = plan.charts.corpusProjection;
    assert.equal(projChart.hasData, true);
    assert.ok(projChart.series.length > 5);
    assert.equal(projChart.series[0].year, 2026);
    assert.equal(projChart.series[0].projectedCorpus, '1000000.00');
    assert.ok(Number(projChart.series[5].projectedCorpus) > 1000000);
  });

  test('4. Tax comparison displays old and new regime values correctly', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      taxRuleSets,
      assumptions: defaultAssumptions
    });

    const taxChart = plan.charts.taxComparison;
    assert.equal(taxChart.hasData, true);
    assert.ok(taxChart.oldRegimeTax);
    assert.ok(taxChart.newRegimeTax);
    assert.equal(taxChart.selectedRegime, 'NEW');
  });

  test('5. Missing goals render an empty state instead of zero totals', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      goals: [],
      taxRuleSets,
      assumptions: defaultAssumptions
    });

    const goalChart = plan.charts.goalFunding;
    assert.equal(goalChart.hasData, false);
    assert.equal(goalChart.emptyState.isMissing, true);
    assert.ok(goalChart.emptyState.title.includes('No goals have been entered yet'));
  });

  test('6. Missing insurance renders an information-needed state', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      insurance: [],
      taxRuleSets,
      assumptions: defaultAssumptions
    });

    const insChart = plan.charts.insuranceCoverage;
    assert.equal(insChart.hasData, false);
    assert.equal(insChart.emptyState.isMissing, true);
    assert.ok(insChart.emptyState.title.includes('No insurance details have been entered'));
  });

  test('7. Missing liquid assets render an information-needed state', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      assets: [{ id: 'a1', asset_type: 'REAL_ESTATE', current_value: '5000000.00' }], // No CASH or FD
      taxRuleSets,
      assumptions: defaultAssumptions
    });

    const efChart = plan.charts.emergencyReserve;
    assert.equal(efChart.hasData, false);
    assert.equal(efChart.emptyState.isMissing, true);
  });

  test('8. Empty mutual-fund holdings render an information-needed state', () => {
    const plan = calculatePlan({
      profile: baseProfile,
      income: baseIncome,
      mfFunds: [],
      taxRuleSets,
      assumptions: defaultAssumptions
    });

    const mfChart = plan.charts.mfOverlap;
    assert.equal(mfChart.hasData, false);
    assert.equal(mfChart.emptyState.isMissing, true);
    assert.ok(mfChart.emptyState.title.includes('No mutual-fund holdings have been entered'));
  });
});
