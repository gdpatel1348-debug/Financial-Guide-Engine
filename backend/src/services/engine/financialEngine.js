import Decimal from 'decimal.js';
import { calculateTax, compareRegimes } from './taxEngine.js';
import { projectGoalFutureValue } from './goalProjection.js';
import { projectLinkedCorpus } from './corpusProjection.js';
import { calculateRetirementCorpus } from './retirementProjection.js';
import { analyzeGoalGaps } from './gapAnalysis.js';
import { analyzePortfolioOverlap } from './mfOverlapEngine.js';
import { runDiagnostics } from './diagnostics.js';
import { buildChartData } from './chartDataEngine.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const ENGINE_VERSION = '1.0.0';

/**
 * Pure master calculation engine.
 * Accepts plain serializable inputs and returns a plain serializable output object.
 * Strictly ZERO I/O, ZERO database, ZERO network, ZERO Express.
 * 
 * @param {Object} input
 * @param {Object} input.profile
 * @param {Object} input.income
 * @param {Array} input.assets
 * @param {Array} input.insurance
 * @param {Array} input.liabilities
 * @param {Array} input.goals
 * @param {Array} [input.mfFunds=[]]
 * @param {Object} input.assumptions - Key-value map of assumption values
 * @param {Object} input.taxRuleSets - { newRegime: {...}, oldRegime: {...} }
 * @param {number} [input.currentYear=new Date().getFullYear()]
 * @returns {Object} Complete analysis output
 */
export function calculatePlan({
  profile = {},
  income = {},
  assets = [],
  insurance = [],
  liabilities = [],
  goals = [],
  mfFunds = [],
  assumptions = {},
  taxRuleSets = {},
  currentYear = new Date().getFullYear()
}) {
  const warnings = [];

  // 1. Tax Calculation & Comparison
  let taxComparison = null;
  let selectedRegimeTax = null;

  if (taxRuleSets.newRegime && taxRuleSets.oldRegime) {
    taxComparison = compareRegimes({
      grossIncome: income.gross_annual || income.grossAnnual || '0',
      otherIncome: income.other_income || income.otherIncome || '0',
      eligibleDeductions: income.eligible_deductions || income.eligibleDeductions || '0',
      oldRuleSet: taxRuleSets.oldRegime,
      newRuleSet: taxRuleSets.newRegime
    });

    const opted = (income.regime_opted || income.regimeOpted || 'NEW').toUpperCase();
    selectedRegimeTax = opted === 'OLD' ? taxComparison.oldRegime : taxComparison.newRegime;
  } else {
    warnings.push('Incomplete tax rulesets provided; tax calculations skipped or estimated.');
  }

  // 2. Net Worth & Balance Sheet
  let totalAssets = new Decimal(0);
  let totalLiabilities = new Decimal(0);
  let totalAnnualEmi = new Decimal(0);

  const assetAllocation = {
    equity: new Decimal(0),
    debt: new Decimal(0),
    gold: new Decimal(0),
    realEstate: new Decimal(0),
    cash: new Decimal(0),
    other: new Decimal(0)
  };

  const assetMap = new Map();

  for (const a of assets) {
    const val = new Decimal(a.current_value || a.currentValue || 0);
    totalAssets = totalAssets.plus(val);
    const type = (a.asset_type || a.assetType || 'OTHER').toUpperCase();

    if (['MF', 'EQUITY'].includes(type)) assetAllocation.equity = assetAllocation.equity.plus(val);
    else if (['DEBT', 'EPF', 'FD'].includes(type)) assetAllocation.debt = assetAllocation.debt.plus(val);
    else if (type === 'GOLD') assetAllocation.gold = assetAllocation.gold.plus(val);
    else if (type === 'REAL_ESTATE') assetAllocation.realEstate = assetAllocation.realEstate.plus(val);
    else if (type === 'CASH') assetAllocation.cash = assetAllocation.cash.plus(val);
    else assetAllocation.other = assetAllocation.other.plus(val);

    if (a.id) {
      assetMap.set(a.id, a);
    }
  }

  for (const l of liabilities) {
    totalLiabilities = totalLiabilities.plus(new Decimal(l.outstanding || 0));
    totalAnnualEmi = totalAnnualEmi.plus(new Decimal(l.emi || 0).times(12));
  }

  const netWorth = totalAssets.minus(totalLiabilities);

  // Asset allocation percentages
  const allocationPercentages = {};
  for (const [k, v] of Object.entries(assetAllocation)) {
    allocationPercentages[k] = totalAssets.isZero()
      ? '0.00'
      : v.dividedBy(totalAssets).times(100).toFixed(2);
  }

  // 3. Cash Flow Summary
  const grossAnnualIncome = new Decimal(income.gross_annual || income.grossAnnual || 0);
  const otherIncome = new Decimal(income.other_income || income.otherIncome || 0);
  const totalInflow = grossAnnualIncome.plus(otherIncome);
  const annualTax = selectedRegimeTax ? new Decimal(selectedRegimeTax.totalTax) : new Decimal(0);
  const monthlyExpense = new Decimal(profile.monthly_expense || profile.monthlyExpense || 0);
  const annualLivingExpense = monthlyExpense.times(12);

  const annualDiscretionarySavings = Decimal.max(0, totalInflow.minus(annualTax).minus(annualLivingExpense).minus(totalAnnualEmi));

  // 4. Goal Projections & Linked Corpus
  const goalProjections = [];

  for (const g of goals) {
    const goalType = (g.goal_type || g.goalType || 'OTHER').toUpperCase();
    const targetYear = parseInt(g.target_year || g.targetYear, 10);
    const amountToday = g.target_amount_today || g.targetAmountToday || '0';
    const inflationKey = g.inflation_key || g.inflationKey || 'inflation_general';
    const inflationRate = assumptions[inflationKey] || assumptions.inflation_general || '0.060000';

    let futureGoalValue = '0.00';
    let yearsToGoal = Math.max(0, targetYear - currentYear);

    // If goal is RETIREMENT and profile has retirement info, calculate corpus stream
    if (goalType === 'RETIREMENT' && profile.date_of_birth && profile.retirement_age) {
      const birthYear = new Date(profile.date_of_birth || profile.dateOfBirth).getFullYear();
      const currentAge = currentYear - birthYear;
      const retAge = parseInt(profile.retirement_age || profile.retirementAge || 60, 10);

      try {
        const retCalc = calculateRetirementCorpus({
          currentAge: Math.max(18, currentAge),
          retirementAge: retAge,
          lifeExpectancy: parseInt(assumptions.default_life_expectancy || 85, 10),
          monthlyExpenseToday: monthlyExpense.toString(),
          preRetirementInflation: inflationRate,
          postRetirementInflation: assumptions.inflation_general || '0.060000',
          postRetirementReturn: assumptions.post_retirement_return || '0.070000'
        });
        futureGoalValue = retCalc.corpusNeededAtRetirement;
        yearsToGoal = retCalc.yearsToRetirement;
      } catch (err) {
        warnings.push(`Retirement corpus calculation fallback: ${err.message}`);
        const proj = projectGoalFutureValue({
          amountToday,
          targetYear,
          currentYear,
          inflationRate,
          inflationKey
        });
        futureGoalValue = proj.futureGoalValue;
      }
    } else {
      const proj = projectGoalFutureValue({
        amountToday,
        targetYear,
        currentYear,
        inflationRate,
        inflationKey
      });
      futureGoalValue = proj.futureGoalValue;
      yearsToGoal = proj.yearsToGoal;
    }

    // Resolve linked assets
    const linkedIds = Array.isArray(g.linked_asset_ids || g.linkedAssetIds)
      ? (g.linked_asset_ids || g.linkedAssetIds)
      : [];

    const linkedAssets = linkedIds.map(id => assetMap.get(id)).filter(Boolean);

    const corpusResult = projectLinkedCorpus({
      assets: linkedAssets,
      returnsMap: assumptions,
      years: yearsToGoal
    });

    goalProjections.push({
      goalId: g.id,
      goalType,
      label: g.label || goalType,
      priority: parseInt(g.priority || 100, 10),
      targetYear,
      yearsToGoal,
      amountToday,
      futureGoalValue,
      futureAllocatedCorpus: corpusResult.totalProjectedValue,
      linkedAssets: corpusResult.assetBreakdown
    });
  }

  // 5. Gap & SIP Analysis
  const goalAnalysis = analyzeGoalGaps(goalProjections, assumptions.return_equity || '0.120000');

  // 6. Mutual Fund Overlap Analysis
  const overlapReport = analyzePortfolioOverlap(mfFunds);

  // 7. Data Completeness Summary & Recommended Actions
  const hasProfile = Boolean(profile.full_name || profile.fullName);
  const hasIncome = Boolean(income.gross_annual || income.grossAnnual);
  const hasAssets = assets.length > 0;
  const hasLiabilities = liabilities.length > 0;
  const hasInsurance = insurance.length > 0;
  const hasGoals = goals.length > 0;
  const hasMfHoldings = mfFunds.length > 0 || assets.some(a => ['MF', 'EQUITY', 'DEBT'].includes((a.asset_type || a.assetType || '').toUpperCase()));

  const dataCompletenessSummary = {
    profile: hasProfile ? 'COMPLETE' : 'INCOMPLETE',
    income: hasIncome ? 'COMPLETE' : 'INCOMPLETE',
    assets: hasAssets ? 'COMPLETE' : 'NOT_ENTERED',
    liabilities: hasLiabilities ? 'COMPLETE' : 'NOT_ENTERED',
    insurance: hasInsurance ? 'COMPLETE' : 'NOT_ENTERED',
    goals: hasGoals ? 'COMPLETE' : 'NOT_ENTERED',
    mfHoldings: hasMfHoldings ? 'COMPLETE' : 'NOT_ENTERED'
  };

  const financialSnapshot = {
    netWorth: netWorth.toFixed(2),
    totalAssets: totalAssets.toFixed(2),
    totalLiabilities: totalLiabilities.toFixed(2),
    calculationExplanation: `Total assets ₹${totalAssets.toLocaleString('en-IN')} minus total liabilities ₹${totalLiabilities.toLocaleString('en-IN')}.`
  };

  const recommendedNextActions = [];
  if (!hasGoals) {
    recommendedNextActions.push({ code: 'ADD_GOAL', title: 'Add a financial goal', action: 'Add at least one financial goal.' });
  }
  if (!assets.some(a => ['CASH', 'FD'].includes((a.asset_type || a.assetType || '').toUpperCase()))) {
    recommendedNextActions.push({ code: 'ADD_LIQUID_ASSETS', title: 'Add liquid assets', action: 'Add cash or FD assets if applicable.' });
  }
  if (!hasInsurance) {
    recommendedNextActions.push({ code: 'ADD_INSURANCE', title: 'Add insurance', action: 'Add insurance details if applicable.' });
  }
  if (!hasLiabilities) {
    recommendedNextActions.push({ code: 'ADD_LIABILITIES', title: 'Add liabilities', action: 'Add liabilities if applicable.' });
  }
  if (!hasMfHoldings) {
    recommendedNextActions.push({ code: 'ADD_MF_HOLDINGS', title: 'Add MF holdings', action: 'Add mutual-fund holdings for overlap analysis.' });
  }

  // 8. Rule-based Diagnostics
  const diagnostics = runDiagnostics({
    profile,
    income,
    assets,
    insurance,
    liabilities,
    goalAnalysis,
    overlapReport,
    assumptions
  });

  const resultWithoutCharts = {
    engineVersion: ENGINE_VERSION,
    calculatedAt: new Date().toISOString(),
    financialYear: income.financial_year || income.financialYear || '2026-27',
    dataCompletenessSummary,
    financialSnapshot,
    recommendedNextActions,
    summary: {
      netWorth: netWorth.toFixed(2),
      totalAssets: totalAssets.toFixed(2),
      totalLiabilities: totalLiabilities.toFixed(2),
      totalAnnualInflow: totalInflow.toFixed(2),
      annualLivingExpense: annualLivingExpense.toFixed(2),
      annualDebtService: totalAnnualEmi.toFixed(2),
      annualDiscretionarySavings: annualDiscretionarySavings.toFixed(2),
      selectedRegimeTax: selectedRegimeTax ? selectedRegimeTax.totalTax : '0.00',
      recommendedRegime: taxComparison ? taxComparison.recommendedRegime : 'NEW',
      taxSavingsWithRecommended: taxComparison ? taxComparison.taxSavingsWithRecommended : '0.00',
      totalFutureGoalValue: hasGoals ? goalAnalysis.totalFutureGoalValue : null,
      totalProjectedCorpus: hasGoals ? goalAnalysis.totalProjectedCorpus : null,
      totalShortfall: hasGoals ? goalAnalysis.totalShortfall : null,
      totalSurplus: hasGoals ? goalAnalysis.totalSurplus : null,
      totalRecommendedSIP: hasGoals ? goalAnalysis.totalRecommendedSIP : null,
      overallFundingPercentage: hasGoals ? goalAnalysis.overallFundingPercentage : null,
      hasGoals
    },
    assetAllocation: {
      amounts: {
        equity: assetAllocation.equity.toFixed(2),
        debt: assetAllocation.debt.toFixed(2),
        gold: assetAllocation.gold.toFixed(2),
        realEstate: assetAllocation.realEstate.toFixed(2),
        cash: assetAllocation.cash.toFixed(2),
        other: assetAllocation.other.toFixed(2)
      },
      percentages: allocationPercentages
    },
    taxComparison,
    goals: goalAnalysis.goals,
    diagnostics,
    mfOverlap: overlapReport,
    assumptionsUsed: assumptions,
    warnings
  };

  const inputForCharts = {
    profile,
    income,
    assets,
    insurance,
    liabilities,
    goals,
    mfFunds,
    assumptions,
    taxRuleSets,
    currentYear
  };

  const charts = buildChartData(inputForCharts, resultWithoutCharts);

  return {
    ...resultWithoutCharts,
    charts
  };
}
