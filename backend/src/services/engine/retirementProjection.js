import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Pure retirement decumulation corpus calculator.
 * 
 * @param {Object} params
 * @param {number} params.currentAge
 * @param {number} params.retirementAge
 * @param {number} [params.lifeExpectancy=85]
 * @param {string|number} params.monthlyExpenseToday - Monthly essential living expense
 * @param {string|number} params.preRetirementInflation - Inflation before retirement
 * @param {string|number} params.postRetirementInflation - Inflation during retirement
 * @param {string|number} params.postRetirementReturn - Conservative expected annual return on retirement corpus
 * @returns {Object} Plain retirement calculation details
 */
export function calculateRetirementCorpus({
  currentAge,
  retirementAge,
  lifeExpectancy = 85,
  monthlyExpenseToday,
  preRetirementInflation = '0.060000',
  postRetirementInflation = '0.060000',
  postRetirementReturn = '0.070000'
}) {
  if (currentAge >= retirementAge) {
    throw new Error(`Current age (${currentAge}) must be less than retirement age (${retirementAge}).`);
  }
  if (retirementAge >= lifeExpectancy) {
    throw new Error(`Retirement age (${retirementAge}) must be less than life expectancy (${lifeExpectancy}).`);
  }

  const dMonthlyExp = new Decimal(monthlyExpenseToday || 0);
  if (dMonthlyExp.lessThanOrEqualTo(0)) {
    throw new Error('Monthly expenses must be greater than zero for retirement planning.');
  }

  const yearsToRetirement = retirementAge - currentAge;
  const yearsInRetirement = lifeExpectancy - retirementAge;

  const dPreInf = new Decimal(preRetirementInflation);
  const dPostInf = new Decimal(postRetirementInflation);
  const dPostReturn = new Decimal(postRetirementReturn);

  // 1. Inflate annual expenses to retirement year
  const annualExpenseToday = dMonthlyExp.times(12);
  const inflationGrowth = new Decimal(1).plus(dPreInf).pow(yearsToRetirement);
  const annualExpenseAtRetirement = annualExpenseToday.times(inflationGrowth);

  // 2. Compute post-retirement real rate of return
  // realRate = ((1 + postRetirementReturn) / (1 + postRetirementInflation)) - 1
  const realRate = new Decimal(1).plus(dPostReturn)
    .dividedBy(new Decimal(1).plus(dPostInf))
    .minus(1);

  // 3. Compute corpus needed at retirement (annuity-due formula)
  let corpusNeeded = new Decimal(0);

  if (realRate.abs().lessThan('0.000001')) {
    // Limiting case: real rate is zero
    corpusNeeded = annualExpenseAtRetirement.times(yearsInRetirement);
  } else {
    // PV of annuity due: PMT * (1 - (1 + r)^(-n)) / r * (1 + r)
    const factor = new Decimal(1).minus(new Decimal(1).plus(realRate).pow(-yearsInRetirement));
    const annuityFactor = factor.dividedBy(realRate).times(new Decimal(1).plus(realRate));
    corpusNeeded = annualExpenseAtRetirement.times(annuityFactor);
  }

  return {
    currentAge,
    retirementAge,
    lifeExpectancy,
    yearsToRetirement,
    yearsInRetirement,
    monthlyExpenseToday: dMonthlyExp.toFixed(2),
    annualExpenseToday: annualExpenseToday.toFixed(2),
    annualExpenseAtRetirement: annualExpenseAtRetirement.toFixed(2),
    realRateOfReturn: realRate.toFixed(6),
    corpusNeededAtRetirement: corpusNeeded.toFixed(2)
  };
}
