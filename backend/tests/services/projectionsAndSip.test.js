import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { projectGoalFutureValue } from '../../src/services/engine/goalProjection.js';
import { projectAssetFutureValue, projectLinkedCorpus } from '../../src/services/engine/corpusProjection.js';
import { calculateRetirementCorpus } from '../../src/services/engine/retirementProjection.js';
import { calculateMonthlySIP } from '../../src/services/engine/sipCalculator.js';
import { analyzeGoalGaps } from '../../src/services/engine/gapAnalysis.js';

describe('Projections, Retirement and SIP Unit Tests', () => {
  test('Goal projection compounds inflation over 10 years at 6%', () => {
    // 10,00,000 * (1.06)^10 = 17,90,847.70
    const result = projectGoalFutureValue({
      amountToday: '1000000.00',
      targetYear: 2036,
      currentYear: 2026,
      inflationRate: '0.060000'
    });
    assert.equal(result.yearsToGoal, 10);
    assert.equal(result.futureGoalValue, '1790847.70');
  });

  test('Goal projection returns multiplier 1.0 when years to goal is 0', () => {
    const result = projectGoalFutureValue({
      amountToday: '500000.00',
      targetYear: 2026,
      currentYear: 2026,
      inflationRate: '0.060000'
    });
    assert.equal(result.futureGoalValue, '500000.00');
    assert.equal(result.inflationMultiplier, '1.000000');
  });

  test('Target year in the past throws validation error', () => {
    assert.throws(() => {
      projectGoalFutureValue({
        amountToday: '500000.00',
        targetYear: 2020,
        currentYear: 2026,
        inflationRate: '0.060000'
      });
    }, /cannot be in the past/);
  });

  test('Asset future value compounds at 12% over 5 years', () => {
    // 1,00,000 * (1.12)^5 = 1,76,234.17
    const result = projectAssetFutureValue({
      currentValue: '100000.00',
      expectedAnnualReturn: '0.120000',
      years: 5
    });
    assert.equal(result.futureLumpSum, '176234.17');
    assert.equal(result.totalFutureValue, '176234.17');
  });

  test('Retirement corpus computes living expense decumulation stream', () => {
    // Current age 35, ret age 60, life exp 85. Monthly exp 50,000.
    const result = calculateRetirementCorpus({
      currentAge: 35,
      retirementAge: 60,
      lifeExpectancy: 85,
      monthlyExpenseToday: '50000.00',
      preRetirementInflation: '0.060000',
      postRetirementInflation: '0.060000',
      postRetirementReturn: '0.070000'
    });

    assert.equal(result.yearsToRetirement, 25);
    assert.equal(result.yearsInRetirement, 25);
    // Expense at retirement = 6,00,000 * (1.06)^25 = 25,75,123.63
    assert.equal(result.annualExpenseAtRetirement, '2575122.43');
    // Real rate > 0, corpus is positive and calculated
    assert.ok(parseFloat(result.corpusNeededAtRetirement) > 50000000);
  });

  test('SIP calculator computes annuity-due monthly requirement', () => {
    // Gap: 10,00,000 over 5 years (60 months) @ 12% p.a.
    // Monthly rate = 0.12 / 12 = 0.01 (1%)
    // PMT = 10,00,000 * 0.01 / [((1.01)^60 - 1) * 1.01] = 12,123.22
    const result = calculateMonthlySIP({
      targetGap: '1000000.00',
      years: 5,
      expectedAnnualReturn: '0.120000'
    });
    assert.equal(result.monthlySIP, '12123.22');
    assert.equal(result.months, 60);
  });

  test('SIP calculator handles zero gap or zero years gracefully', () => {
    const zeroGap = calculateMonthlySIP({
      targetGap: '0.00',
      years: 5,
      expectedAnnualReturn: '0.120000'
    });
    assert.equal(zeroGap.monthlySIP, '0.00');

    const zeroYears = calculateMonthlySIP({
      targetGap: '500000.00',
      years: 0,
      expectedAnnualReturn: '0.120000'
    });
    assert.equal(zeroYears.monthlySIP, '0.00');
  });

  test('Gap analysis accurately segregates shortfalls and surpluses', () => {
    const mockGoals = [
      {
        goalId: 'g1',
        goalType: 'EDUCATION',
        priority: 1,
        yearsToGoal: 5,
        futureGoalValue: '1000000.00',
        futureAllocatedCorpus: '400000.00'
      },
      {
        goalId: 'g2',
        goalType: 'CAR',
        priority: 2,
        yearsToGoal: 3,
        futureGoalValue: '500000.00',
        futureAllocatedCorpus: '600000.00'
      }
    ];

    const result = analyzeGoalGaps(mockGoals, '0.120000');
    assert.equal(result.totalFutureGoalValue, '1500000.00');
    assert.equal(result.totalProjectedCorpus, '1000000.00');
    assert.equal(result.totalShortfall, '600000.00'); // g1 has 6L shortfall
    assert.equal(result.totalSurplus, '100000.00');   // g2 has 1L surplus
    assert.ok(parseFloat(result.totalRecommendedSIP) > 0);
  });
});
