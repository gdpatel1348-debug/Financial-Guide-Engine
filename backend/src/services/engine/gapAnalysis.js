import Decimal from 'decimal.js';
import { calculateMonthlySIP } from './sipCalculator.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Performs gap and surplus analysis across all client goals.
 * 
 * @param {Array} goalProjections - Array of goal projection objects with linked corpus
 * @param {string|number} [sipReturnAssumption='0.120000'] - Default return rate for SIP recommendation
 * @returns {Object} Comprehensive gap analysis
 */
export function analyzeGoalGaps(goalProjections = [], sipReturnAssumption = '0.120000') {
  let totalFutureGoalValue = new Decimal(0);
  let totalProjectedCorpus = new Decimal(0);
  let totalShortfall = new Decimal(0);
  let totalSurplus = new Decimal(0);
  let totalRecommendedSIP = new Decimal(0);

  const goalResults = [];

  // Sort goals by priority (lower number = higher priority)
  const sorted = goalProjections.slice().sort((a, b) => (a.priority || 100) - (b.priority || 100));

  for (const item of sorted) {
    const dGoalFV = new Decimal(item.futureGoalValue || 0);
    const dAllocatedFV = new Decimal(item.futureAllocatedCorpus || 0);

    const isFullyFunded = dAllocatedFV.greaterThanOrEqualTo(dGoalFV);
    const shortfall = Decimal.max(0, dGoalFV.minus(dAllocatedFV));
    const surplus = Decimal.max(0, dAllocatedFV.minus(dGoalFV));

    const sipCalc = calculateMonthlySIP({
      targetGap: shortfall.toString(),
      years: item.yearsToGoal || 0,
      expectedAnnualReturn: sipReturnAssumption
    });

    totalFutureGoalValue = totalFutureGoalValue.plus(dGoalFV);
    totalProjectedCorpus = totalProjectedCorpus.plus(dAllocatedFV);
    totalShortfall = totalShortfall.plus(shortfall);
    totalSurplus = totalSurplus.plus(surplus);
    totalRecommendedSIP = totalRecommendedSIP.plus(new Decimal(sipCalc.monthlySIP));

    goalResults.push({
      goalId: item.goalId,
      goalType: item.goalType,
      label: item.label,
      priority: item.priority,
      targetYear: item.targetYear,
      yearsToGoal: item.yearsToGoal,
      amountToday: new Decimal(item.amountToday || 0).toFixed(2),
      futureGoalValue: dGoalFV.toFixed(2),
      futureAllocatedCorpus: dAllocatedFV.toFixed(2),
      shortfall: shortfall.toFixed(2),
      surplus: surplus.toFixed(2),
      fundingPercentage: dGoalFV.isZero() ? '100.00' : dAllocatedFV.dividedBy(dGoalFV).times(100).toFixed(2),
      isFullyFunded,
      indicativeMonthlySIP: sipCalc.monthlySIP,
      linkedAssets: item.linkedAssets || []
    });
  }

  return {
    goals: goalResults,
    totalFutureGoalValue: totalFutureGoalValue.toFixed(2),
    totalProjectedCorpus: totalProjectedCorpus.toFixed(2),
    totalShortfall: totalShortfall.toFixed(2),
    totalSurplus: totalSurplus.toFixed(2),
    totalRecommendedSIP: totalRecommendedSIP.toFixed(2),
    overallFundingPercentage: totalFutureGoalValue.isZero()
      ? '100.00'
      : totalProjectedCorpus.dividedBy(totalFutureGoalValue).times(100).toFixed(2)
  };
}
