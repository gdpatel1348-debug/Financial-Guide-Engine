import Decimal from 'decimal.js';
import { projectCorpusTimeSeries } from './corpusProjection.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Pure chart data engine.
 * Formats structured, presentation-ready DTOs for all 9 required charts based on pure engine outputs.
 * 
 * @param {Object} input - Master calculation input DTO
 * @param {Object} output - Master calculation engine output
 * @returns {Object} Structured chart DTOs
 */
export function buildChartData(input = {}, output = {}) {
  const currentYear = input.currentYear || new Date().getFullYear();
  const assumptions = input.assumptions || {};
  const assets = input.assets || [];
  const insurance = input.insurance || [];
  const liabilities = input.liabilities || [];
  const goals = input.goals || [];
  const mfFunds = input.mfFunds || [];

  const summary = output.summary || {};
  const assetAlloc = output.assetAllocation || { amounts: {}, percentages: {} };
  const taxComp = output.taxComparison || null;
  const goalList = output.goals || [];
  const mfReport = output.mfOverlap || {};

  // 1. Asset Allocation Chart DTO
  const totalAssetsNum = new Decimal(summary.totalAssets || 0);
  const hasAssets = assets.length > 0 && totalAssetsNum.greaterThan(0);
  const categories = [
    { key: 'EQUITY', name: 'Equity', amount: assetAlloc.amounts.equity || '0.00', pct: assetAlloc.percentages.equity || '0.00' },
    { key: 'DEBT', name: 'Debt', amount: assetAlloc.amounts.debt || '0.00', pct: assetAlloc.percentages.debt || '0.00' },
    { key: 'GOLD', name: 'Gold', amount: assetAlloc.amounts.gold || '0.00', pct: assetAlloc.percentages.gold || '0.00' },
    { key: 'REAL_ESTATE', name: 'Real Estate', amount: assetAlloc.amounts.realEstate || '0.00', pct: assetAlloc.percentages.realEstate || '0.00' },
    { key: 'CASH', name: 'Cash', amount: assetAlloc.amounts.cash || '0.00', pct: assetAlloc.percentages.cash || '0.00' },
    { key: 'OTHER', name: 'Other', amount: assetAlloc.amounts.other || '0.00', pct: assetAlloc.percentages.other || '0.00' }
  ];

  const assetAllocationChart = {
    hasData: hasAssets,
    totalAssets: summary.totalAssets || '0.00',
    categories,
    emptyState: {
      isMissing: !hasAssets,
      title: 'No assets have been entered yet.',
      message: 'Add your assets to view allocation.'
    }
  };

  // 2. Net Worth Composition Chart DTO
  const totalLiabNum = new Decimal(summary.totalLiabilities || 0);
  const netWorthNum = new Decimal(summary.netWorth || 0);

  const netWorthCompositionChart = {
    hasData: true,
    totalAssets: summary.totalAssets || '0.00',
    totalLiabilities: summary.totalLiabilities || '0.00',
    netWorth: summary.netWorth || '0.00',
    explanation: `Total assets (${summary.totalAssets}) minus total liabilities (${summary.totalLiabilities}) equals net worth (${summary.netWorth}).`
  };

  // 3. Income Distribution Chart DTO
  const grossIncomeNum = new Decimal(input.income?.gross_annual || input.income?.grossAnnual || 0);
  const otherIncomeNum = new Decimal(input.income?.other_income || input.income?.otherIncome || 0);
  const hasIncomeData = grossIncomeNum.greaterThan(0);

  const incomeDistributionChart = {
    hasData: hasIncomeData,
    currency: 'INR',
    financialYear: input.income?.financialYear || input.income?.financial_year || '2026-27',
    grossAnnual: grossIncomeNum.toFixed(2),
    otherIncome: otherIncomeNum.toFixed(2),
    estimatedTax: summary.selectedRegimeTax || '0.00',
    annualLivingExpense: summary.annualLivingExpense || '0.00',
    annualDebtService: summary.annualDebtService || '0.00',
    annualDiscretionarySavings: summary.annualDiscretionarySavings || '0.00',
    emptyState: {
      isMissing: !hasIncomeData,
      title: 'Complete your income and expense details to view this chart.',
      message: 'Add gross income and living expense details.'
    }
  };

  // 4. Goal Funding Chart DTO
  const sortedGoals = [...goalList].sort((a, b) => {
    if (a.priority !== b.priority) return (a.priority || 100) - (b.priority || 100);
    return (a.targetYear || 0) - (b.targetYear || 0);
  }).map(g => {
    const futureVal = new Decimal(g.futureGoalValue || 0);
    const corpusVal = new Decimal(g.futureAllocatedCorpus || g.projectedCorpus || 0);
    const gapVal = new Decimal(g.shortfall || 0);
    const surplusVal = new Decimal(g.surplus || 0);
    const fundedVal = Decimal.min(futureVal, corpusVal);

    return {
      goalId: g.goalId || g.id,
      label: g.label || g.goalType,
      goalType: g.goalType,
      priority: g.priority || 100,
      targetYear: g.targetYear,
      futureGoalValue: futureVal.toFixed(2),
      projectedCorpus: corpusVal.toFixed(2),
      fundedAmount: fundedVal.toFixed(2),
      shortfall: gapVal.toFixed(2),
      surplus: surplusVal.toFixed(2),
      monthlySip: g.indicativeMonthlySIP || g.monthlySip || '0.00',
      isFunded: gapVal.isZero()
    };
  });

  const goalFundingChart = {
    hasData: sortedGoals.length > 0,
    goals: sortedGoals,
    emptyState: {
      isMissing: sortedGoals.length === 0,
      title: 'No goals have been entered yet.',
      message: 'Add a goal to view future value, funding status, and indicative SIP.'
    }
  };

  // 5. Corpus Projection Series Chart DTO
  let maxTargetYear = currentYear + 15;
  if (goals.length > 0) {
    const maxGoalYear = Math.max(...goals.map(g => parseInt(g.target_year || g.targetYear || currentYear, 10)));
    if (maxGoalYear > currentYear) {
      maxTargetYear = Math.min(currentYear + 35, Math.max(currentYear + 10, maxGoalYear));
    }
  }

  const horizonYears = Math.max(5, maxTargetYear - currentYear);
  const timeSeries = projectCorpusTimeSeries({
    assets,
    returnsMap: assumptions,
    currentYear,
    horizonYears
  });

  const corpusProjectionChart = {
    hasData: assets.length > 0,
    currentYear,
    horizonYears,
    series: timeSeries,
    returnAssumption: assumptions.return_equity ? `${(Number(assumptions.return_equity) * 100).toFixed(1)}%` : '12.0%',
    inflationAssumption: assumptions.inflation_general ? `${(Number(assumptions.inflation_general) * 100).toFixed(1)}%` : '6.0%',
    explanation: 'Projected corpus compounding over time based on entered assets, contributions, and assumed rates of return. This is an estimate, not a guarantee.',
    emptyState: {
      isMissing: assets.length === 0,
      title: 'No assets entered for projection.',
      message: 'Add assets to see long-term corpus growth estimates.'
    }
  };

  // 6. Tax Comparison Chart DTO
  const hasTaxData = taxComp !== null && grossIncomeNum.greaterThan(0);
  const taxComparisonChart = {
    hasData: hasTaxData,
    financialYear: input.income?.financialYear || input.income?.financial_year || '2026-27',
    grossIncome: grossIncomeNum.toFixed(2),
    oldRegimeTax: taxComp?.oldRegime?.totalTax || '0.00',
    newRegimeTax: taxComp?.newRegime?.totalTax || '0.00',
    selectedRegime: (input.income?.regimeOpted || input.income?.regime_opted || 'NEW').toUpperCase(),
    recommendedRegime: taxComp?.recommendedRegime || 'NEW',
    taxSavingsWithRecommended: taxComp?.taxSavingsWithRecommended || '0.00',
    disclaimer: 'Estimated tax under selected assumptions. Do not present as official tax filing advice.',
    emptyState: {
      isMissing: !hasTaxData,
      title: 'Complete your income and deduction details to compare tax regimes.',
      message: 'Income details are needed to generate tax comparisons.'
    }
  };

  // 7. Emergency Reserve Chart DTO
  let liquidAssetsNum = new Decimal(0);
  let hasLiquid = false;
  for (const a of assets) {
    const type = (a.asset_type || a.assetType || '').toUpperCase();
    if (['CASH', 'FD'].includes(type)) {
      liquidAssetsNum = liquidAssetsNum.plus(new Decimal(a.current_value || a.currentValue || 0));
      hasLiquid = true;
    }
  }

  const monthlyExpNum = new Decimal(input.profile?.monthly_expense || input.profile?.monthlyExpense || 0);
  const targetMonthsNum = new Decimal(assumptions.emergency_fund_months || 6);
  const targetAmountNum = monthlyExpNum.times(targetMonthsNum);
  const coverageMonthsNum = monthlyExpNum.greaterThan(0) ? liquidAssetsNum.dividedBy(monthlyExpNum) : new Decimal(0);
  const efShortfallNum = Decimal.max(0, targetAmountNum.minus(liquidAssetsNum));

  const emergencyReserveChart = {
    hasData: hasLiquid && monthlyExpNum.greaterThan(0),
    currentLiquidAssets: liquidAssetsNum.toFixed(2),
    monthlyExpenses: monthlyExpNum.toFixed(2),
    targetMonths: targetMonthsNum.toFixed(0),
    targetAmount: targetAmountNum.toFixed(2),
    currentCoverageMonths: coverageMonthsNum.toFixed(1),
    shortfall: efShortfallNum.toFixed(2),
    isAdequate: liquidAssetsNum.greaterThanOrEqualTo(targetAmountNum),
    emptyState: {
      isMissing: !hasLiquid || monthlyExpNum.isZero(),
      title: 'Emergency reserve details incomplete.',
      message: 'Add cash/FD assets and monthly expenses to calculate emergency reserve coverage.'
    }
  };

  // 8. Insurance Coverage Chart DTO
  let pureTermCoverNum = new Decimal(0);
  const hasInsuranceRecord = insurance.length > 0;
  for (const p of insurance) {
    const type = (p.policy_type || p.policyType || '').toUpperCase();
    if (type === 'TERM') {
      pureTermCoverNum = pureTermCoverNum.plus(new Decimal(p.sum_assured || p.sumAssured || 0));
    }
  }

  const termMultipleNum = new Decimal(assumptions.term_cover_income_multiple || 15);
  const recommendedCoverNum = grossIncomeNum.times(termMultipleNum);

  const insuranceCoverageChart = {
    hasData: hasInsuranceRecord,
    currentTermCover: pureTermCoverNum.toFixed(2),
    recommendedMinimumCover: recommendedCoverNum.toFixed(2),
    grossAnnualIncome: grossIncomeNum.toFixed(2),
    dependents: parseInt(input.profile?.dependents || 0, 10),
    totalLiabilities: summary.totalLiabilities || '0.00',
    termMultiple: termMultipleNum.toFixed(0),
    emptyState: {
      isMissing: !hasInsuranceRecord,
      title: 'No insurance details have been entered.',
      message: 'Add insurance information to view coverage analysis.'
    }
  };

  // 9. Mutual Fund Overlap Chart DTO
  const hasMfData = mfFunds.length > 0 && mfReport?.pairwiseOverlaps?.length > 0;
  const mfOverlapChart = {
    hasData: hasMfData,
    fundCount: mfFunds.length,
    pairwiseOverlaps: mfReport.pairwiseOverlaps || [],
    highestOverlap: mfReport.highestOverlap || null,
    averageOverlap: mfReport.averageOverlap || '0.00',
    holdingsDate: new Date().toISOString().split('T')[0],
    emptyState: {
      isMissing: !hasMfData,
      title: 'No mutual-fund holdings have been entered, so overlap analysis is not available.',
      message: 'Add mutual fund holdings to perform portfolio overlap analysis.'
    }
  };

  return {
    assetAllocation: assetAllocationChart,
    netWorthComposition: netWorthCompositionChart,
    incomeDistribution: incomeDistributionChart,
    goalFunding: goalFundingChart,
    corpusProjection: corpusProjectionChart,
    taxComparison: taxComparisonChart,
    emergencyReserve: emergencyReserveChart,
    insuranceCoverage: insuranceCoverageChart,
    mfOverlap: mfOverlapChart
  };
}
