import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePairwiseOverlap, analyzePortfolioOverlap } from '../../src/services/engine/mfOverlapEngine.js';
import { runDiagnostics } from '../../src/services/engine/diagnostics.js';

describe('MF Overlap & Diagnostics Unit Tests', () => {
  const fundA = {
    amfiCode: '10001',
    schemeName: 'Bluechip Large Cap Fund',
    holdings: [
      { isin: 'INE002A01018', instrumentName: 'Reliance Industries', sector: 'Energy', weightPct: '10.00' },
      { isin: 'INE040A01034', instrumentName: 'HDFC Bank', sector: 'Financials', weightPct: '8.50' },
      { isin: 'INE009A01021', instrumentName: 'Infosys', sector: 'Technology', weightPct: '7.00' },
      { isin: 'INE018A01030', instrumentName: 'Larsen & Toubro', sector: 'Industrials', weightPct: '5.00' }
    ]
  };

  const fundB = {
    amfiCode: '10002',
    schemeName: 'Flexi Cap Growth Fund',
    holdings: [
      { isin: 'INE002A01018', instrumentName: 'Reliance Industries', sector: 'Energy', weightPct: '6.00' },  // common: min(10, 6) = 6
      { isin: 'INE040A01034', instrumentName: 'HDFC Bank', sector: 'Financials', weightPct: '9.00' },          // common: min(8.5, 9) = 8.5
      { isin: 'INE009A01021', instrumentName: 'Infosys', sector: 'Technology', weightPct: '7.00' },            // common: min(7, 7) = 7.0
      { isin: 'INE154A01015', instrumentName: 'ITC Ltd', sector: 'Consumer', weightPct: '4.50' }              // not in A
    ]
  };

  test('Pairwise overlap calculates sum of min weights on common ISINs', () => {
    // Common: Reliance (6.00) + HDFC Bank (8.50) + Infosys (7.00) = 21.50%
    const overlap = calculatePairwiseOverlap(fundA, fundB);
    assert.equal(overlap.overlapPercentage, '21.50');
    assert.equal(overlap.status, 'HEALTHY');
    assert.equal(overlap.commonHoldingsCount, 3);
  });

  test('Portfolio overlap analyzes multiple funds and identifies highest overlap', () => {
    const report = analyzePortfolioOverlap([fundA, fundB]);
    assert.equal(report.pairwiseOverlaps.length, 1);
    assert.equal(report.highestOverlap.overlapPercentage, '21.50');
    assert.equal(report.averageOverlap, '21.50');
  });

  test('Diagnostics detect negative net worth when liabilities exceed assets', () => {
    const diag = runDiagnostics({
      assets: [{ current_value: '500000.00', asset_type: 'EQUITY' }],
      liabilities: [{ outstanding: '800000.00', emi: '15000.00' }],
      income: { gross_annual: '1000000.00' },
      profile: { monthly_expense: '40000.00' },
      assumptions: { emergency_fund_months: '6.00' }
    });

    const netWorthIssue = diag.find(d => d.code === 'NET_WORTH_NEGATIVE');
    assert.ok(netWorthIssue);
    assert.equal(netWorthIssue.severity, 'WARNING');
  });

  test('Diagnostics identify emergency fund shortfall', () => {
    // Monthly exp 50,000 * 6 months = 3,00,000 needed.
    // Liquid assets: 50,000 (1 month coverage -> REVIEW_RECOMMENDED)
    const diag = runDiagnostics({
      assets: [
        { current_value: '50000.00', asset_type: 'CASH' },
        { current_value: '1000000.00', asset_type: 'REAL_ESTATE' }
      ],
      income: { gross_annual: '1200000.00' },
      profile: { monthly_expense: '50000.00' },
      assumptions: { emergency_fund_months: '6.00' }
    });

    const efDiag = diag.find(d => d.code === 'EMERGENCY_RESERVE_BELOW_TARGET');
    assert.ok(efDiag);
    assert.equal(efDiag.severity, 'REVIEW_RECOMMENDED');
    assert.ok(efDiag.message.includes('1.0 months'));
  });

  test('Diagnostics flag inadequate term life cover relative to income multiple', () => {
    // Gross income: 10,00,000. Required: 15x = 1,50,00,000.
    // Term cover: 25,00,000.
    const diag = runDiagnostics({
      income: { gross_annual: '1000000.00' },
      insurance: [
        { policy_type: 'TERM', sum_assured: '2500000.00' },
        { policy_type: 'ULIP', sum_assured: '1000000.00' } // Should not count as pure term
      ],
      profile: { monthly_expense: '30000.00' },
      assumptions: { term_cover_income_multiple: '15.00' }
    });

    const insDiag = diag.find(d => d.code === 'TERM_INSURANCE_BELOW_TARGET');
    assert.ok(insDiag);
    assert.equal(insDiag.evidence.currentTermCover, '2500000.00');
  });
});
