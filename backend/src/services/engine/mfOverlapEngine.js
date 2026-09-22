import Decimal from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Computes pairwise weighted mutual fund overlap between two funds.
 * Holdings are matched by normalized ISIN string.
 * 
 * @param {Object} fundA - { amfiCode, schemeName, holdings: [{ isin, instrumentName, sector, weightPct }] }
 * @param {Object} fundB - { amfiCode, schemeName, holdings: [{ isin, instrumentName, sector, weightPct }] }
 * @returns {Object} Pairwise overlap result
 */
export function calculatePairwiseOverlap(fundA, fundB) {
  const mapA = new Map();
  for (const h of (fundA.holdings || [])) {
    if (h.isin) {
      mapA.set(h.isin.trim().toUpperCase(), {
        weight: new Decimal(h.weightPct || 0),
        instrumentName: h.instrumentName || 'Unknown',
        sector: h.sector || 'Other'
      });
    }
  }

  let overlapTotal = new Decimal(0);
  const commonHoldings = [];

  for (const h of (fundB.holdings || [])) {
    if (!h.isin) continue;
    const isin = h.isin.trim().toUpperCase();
    if (mapA.has(isin)) {
      const itemA = mapA.get(isin);
      const weightB = new Decimal(h.weightPct || 0);
      const minWeight = Decimal.min(itemA.weight, weightB);

      overlapTotal = overlapTotal.plus(minWeight);
      commonHoldings.push({
        isin,
        instrumentName: itemA.instrumentName,
        sector: itemA.sector,
        weightInA: itemA.weight.toFixed(2),
        weightInB: weightB.toFixed(2),
        overlapWeight: minWeight.toFixed(2)
      });
    }
  }

  // Sort common holdings by overlap contribution descending
  commonHoldings.sort((a, b) => new Decimal(b.overlapWeight).minus(new Decimal(a.overlapWeight)).toNumber());

  const overlapPct = overlapTotal.toFixed(2);
  const numPct = parseFloat(overlapPct);

  let status = 'HEALTHY';
  let label = 'Low redundancy (< 30%)';
  if (numPct >= 50) {
    status = 'HIGH_REDUNDANCY';
    label = 'High redundancy (>= 50%)';
  } else if (numPct >= 30) {
    status = 'WATCH';
    label = 'Moderate redundancy (30% - 50%)';
  }

  return {
    fundA: { amfiCode: fundA.amfiCode, schemeName: fundA.schemeName },
    fundB: { amfiCode: fundB.amfiCode, schemeName: fundB.schemeName },
    overlapPercentage: overlapPct,
    status,
    statusLabel: label,
    commonHoldingsCount: commonHoldings.length,
    commonHoldings
  };
}

/**
 * Computes all pairwise overlaps for a user's mutual fund portfolio.
 * 
 * @param {Array} funds - Array of fund holding objects with full scheme holdings
 * @returns {Object} Portfolio overlap report
 */
export function analyzePortfolioOverlap(funds = []) {
  if (funds.length < 2) {
    return {
      pairwiseOverlaps: [],
      highestOverlap: null,
      averageOverlap: '0.00',
      totalFundsAnalyzed: funds.length
    };
  }

  const pairwiseOverlaps = [];
  let sumOverlap = new Decimal(0);
  let count = 0;
  let highest = null;

  for (let i = 0; i < funds.length; i++) {
    for (let j = i + 1; j < funds.length; j++) {
      const result = calculatePairwiseOverlap(funds[i], funds[j]);
      pairwiseOverlaps.push(result);

      const dVal = new Decimal(result.overlapPercentage);
      sumOverlap = sumOverlap.plus(dVal);
      count++;

      if (!highest || dVal.greaterThan(new Decimal(highest.overlapPercentage))) {
        highest = result;
      }
    }
  }

  const avg = count > 0 ? sumOverlap.dividedBy(count).toFixed(2) : '0.00';

  return {
    pairwiseOverlaps,
    highestOverlap: highest,
    averageOverlap: avg,
    totalFundsAnalyzed: funds.length
  };
}
