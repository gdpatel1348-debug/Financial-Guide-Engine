import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Projects the future value of a single asset over a number of years.
 * 
 * @param {Object} params
 * @param {string|number} params.currentValue
 * @param {string|number} [params.annualContribution='0']
 * @param {string|number} params.expectedAnnualReturn
 * @param {number} params.years
 * @returns {Object}
 */
export function projectAssetFutureValue({
  currentValue,
  annualContribution = '0',
  expectedAnnualReturn,
  years
}) {
  const dCurrent = new Decimal(currentValue || 0);
  const dContribution = new Decimal(annualContribution || 0);
  const dRate = new Decimal(expectedAnnualReturn || 0);

  if (years <= 0) {
    return {
      currentValue: dCurrent.toFixed(2),
      futureLumpSum: dCurrent.toFixed(2),
      futureContributions: '0.00',
      totalFutureValue: dCurrent.toFixed(2),
      years: 0
    };
  }

  // Future value of lump sum: PV * (1 + r)^n
  const growthFactor = new Decimal(1).plus(dRate).pow(years);
  const futureLumpSum = dCurrent.times(growthFactor);

  // Future value of regular annual contributions: PMT * (((1 + r)^n - 1) / r) * (1 + r) (annuity-due at start of year)
  let futureContributions = new Decimal(0);
  if (dContribution.greaterThan(0)) {
    if (dRate.isZero()) {
      futureContributions = dContribution.times(years);
    } else {
      const annuityFactor = growthFactor.minus(1).dividedBy(dRate).times(new Decimal(1).plus(dRate));
      futureContributions = dContribution.times(annuityFactor);
    }
  }

  const totalFutureValue = futureLumpSum.plus(futureContributions);

  return {
    currentValue: dCurrent.toFixed(2),
    futureLumpSum: futureLumpSum.toFixed(2),
    futureContributions: futureContributions.toFixed(2),
    totalFutureValue: totalFutureValue.toFixed(2),
    years
  };
}

/**
 * Projects total future corpus for a set of assets linked to a goal.
 */
export function projectLinkedCorpus({ assets = [], returnsMap = {}, years }) {
  let totalCurrentValue = new Decimal(0);
  let totalProjectedValue = new Decimal(0);
  const assetBreakdown = [];

  for (const asset of assets) {
    const assetType = (asset.asset_type || asset.assetType || 'OTHER').toUpperCase();
    let rate = returnsMap[`return_${assetType.toLowerCase()}`];
    if (!rate) {
      if (['MF', 'EQUITY'].includes(assetType)) {
        rate = returnsMap.return_equity || returnsMap.return_mf;
      } else if (['DEBT', 'EPF', 'FD'].includes(assetType)) {
        rate = returnsMap.return_debt || returnsMap.return_epf || returnsMap.return_fd;
      }
    }
    rate = rate || returnsMap.return_other || '0.070000';

    const projection = projectAssetFutureValue({
      currentValue: asset.current_value || asset.currentValue || '0',
      annualContribution: asset.annual_contribution || asset.annualContribution || '0',
      expectedAnnualReturn: rate,
      years
    });

    totalCurrentValue = totalCurrentValue.plus(new Decimal(projection.currentValue));
    totalProjectedValue = totalProjectedValue.plus(new Decimal(projection.totalFutureValue));

    assetBreakdown.push({
      assetId: asset.id,
      assetType,
      label: asset.label || assetType,
      currentValue: projection.currentValue,
      projectedValue: projection.totalFutureValue,
      expectedReturn: new Decimal(rate).toFixed(6)
    });
  }

  return {
    totalCurrentValue: totalCurrentValue.toFixed(2),
    totalProjectedValue: totalProjectedValue.toFixed(2),
    years,
    assetBreakdown
  };
}

/**
 * Generates a year-by-year time-series projection for portfolio assets over a specified horizon.
 * 
 * @param {Object} params
 * @param {Array} params.assets
 * @param {Object} params.returnsMap
 * @param {number} [params.currentYear=new Date().getFullYear()]
 * @param {number} [params.horizonYears=15]
 * @returns {Array} List of annual projection points
 */
export function projectCorpusTimeSeries({ assets = [], returnsMap = {}, currentYear = new Date().getFullYear(), horizonYears = 15 }) {
  const points = [];
  const safeHorizon = Math.max(1, Math.min(40, horizonYears));

  for (let yr = 0; yr <= safeHorizon; yr++) {
    const calendarYear = currentYear + yr;
    let pointCorpus = new Decimal(0);
    let pointContributions = new Decimal(0);

    for (const asset of assets) {
      const assetType = (asset.asset_type || asset.assetType || 'OTHER').toUpperCase();
      let rate = returnsMap[`return_${assetType.toLowerCase()}`];
      if (!rate) {
        if (['MF', 'EQUITY'].includes(assetType)) {
          rate = returnsMap.return_equity || returnsMap.return_mf;
        } else if (['DEBT', 'EPF', 'FD'].includes(assetType)) {
          rate = returnsMap.return_debt || returnsMap.return_epf || returnsMap.return_fd;
        }
      }
      rate = rate || returnsMap.return_other || '0.070000';

      const proj = projectAssetFutureValue({
        currentValue: asset.current_value || asset.currentValue || '0',
        annualContribution: asset.annual_contribution || asset.annualContribution || '0',
        expectedAnnualReturn: rate,
        years: yr
      });

      pointCorpus = pointCorpus.plus(new Decimal(proj.totalFutureValue));
      pointContributions = pointContributions.plus(new Decimal(proj.currentValue).plus(new Decimal(proj.futureContributions)));
    }

    points.push({
      yearIndex: yr,
      year: calendarYear,
      projectedCorpus: pointCorpus.toFixed(2),
      cumulativeContribution: pointContributions.toFixed(2),
      growth: pointCorpus.minus(pointContributions).toFixed(2)
    });
  }

  return points;
}

