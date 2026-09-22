import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Runs rule-based financial diagnostics on client data.
 * Returns structured, non-alarming observations without providing regulated investment advice.
 * 
 * Severity Levels:
 * - INFO: Neutral calculations or confirmations.
 * - INFORMATION_NEEDED: Missing input data required for a full assessment.
 * - REVIEW_RECOMMENDED: Observation suggesting a review against guidelines.
 * - ATTENTION: Complete entered data is below a reference benchmark.
 * - WARNING: Meaningful deviation supported by complete data.
 * - CRITICAL: Reserved strictly for severe confirmed conditions (e.g. heavy insolvency).
 * 
 * @param {Object} params
 * @returns {Array} List of diagnostic objects
 */
export function runDiagnostics({
  profile = {},
  income = {},
  assets = [],
  insurance = [],
  liabilities = [],
  goalAnalysis = {},
  overlapReport = {},
  assumptions = {}
}) {
  const diagnostics = [];

  const grossIncome = new Decimal(income.gross_annual || income.grossAnnual || 0);
  const monthlyExpense = new Decimal(profile.monthly_expense || profile.monthlyExpense || 0);
  const dependents = parseInt(profile.dependents || 0, 10);
  const riskProfile = profile.risk_profile || profile.riskProfile || 'MODERATE';

  // Assets Breakdown
  let totalAssets = new Decimal(0);
  let liquidAssets = new Decimal(0);
  let equityAssets = new Decimal(0);
  let debtAssets = new Decimal(0);

  let hasLiquidAssetRecord = false;
  let hasEquityAssetRecord = false;

  for (const a of assets) {
    const val = new Decimal(a.current_value || a.currentValue || 0);
    const type = (a.asset_type || a.assetType || 'OTHER').toUpperCase();
    totalAssets = totalAssets.plus(val);

    if (['CASH', 'FD'].includes(type)) {
      liquidAssets = liquidAssets.plus(val);
      hasLiquidAssetRecord = true;
    }
    if (['MF', 'EQUITY'].includes(type)) {
      equityAssets = equityAssets.plus(val);
      hasEquityAssetRecord = true;
    }
    if (['DEBT', 'EPF', 'FD'].includes(type)) {
      debtAssets = debtAssets.plus(val);
    }
  }

  // Liabilities Breakdown
  let totalLiabilities = new Decimal(0);
  let totalAnnualEmi = new Decimal(0);
  for (const l of liabilities) {
    const outstanding = new Decimal(l.outstanding || 0);
    const emi = new Decimal(l.emi || 0);
    totalLiabilities = totalLiabilities.plus(outstanding);
    totalAnnualEmi = totalAnnualEmi.plus(emi.times(12));
  }

  const netWorth = totalAssets.minus(totalLiabilities);

  // 1. Net Worth Observation (Only add diagnostic if severely negative with liabilities; Net Worth Health is in Financial Snapshot)
  if (netWorth.isNegative() && liabilities.length > 0) {
    diagnostics.push({
      code: 'NET_WORTH_NEGATIVE',
      severity: 'WARNING',
      title: 'Net worth observation',
      message: 'Total liabilities exceed the declared market value of entered assets.',
      evidence: {
        totalAssets: totalAssets.toFixed(2),
        totalLiabilities: totalLiabilities.toFixed(2),
        netWorth: netWorth.toFixed(2)
      },
      nextAction: 'REVIEW_DEBT_PAYOFF',
      dataCompleteness: 'COMPLETE'
    });
  }

  // 2. Emergency Reserve Diagnostic
  const recMonths = new Decimal(assumptions.emergency_fund_months || 6);

  if (!hasLiquidAssetRecord) {
    diagnostics.push({
      code: 'EMERGENCY_RESERVE_MISSING',
      severity: 'INFORMATION_NEEDED',
      title: 'Emergency reserve details have not been entered',
      message: 'Add your cash, FD, or other liquid assets to calculate emergency-fund coverage accurately.',
      evidence: {},
      nextAction: 'ADD_LIQUID_ASSETS',
      dataCompleteness: 'INCOMPLETE'
    });
  } else if (monthlyExpense.greaterThan(0)) {
    const coverageMonths = liquidAssets.dividedBy(monthlyExpense);
    const requiredEmergencyFund = monthlyExpense.times(recMonths);

    if (liquidAssets.lessThan(requiredEmergencyFund)) {
      diagnostics.push({
        code: 'EMERGENCY_RESERVE_BELOW_TARGET',
        severity: 'REVIEW_RECOMMENDED',
        title: 'Emergency reserve may be below the reference target',
        message: `Your entered liquid assets cover approximately ${coverageMonths.toFixed(1)} months of essential expenses. The configured reference target is ${recMonths.toFixed(0)} months.`,
        evidence: {
          currentLiquidAssets: liquidAssets.toFixed(2),
          monthlyExpenses: monthlyExpense.toFixed(2),
          targetMonths: recMonths.toFixed(0)
        },
        nextAction: 'REVIEW_EMERGENCY_RESERVE',
        dataCompleteness: 'COMPLETE'
      });
    } else {
      diagnostics.push({
        code: 'EMERGENCY_RESERVE_ADEQUATE',
        severity: 'INFO',
        title: 'Emergency fund is adequately funded',
        message: `Your entered liquid reserves cover ${coverageMonths.toFixed(1)} months of essential expenses, meeting the reference guideline of ${recMonths.toFixed(0)} months.`,
        evidence: {
          currentLiquidAssets: liquidAssets.toFixed(2),
          monthlyExpenses: monthlyExpense.toFixed(2),
          targetMonths: recMonths.toFixed(0)
        },
        nextAction: 'MAINTAIN_EMERGENCY_RESERVE',
        dataCompleteness: 'COMPLETE'
      });
    }
  }

  // 3. Term Insurance Diagnostic
  let termSumAssured = new Decimal(0);
  let otherInsuranceSumAssured = new Decimal(0);

  for (const p of insurance) {
    const type = (p.policy_type || p.policyType || 'OTHER').toUpperCase();
    const sum = new Decimal(p.sum_assured || p.sumAssured || 0);
    if (type === 'TERM') {
      termSumAssured = termSumAssured.plus(sum);
    } else {
      otherInsuranceSumAssured = otherInsuranceSumAssured.plus(sum);
    }
  }

  const termMultiple = new Decimal(assumptions.term_cover_income_multiple || 15);
  const recommendedCover = grossIncome.times(termMultiple);

  if (insurance.length === 0) {
    diagnostics.push({
      code: 'TERM_INSURANCE_MISSING',
      severity: 'INFORMATION_NEEDED',
      title: 'No term-life insurance policy has been entered',
      message: 'Add your insurance details to receive a more meaningful coverage assessment.',
      evidence: {},
      nextAction: 'ADD_INSURANCE',
      dataCompleteness: 'INCOMPLETE'
    });
  } else if (grossIncome.greaterThan(0)) {
    if (termSumAssured.lessThan(recommendedCover)) {
      const msg = dependents > 0
        ? `Your entered term-life cover may be below the configured reference range. This reference is based on income and configured assumptions. It is not a universal requirement. Actual insurance needs may also depend on dependents, liabilities, existing assets, future goals, and other household income.`
        : `Your entered term-life cover may be below the configured reference range. Since you have no dependents recorded, actual insurance needs depend on your personal financial situation, liabilities, and household context.`;

      diagnostics.push({
        code: 'TERM_INSURANCE_BELOW_TARGET',
        severity: 'REVIEW_RECOMMENDED',
        title: 'Term-life cover assessment',
        message: msg,
        evidence: {
          currentTermCover: termSumAssured.toFixed(2),
          grossAnnualIncome: grossIncome.toFixed(2),
          recommendedMultiple: termMultiple.toFixed(0)
        },
        nextAction: 'REVIEW_INSURANCE',
        dataCompleteness: 'COMPLETE'
      });
    } else {
      diagnostics.push({
        code: 'TERM_INSURANCE_ADEQUATE',
        severity: 'INFO',
        title: 'Life insurance cover meets reference guideline',
        message: 'Your entered term life insurance cover meets the recommended reference benchmark.',
        evidence: {
          currentTermCover: termSumAssured.toFixed(2),
          recommendedMinimumCover: recommendedCover.toFixed(2)
        },
        nextAction: 'REVIEW_INSURANCE_PERIODICALLY',
        dataCompleteness: 'COMPLETE'
      });
    }
  }

  // 4. Asset Allocation Diagnostic
  if (assets.length > 0 && totalAssets.greaterThan(0)) {
    const equityPct = equityAssets.dividedBy(totalAssets).times(100);

    if (equityPct.equals(100)) {
      diagnostics.push({
        code: 'ASSET_ALLOCATION_100_EQUITY',
        severity: 'REVIEW_RECOMMENDED',
        title: 'Portfolio asset allocation',
        message: 'Your entered portfolio is currently 100% equity. This result may change after you add all assets. Consider your risk profile, investment horizon, liquidity needs, and goal timelines before making changes.',
        evidence: {
          equityPercentage: '100.0%'
        },
        nextAction: 'REVIEW_ALLOCATION',
        dataCompleteness: 'COMPLETE'
      });
    } else {
      let targetEquityBand = { min: 50, max: 60 };
      if (riskProfile === 'CONSERVATIVE') targetEquityBand = { min: 20, max: 35 };
      if (riskProfile === 'AGGRESSIVE') targetEquityBand = { min: 70, max: 80 };

      if (equityPct.lessThan(targetEquityBand.min) || equityPct.greaterThan(targetEquityBand.max)) {
        diagnostics.push({
          code: 'ASSET_ALLOCATION_DEVIATION',
          severity: 'REVIEW_RECOMMENDED',
          title: 'Portfolio allocation observation',
          message: `Your current equity exposure (${equityPct.toFixed(1)}%) deviates from the reference band of ${targetEquityBand.min}% - ${targetEquityBand.max}% for a ${riskProfile} risk profile.`,
          evidence: {
            riskProfile,
            currentEquityPercentage: equityPct.toFixed(1) + '%',
            targetEquityBand: `${targetEquityBand.min}% - ${targetEquityBand.max}%`
          },
          nextAction: 'REVIEW_ALLOCATION',
          dataCompleteness: 'COMPLETE'
        });
      }
    }
  } else if (assets.length === 0) {
    diagnostics.push({
      code: 'ASSETS_MISSING',
      severity: 'INFORMATION_NEEDED',
      title: 'No assets entered',
      message: 'Add your existing savings, investments, or properties to see asset allocation insights.',
      evidence: {},
      nextAction: 'ADD_ASSETS',
      dataCompleteness: 'INCOMPLETE'
    });
  }

  // 5. Mutual Fund Overlap Diagnostic
  const hasMfAssets = assets.some(a => ['MF', 'EQUITY', 'DEBT'].includes((a.asset_type || a.assetType || '').toUpperCase()));
  if (overlapReport && overlapReport.highestOverlap) {
    const highest = overlapReport.highestOverlap;
    const overlapVal = parseFloat(highest.overlapPercentage);
    if (overlapVal >= 50) {
      diagnostics.push({
        code: 'MF_OVERLAP_HIGH',
        severity: 'REVIEW_RECOMMENDED',
        title: 'Mutual fund holdings overlap observation',
        message: `${highest.fundA.schemeName} and ${highest.fundB.schemeName} share a high degree of common portfolio holdings (${overlapVal.toFixed(1)}%), which may reduce diversification.`,
        evidence: {
          fundA: highest.fundA.schemeName,
          fundB: highest.fundB.schemeName,
          overlapPercentage: overlapVal.toFixed(1) + '%'
        },
        nextAction: 'REVIEW_MF_OVERLAP',
        dataCompleteness: 'COMPLETE'
      });
    }
  } else if (!hasMfAssets) {
    diagnostics.push({
      code: 'MF_HOLDINGS_MISSING',
      severity: 'INFORMATION_NEEDED',
      title: 'Mutual-fund overlap analysis',
      message: 'No mutual-fund holdings have been entered, so overlap analysis is not available yet.',
      evidence: {},
      nextAction: 'ADD_MF_HOLDINGS',
      dataCompleteness: 'INCOMPLETE'
    });
  }

  // 6. Goals Missing Diagnostic
  if (goalAnalysis && (!goalAnalysis.goals || goalAnalysis.goals.length === 0)) {
    diagnostics.push({
      code: 'GOALS_MISSING',
      severity: 'INFORMATION_NEEDED',
      title: 'Financial goals not entered',
      message: 'Add at least one financial goal to calculate future goal value, projected corpus, funding gap, and indicative SIP.',
      evidence: {},
      nextAction: 'ADD_GOAL',
      dataCompleteness: 'INCOMPLETE'
    });
  }

  return diagnostics;
}
