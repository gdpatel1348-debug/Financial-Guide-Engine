import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Pure SIP calculator using monthly annuity-due formula.
 * Contributions occur at the beginning of each month.
 * 
 * @param {Object} params
 * @param {string|number} params.targetGap - Shortfall to fund (INR)
 * @param {number} params.years - Investment horizon in years
 * @param {string|number} [params.expectedAnnualReturn='0.120000'] - Annual expected return as decimal fraction
 * @returns {Object} Plain SIP calculation result
 */
export function calculateMonthlySIP({
  targetGap,
  years,
  expectedAnnualReturn = '0.120000'
}) {
  const dGap = new Decimal(targetGap || 0);
  const dAnnualReturn = new Decimal(expectedAnnualReturn || 0);

  if (dGap.lessThanOrEqualTo(0) || years <= 0) {
    return {
      targetGap: Decimal.max(0, dGap).toFixed(2),
      years: Math.max(0, years),
      months: Math.max(0, years * 12),
      expectedAnnualReturn: dAnnualReturn.toFixed(6),
      monthlyRate: '0.000000',
      monthlySIP: '0.00',
      totalInvested: '0.00',
      projectedGrowth: '0.00'
    };
  }

  const months = Math.round(years * 12);
  // Monthly rate: nominal annual return / 12
  const monthlyRate = dAnnualReturn.dividedBy(12);

  let monthlySIP = new Decimal(0);

  if (monthlyRate.isZero()) {
    monthlySIP = dGap.dividedBy(months);
  } else {
    // Annuity-due future value formula: FV = PMT * [((1 + i)^n - 1) / i] * (1 + i)
    // PMT = FV * i / [((1 + i)^n - 1) * (1 + i)]
    const growthFactor = new Decimal(1).plus(monthlyRate).pow(months);
    const denominator = growthFactor.minus(1).times(new Decimal(1).plus(monthlyRate));
    monthlySIP = dGap.times(monthlyRate).dividedBy(denominator);
  }

  const totalInvested = monthlySIP.times(months);
  const projectedGrowth = Decimal.max(0, dGap.minus(totalInvested));

  return {
    targetGap: dGap.toFixed(2),
    years,
    months,
    expectedAnnualReturn: dAnnualReturn.toFixed(6),
    monthlyRate: monthlyRate.toFixed(6),
    monthlySIP: monthlySIP.toFixed(2),
    totalInvested: totalInvested.toFixed(2),
    projectedGrowth: projectedGrowth.toFixed(2)
  };
}
