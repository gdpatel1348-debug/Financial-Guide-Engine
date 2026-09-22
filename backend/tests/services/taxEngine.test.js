import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTax, compareRegimes } from '../../src/services/engine/taxEngine.js';

const mockNewRegime = {
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
};

const mockOldRegime = {
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
};

describe('Tax Engine Unit Tests', () => {
  test('Zero income results in zero tax', () => {
    const result = calculateTax({
      grossIncome: '0.00',
      regime: 'NEW',
      ruleSet: mockNewRegime
    });
    assert.equal(result.taxableNormalIncome, '0.00');
    assert.equal(result.totalTax, '0.00');
  });

  test('Income within 87A rebate limit (<= 7,75,000 gross) pays 0 tax under New Regime', () => {
    // Gross 7,75,000 - 75,000 std ded = 7,00,000 taxable.
    // Tax on 7L: 0-3L = 0; 3L-7L @ 5% = 20,000. Rebate under 87A = 20,000. Net tax = 0.
    const result = calculateTax({
      grossIncome: '775000.00',
      regime: 'NEW',
      ruleSet: mockNewRegime
    });
    assert.equal(result.taxableNormalIncome, '700000.00');
    assert.equal(result.normalIncomeTax, '20000.00');
    assert.equal(result.rebate87A, '20000.00');
    assert.equal(result.totalTax, '0.00');
  });

  test('Income of 12,00,000 gross under New Regime calculates slabs and cess accurately', () => {
    // Gross: 12,00,000 - 75,000 = 11,25,000 taxable.
    // 0 - 3L: 0
    // 3L - 7L (4L @ 5%): 20,000
    // 7L - 10L (3L @ 10%): 30,000
    // 10L - 11.25L (1.25L @ 15%): 18,750
    // Subtotal tax: 68,750
    // Cess @ 4%: 2,750
    // Total: 71,500
    const result = calculateTax({
      grossIncome: '1200000.00',
      regime: 'NEW',
      ruleSet: mockNewRegime
    });
    assert.equal(result.taxableNormalIncome, '1125000.00');
    assert.equal(result.normalIncomeTax, '68750.00');
    assert.equal(result.cess, '2750.00');
    assert.equal(result.totalTax, '71500.00');
  });

  test('Old regime deductions reduce taxable income', () => {
    // Gross 12L, deductions 1.5L 80C, std ded 50k. Taxable: 10L.
    // 0-2.5L: 0
    // 2.5-5L (2.5L @ 5%): 12,500
    // 5-10L (5L @ 20%): 1,00,000
    // Total normal tax: 1,12,500
    // Cess @ 4%: 4,500
    // Total: 1,17,000
    const result = calculateTax({
      grossIncome: '1200000.00',
      eligibleDeductions: '150000.00',
      regime: 'OLD',
      ruleSet: mockOldRegime
    });
    assert.equal(result.taxableNormalIncome, '1000000.00');
    assert.equal(result.normalIncomeTax, '112500.00');
    assert.equal(result.cess, '4500.00');
    assert.equal(result.totalTax, '117000.00');
  });

  test('Regime comparison recommends the lower tax option', () => {
    const comparison = compareRegimes({
      grossIncome: '1200000.00',
      eligibleDeductions: '150000.00',
      oldRuleSet: mockOldRegime,
      newRuleSet: mockNewRegime
    });
    // New regime is 71,500 vs Old regime 1,17,000
    assert.equal(comparison.recommendedRegime, 'NEW');
    assert.equal(comparison.taxSavingsWithRecommended, '45500.00');
  });

  test('Negative inputs throw descriptive errors', () => {
    assert.throws(() => {
      calculateTax({
        grossIncome: '-50000.00',
        regime: 'NEW',
        ruleSet: mockNewRegime
      });
    }, /cannot be negative/);
  });
});
