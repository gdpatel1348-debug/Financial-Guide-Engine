import Decimal from 'decimal.js';

// Configure Decimal precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Pure tax calculation function.
 * 
 * @param {Object} params
 * @param {string|number} params.grossIncome - Gross annual salary/business income
 * @param {string|number} [params.otherIncome='0'] - Other income (interest, dividend, etc.)
 * @param {string|number} [params.eligibleDeductions='0'] - Chapter VI-A deductions (80C, 80D, etc.)
 * @param {string|number} [params.capitalGains='0'] - Capital gains income (isolated from standard rebate)
 * @param {string} params.regime - 'OLD' or 'NEW'
 * @param {Object} params.ruleSet - Tax slab set with slabs array, standardDeduction, rebateLimit, rebateAmount, cessRate
 * @returns {Object} Plain serializable tax calculation result
 */
export function calculateTax({
  grossIncome,
  otherIncome = '0',
  eligibleDeductions = '0',
  capitalGains = '0',
  regime,
  ruleSet
}) {
  if (!ruleSet) {
    throw new Error('Tax calculation requires a valid ruleSet.');
  }

  const dGross = new Decimal(grossIncome || 0);
  const dOther = new Decimal(otherIncome || 0);
  const dDeductions = new Decimal(eligibleDeductions || 0);
  const dCapitalGains = new Decimal(capitalGains || 0);

  if (dGross.isNegative() || dOther.isNegative() || dDeductions.isNegative() || dCapitalGains.isNegative()) {
    throw new Error('Income and deduction amounts cannot be negative.');
  }

  const dStdDeduction = new Decimal(ruleSet.standardDeduction || 0);
  const dCessRate = new Decimal(ruleSet.cessRate || '0.04');
  const dRebateLimit = ruleSet.rebateLimit ? new Decimal(ruleSet.rebateLimit) : null;
  const dRebateAmount = ruleSet.rebateAmount ? new Decimal(ruleSet.rebateAmount) : null;

  // Deductions are only eligible under OLD regime; under NEW regime, only standard deduction applies
  const effectiveDeductions = regime === 'OLD' ? dDeductions : new Decimal(0);

  // Normal taxable income
  const totalNormalIncome = dGross.plus(dOther);
  const totalDeductionsAllowed = dStdDeduction.plus(effectiveDeductions);
  const taxableNormalIncome = Decimal.max(0, totalNormalIncome.minus(totalDeductionsAllowed));

  // Compute tax on normal income through progressive slabs
  let normalIncomeTax = new Decimal(0);
  const slabBreakdown = [];

  const slabs = (ruleSet.slabs || []).slice().sort((a, b) => new Decimal(a.slabFrom).minus(new Decimal(b.slabFrom)).toNumber());

  for (const slab of slabs) {
    const from = new Decimal(slab.slabFrom);
    const to = slab.slabTo ? new Decimal(slab.slabTo) : null;
    const rate = new Decimal(slab.rate);

    if (taxableNormalIncome.greaterThan(from)) {
      const taxableInSlab = to
        ? Decimal.min(taxableNormalIncome, to).minus(from)
        : taxableNormalIncome.minus(from);

      const taxInSlab = taxableInSlab.times(rate);
      normalIncomeTax = normalIncomeTax.plus(taxInSlab);

      slabBreakdown.push({
        from: from.toFixed(2),
        to: to ? to.toFixed(2) : 'Above',
        rate: rate.toFixed(6),
        taxableAmount: taxableInSlab.toFixed(2),
        tax: taxInSlab.toFixed(2)
      });
    }
  }

  // Section 87A rebate calculation
  let eligibleRebate = new Decimal(0);
  if (dRebateLimit && dRebateAmount && taxableNormalIncome.lessThanOrEqualTo(dRebateLimit)) {
    eligibleRebate = Decimal.min(normalIncomeTax, dRebateAmount);
  }

  // Marginal relief (for income marginally exceeding rebate limit)
  let marginalRelief = new Decimal(0);
  if (dRebateLimit && taxableNormalIncome.greaterThan(dRebateLimit)) {
    const excessIncome = taxableNormalIncome.minus(dRebateLimit);
    // Tax payable cannot exceed excess income over rebate limit
    if (normalIncomeTax.greaterThan(excessIncome)) {
      marginalRelief = normalIncomeTax.minus(excessIncome);
    }
  }

  const taxAfterRebateAndRelief = Decimal.max(0, normalIncomeTax.minus(eligibleRebate).minus(marginalRelief));

  // Capital gains tax (flat 12.5% LTCG / 20% STCG simplified reference, isolated from 87A rebate)
  const capitalGainsTax = dCapitalGains.times(new Decimal(ruleSet.capitalGainsRate || '0.125'));

  const subtotalTax = taxAfterRebateAndRelief.plus(capitalGainsTax);
  const cess = subtotalTax.times(dCessRate);
  const totalTax = subtotalTax.plus(cess);

  return {
    regime,
    grossIncome: dGross.toFixed(2),
    otherIncome: dOther.toFixed(2),
    standardDeduction: dStdDeduction.toFixed(2),
    eligibleDeductions: effectiveDeductions.toFixed(2),
    taxableNormalIncome: taxableNormalIncome.toFixed(2),
    normalIncomeTax: normalIncomeTax.toFixed(2),
    slabBreakdown,
    rebate87A: eligibleRebate.toFixed(2),
    marginalRelief: marginalRelief.toFixed(2),
    capitalGainsTax: capitalGainsTax.toFixed(2),
    subtotalTax: subtotalTax.toFixed(2),
    cess: cess.toFixed(2),
    totalTax: totalTax.toFixed(2),
    effectiveTaxRate: totalNormalIncome.isZero() ? '0.0000' : totalTax.dividedBy(totalNormalIncome).toFixed(4)
  };
}

/**
 * Compare Old vs New Tax Regimes.
 */
export function compareRegimes({
  grossIncome,
  otherIncome = '0',
  eligibleDeductions = '0',
  capitalGains = '0',
  oldRuleSet,
  newRuleSet
}) {
  const oldResult = calculateTax({
    grossIncome,
    otherIncome,
    eligibleDeductions,
    capitalGains,
    regime: 'OLD',
    ruleSet: oldRuleSet
  });

  const newResult = calculateTax({
    grossIncome,
    otherIncome,
    eligibleDeductions,
    capitalGains,
    regime: 'NEW',
    ruleSet: newRuleSet
  });

  const dOldTax = new Decimal(oldResult.totalTax);
  const dNewTax = new Decimal(newResult.totalTax);

  let recommendedRegime = 'NEW';
  let taxDifference = '0.00';

  if (dOldTax.lessThan(dNewTax)) {
    recommendedRegime = 'OLD';
    taxDifference = dNewTax.minus(dOldTax).toFixed(2);
  } else {
    taxDifference = dOldTax.minus(dNewTax).toFixed(2);
  }

  return {
    recommendedRegime,
    taxSavingsWithRecommended: taxDifference,
    oldRegime: oldResult,
    newRegime: newResult
  };
}
