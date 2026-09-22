import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Pure goal projection with inflation compounding.
 * 
 * @param {Object} params
 * @param {string|number} params.amountToday - Target cost in today's money (INR)
 * @param {number} params.targetYear - Target future year
 * @param {number} params.currentYear - Current base year
 * @param {string|number} params.inflationRate - Annual inflation rate as decimal fraction (e.g. '0.06' for 6%)
 * @param {string} [params.inflationKey='inflation_general'] - Configuration key used
 * @returns {Object} Plain projection result
 */
export function projectGoalFutureValue({
  amountToday,
  targetYear,
  currentYear,
  inflationRate,
  inflationKey = 'inflation_general'
}) {
  const dAmount = new Decimal(amountToday || 0);
  const dRate = new Decimal(inflationRate || '0.06');

  if (dAmount.lessThanOrEqualTo(0)) {
    throw new Error('Goal target amount today must be greater than zero.');
  }

  const yearsToGoal = targetYear - currentYear;
  if (yearsToGoal < 0) {
    throw new Error(`Target year (${targetYear}) cannot be in the past relative to current year (${currentYear}).`);
  }

  if (yearsToGoal === 0) {
    return {
      amountToday: dAmount.toFixed(2),
      futureGoalValue: dAmount.toFixed(2),
      yearsToGoal: 0,
      inflationRate: dRate.toFixed(6),
      inflationKey,
      inflationMultiplier: '1.000000'
    };
  }

  // futureGoalValue = amountToday * (1 + rate)^yearsToGoal
  const factor = new Decimal(1).plus(dRate).pow(yearsToGoal);
  const futureValue = dAmount.times(factor);

  return {
    amountToday: dAmount.toFixed(2),
    futureGoalValue: futureValue.toFixed(2),
    yearsToGoal,
    inflationRate: dRate.toFixed(6),
    inflationKey,
    inflationMultiplier: factor.toFixed(6)
  };
}
