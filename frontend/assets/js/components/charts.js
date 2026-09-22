import { formatINR, formatINRFull, formatPct } from '../format.js';

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getContainer(target) {
  if (typeof target === 'string') {
    return document.getElementById(target);
  }
  return target;
}

function renderEmptyState(container, emptyState) {
  const el = getContainer(container);
  if (!el) return;
  const title = emptyState?.title || 'No data available yet.';
  const message = emptyState?.message || 'Add details to view this chart.';
  el.innerHTML = `
    <div class="chart-empty-state" role="status" aria-live="polite">
      <div class="empty-icon">📊</div>
      <div class="chart-empty-title">${escHtml(title)}</div>
      <div class="chart-empty-desc">${escHtml(message)}</div>
    </div>
  `;
}

/**
 * 1. Asset Allocation Donut / Horizontal Bar Chart
 */
export function renderAssetAllocationChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData) {
    renderEmptyState(el, data?.emptyState || { title: 'No assets have been entered yet.', message: 'Add your assets to view allocation.' });
    return;
  }

  const colors = {
    EQUITY: '#3b82f6',
    DEBT: '#10b981',
    GOLD: '#f59e0b',
    REAL_ESTATE: '#8b5cf6',
    CASH: '#06b6d4',
    OTHER: '#64748b'
  };

  const categories = (data.categories || []).filter(c => Number(c.amount) > 0);
  if (categories.length === 0) {
    renderEmptyState(el, data.emptyState);
    return;
  }

  const total = categories.reduce((sum, c) => sum + Number(c.amount), 0);
  let currentAngle = 0;
  const size = 200;
  const strokeWidth = 32;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  const slices = categories.map(c => {
    const amount = Number(c.amount);
    const pct = total > 0 ? amount / total : 0;
    const angle = pct * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = center + radius * Math.cos((Math.PI * (startAngle - 90)) / 180);
    const y1 = center + radius * Math.sin((Math.PI * (startAngle - 90)) / 180);
    const x2 = center + radius * Math.cos((Math.PI * (endAngle - 90)) / 180);
    const y2 = center + radius * Math.sin((Math.PI * (endAngle - 90)) / 180);
    const largeArc = angle > 180 ? 1 : 0;

    const pathData = categories.length === 1
      ? `M ${center - radius}, ${center} a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`
      : `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

    return {
      ...c,
      color: colors[c.key] || '#64748b',
      pathData,
      pctDisplay: (pct * 100).toFixed(1)
    };
  });

  const legendHtml = categories.map(c => {
    const col = colors[c.key] || '#64748b';
    return `
      <div class="chart-legend-item">
        <span class="legend-color-swatch" style="background:${col}"></span>
        <span class="legend-label">${escHtml(c.name)}</span>
        <span class="legend-value">${formatINR(c.amount)} (${escHtml(c.pct)}%)</span>
      </div>
    `;
  }).join('');

  const tableRowsHtml = categories.map(c => `
    <tr>
      <td>${escHtml(c.name)}</td>
      <td class="text-right text-mono" title="${escHtml(formatINRFull(c.amount))}">${escHtml(formatINR(c.amount))}</td>
      <td class="text-right text-mono">${escHtml(c.pct)}%</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Asset Allocation Chart">
      <div class="chart-header">
        <h4 class="chart-title">Asset Allocation</h4>
        <p class="chart-desc">Current portfolio breakdown across asset classes (Total: ${escHtml(formatINR(data.totalAssets))})</p>
      </div>
      <div class="chart-donut-layout">
        <div class="chart-svg-container">
          <svg viewBox="0 0 ${size} ${size}" class="chart-donut-svg" role="img" aria-label="Asset Allocation Donut Chart">
            ${slices.map(s => `
              <path d="${s.pathData}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-linecap="round">
                <title>${escHtml(s.name)}: ${escHtml(formatINR(s.amount))} (${escHtml(s.pctDisplay)}%)</title>
              </path>
            `).join('')}
          </svg>
        </div>
        <div class="chart-legend-grid">${legendHtml}</div>
      </div>
      <details class="chart-fallback-details mt-4">
        <summary class="chart-fallback-summary">View asset allocation data table</summary>
        <table class="chart-data-table mt-2">
          <thead>
            <tr><th>Asset Category</th><th class="text-right">Current Value</th><th class="text-right">Share (%)</th></tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </details>
    </div>
  `;
}

/**
 * 2. Net Worth Composition Chart (Assets vs Liabilities Comparison Bar Card)
 */
export function renderNetWorthCompositionChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data) return;

  const assetsNum = Math.max(0, Number(data.totalAssets || 0));
  const liabNum = Math.max(0, Number(data.totalLiabilities || 0));
  const maxVal = Math.max(1, assetsNum, liabNum);
  const assetsPct = ((assetsNum / maxVal) * 100).toFixed(1);
  const liabPct = ((liabNum / maxVal) * 100).toFixed(1);

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Net-Worth Composition Chart">
      <div class="chart-header">
        <h4 class="chart-title">Net-Worth Composition</h4>
        <p class="chart-desc">${escHtml(data.explanation || 'Total Assets minus Total Liabilities')}</p>
      </div>
      <div class="net-worth-bars mt-4">
        <div class="nw-bar-row">
          <div class="nw-bar-label"><span>Total Assets</span><strong class="text-mono" title="${escHtml(formatINRFull(data.totalAssets))}">${escHtml(formatINR(data.totalAssets))}</strong></div>
          <div class="nw-bar-track"><div class="nw-bar-fill green" style="width:${assetsPct}%"></div></div>
        </div>
        <div class="nw-bar-row mt-3">
          <div class="nw-bar-label"><span>Total Liabilities</span><strong class="text-mono text-danger" title="${escHtml(formatINRFull(data.totalLiabilities))}">${escHtml(formatINR(data.totalLiabilities))}</strong></div>
          <div class="nw-bar-track"><div class="nw-bar-fill red" style="width:${liabPct}%"></div></div>
        </div>
      </div>
      <div class="nw-result-card mt-4">
        <span class="nw-result-label">Net Worth</span>
        <span class="nw-result-value text-mono" title="${escHtml(formatINRFull(data.netWorth))}">${escHtml(formatINR(data.netWorth))}</span>
      </div>
    </div>
  `;
}

/**
 * 3. Income Distribution Chart
 */
export function renderIncomeDistributionChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData) {
    renderEmptyState(el, data?.emptyState || { title: 'Complete your income and expense details to view this chart.', message: 'Income and expense details are required.' });
    return;
  }

  const gross = Number(data.grossAnnual || 0);
  const tax = Number(data.estimatedTax || 0);
  const expenses = Number(data.annualLivingExpense || 0);
  const emi = Number(data.annualDebtService || 0);
  const savings = Number(data.annualDiscretionarySavings || 0);

  const items = [
    { label: 'Estimated Tax', value: tax, color: '#ef4444' },
    { label: 'Living Expenses', value: expenses, color: '#f59e0b' },
    { label: 'Debt Payments (EMI)', value: emi, color: '#8b5cf6' },
    { label: 'Discretionary Savings', value: savings, color: '#10b981' }
  ].filter(i => i.value > 0);

  const totalSpent = items.reduce((s, i) => s + i.value, 0);

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Income Distribution Chart">
      <div class="chart-header">
        <h4 class="chart-title">Annual Income Distribution</h4>
        <p class="chart-desc">Gross Annual Income: <strong class="text-mono">${escHtml(formatINR(data.grossAnnual))}</strong> (${escHtml(data.financialYear)})</p>
      </div>
      <div class="income-distribution-stacked-bar mt-4" aria-label="Stacked Bar Chart for Income Outflow">
        ${items.map(i => {
          const pct = gross > 0 ? (i.value / gross) * 100 : 0;
          return `<div class="id-stacked-seg" style="width:${pct}%;background:${i.color}" title="${escHtml(i.label)}: ${escHtml(formatINR(i.value))} (${pct.toFixed(1)}%)"></div>`;
        }).join('')}
      </div>
      <div class="income-legend-grid mt-4">
        ${items.map(i => {
          const pct = gross > 0 ? (i.value / gross) * 100 : 0;
          return `
            <div class="chart-legend-item">
              <span class="legend-color-swatch" style="background:${i.color}"></span>
              <span class="legend-label">${escHtml(i.label)}</span>
              <span class="legend-value">${escHtml(formatINR(i.value))} (${pct.toFixed(1)}%)</span>
            </div>
          `;
        }).join('')}
      </div>
      <details class="chart-fallback-details mt-4">
        <summary class="chart-fallback-summary">View cash flow data table</summary>
        <table class="chart-data-table mt-2">
          <thead><tr><th>Category</th><th class="text-right">Annual Amount</th><th class="text-right">Share of Gross Income</th></tr></thead>
          <tbody>
            <tr><td>Gross Annual Income</td><td class="text-right text-mono">${escHtml(formatINR(data.grossAnnual))}</td><td class="text-right text-mono">100.0%</td></tr>
            ${items.map(i => `
              <tr>
                <td>${escHtml(i.label)}</td>
                <td class="text-right text-mono" title="${escHtml(formatINRFull(i.value))}">${escHtml(formatINR(i.value))}</td>
                <td class="text-right text-mono">${gross > 0 ? ((i.value / gross) * 100).toFixed(1) : 0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </details>
    </div>
  `;
}

/**
 * 4. Goal Funding Stacked Bar Chart
 */
export function renderGoalFundingChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData || (data.goals || []).length === 0) {
    renderEmptyState(el, data?.emptyState || { title: 'No goals have been entered yet.', message: 'Add a goal to view future value, funding status, and indicative SIP.' });
    return;
  }

  const goals = data.goals || [];

  const barsHtml = goals.map(g => {
    const fv = Number(g.futureGoalValue || 0);
    const funded = Number(g.fundedAmount || 0);
    const gap = Number(g.shortfall || 0);
    const surplus = Number(g.surplus || 0);

    const fundedPct = fv > 0 ? Math.min(100, (funded / fv) * 100).toFixed(1) : 0;
    const gapPct = fv > 0 ? Math.min(100, (gap / fv) * 100).toFixed(1) : 0;

    return `
      <div class="goal-funding-card mt-3">
        <div class="goal-funding-header">
          <div>
            <strong class="goal-title">${escHtml(g.label || g.goalType)}</strong>
            <span class="text-xs text-dimmer ml-2">${escHtml(g.goalType)} · Target ${escHtml(g.targetYear)}</span>
          </div>
          <div class="text-mono text-sm">
            Target: <strong>${escHtml(formatINR(g.futureGoalValue))}</strong>
          </div>
        </div>
        <div class="goal-progress-track mt-2" aria-label="Goal Funding Progress Bar">
          <div class="goal-progress-fill funded" style="width:${fundedPct}%" title="Funded: ${escHtml(formatINR(funded))} (${fundedPct}%)"></div>
          ${gap > 0 ? `<div class="goal-progress-fill gap" style="width:${gapPct}%" title="Shortfall: ${escHtml(formatINR(gap))} (${gapPct}%)"></div>` : ''}
        </div>
        <div class="goal-funding-meta mt-2">
          <span class="text-xs text-accent">Funded: ${escHtml(formatINR(funded))} (${fundedPct}%)</span>
          ${gap > 0
            ? `<span class="text-xs text-danger">Shortfall: ${escHtml(formatINR(gap))} · SIP: ${escHtml(formatINR(g.monthlySip))}/mo</span>`
            : `<span class="text-xs text-accent font-semibold">Fully Funded${surplus > 0 ? ` (Surplus ${escHtml(formatINR(surplus))})` : ''}</span>`
          }
        </div>
      </div>
    `;
  }).join('');

  const tableRowsHtml = goals.map(g => `
    <tr>
      <td>${escHtml(g.label || g.goalType)}</td>
      <td>${escHtml(g.goalType)}</td>
      <td class="text-center">${escHtml(g.targetYear)}</td>
      <td class="text-right text-mono" title="${escHtml(formatINRFull(g.futureGoalValue))}">${escHtml(formatINR(g.futureGoalValue))}</td>
      <td class="text-right text-mono" title="${escHtml(formatINRFull(g.fundedAmount))}">${escHtml(formatINR(g.fundedAmount))}</td>
      <td class="text-right text-mono text-danger" title="${escHtml(formatINRFull(g.shortfall))}">${Number(g.shortfall) > 0 ? formatINR(g.shortfall) : '—'}</td>
      <td class="text-right text-mono text-accent" title="${escHtml(formatINRFull(g.monthlySip))}">${Number(g.monthlySip) > 0 ? formatINR(g.monthlySip) + '/mo' : '—'}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Goal Funding Chart">
      <div class="chart-header">
        <h4 class="chart-title">Goal Funding Analysis</h4>
        <p class="chart-desc">Projected target values vs funded corpus & indicative monthly SIP requirements</p>
      </div>
      <div class="chart-legend-inline mt-2 mb-2">
        <span class="chart-legend-item"><span class="legend-color-swatch" style="background:#10b981"></span> Funded</span>
        <span class="chart-legend-item ml-4"><span class="legend-color-swatch" style="background:#ef4444"></span> Shortfall</span>
      </div>
      <div class="goals-bar-list">${barsHtml}</div>
      <details class="chart-fallback-details mt-4">
        <summary class="chart-fallback-summary">View goal funding data table</summary>
        <table class="chart-data-table mt-2">
          <thead>
            <tr>
              <th>Goal</th><th>Type</th><th class="text-center">Target Year</th>
              <th class="text-right">Future Value</th><th class="text-right">Funded</th>
              <th class="text-right">Shortfall</th><th class="text-right">Indicative SIP</th>
            </tr>
          </thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </details>
    </div>
  `;
}

/**
 * 5. Corpus Projection Line Chart
 */
export function renderCorpusProjectionChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData || (data.series || []).length === 0) {
    renderEmptyState(el, data?.emptyState || { title: 'No assets entered for projection.', message: 'Add assets to view corpus projection series.' });
    return;
  }

  const series = data.series;
  const width = 600;
  const height = 260;
  const padding = { top: 30, right: 30, bottom: 40, left: 75 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const maxVal = Math.max(...series.map(s => Number(s.projectedCorpus || 0))) * 1.1 || 1;

  const points = series.map((s, idx) => {
    const x = padding.left + (idx / (series.length - 1)) * graphWidth;
    const yCorpus = padding.top + graphHeight - (Number(s.projectedCorpus || 0) / maxVal) * graphHeight;
    const yContrib = padding.top + graphHeight - (Number(s.cumulativeContribution || 0) / maxVal) * graphHeight;
    return { ...s, x, yCorpus, yContrib };
  });

  const pathCorpus = 'M ' + points.map(p => `${p.x} ${p.yCorpus}`).join(' L ');
  const pathContrib = 'M ' + points.map(p => `${p.x} ${p.yContrib}`).join(' L ');
  const areaCorpus = pathCorpus + ` L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  const yTicks = [0, maxVal * 0.33, maxVal * 0.66, maxVal].map(v => ({
    val: v,
    y: padding.top + graphHeight - (v / maxVal) * graphHeight
  }));

  const tableRowsHtml = series.map(s => `
    <tr>
      <td>${escHtml(s.year)}</td>
      <td class="text-right text-mono" title="${escHtml(formatINRFull(s.projectedCorpus))}">${escHtml(formatINR(s.projectedCorpus))}</td>
      <td class="text-right text-mono" title="${escHtml(formatINRFull(s.cumulativeContribution))}">${escHtml(formatINR(s.cumulativeContribution))}</td>
      <td class="text-right text-mono" title="${escHtml(formatINRFull(s.growth))}">${escHtml(formatINR(s.growth))}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Corpus Projection Line Chart">
      <div class="chart-header">
        <h4 class="chart-title">Corpus Growth Projection Over Time</h4>
        <p class="chart-desc">${escHtml(data.explanation)} Assumed Equity Return: <strong>${escHtml(data.returnAssumption)}</strong>, Inflation: <strong>${escHtml(data.inflationAssumption)}</strong>.</p>
      </div>
      <div class="chart-svg-container mt-3">
        <svg viewBox="0 0 ${width} ${height}" class="chart-line-svg" role="img" aria-label="Corpus Projection Chart">
          <!-- Grid lines -->
          ${yTicks.map(t => `
            <line x1="${padding.left}" y1="${t.y}" x2="${width - padding.right}" y2="${t.y}" stroke="var(--color-border)" stroke-dasharray="3,3" />
            <text x="${padding.left - 8}" y="${t.y + 4}" fill="var(--color-text-3)" font-size="10" text-anchor="end">${escHtml(formatINR(t.val))}</text>
          `).join('')}
          <!-- X Axis labels -->
          ${points.filter((_, i) => i % Math.ceil(series.length / 6) === 0 || i === series.length - 1).map(p => `
            <text x="${p.x}" y="${height - 12}" fill="var(--color-text-3)" font-size="10" text-anchor="middle">${escHtml(p.year)}</text>
          `).join('')}
          <!-- Area & Lines -->
          <path d="${areaCorpus}" fill="rgba(59,130,246,0.12)" />
          <path d="${pathContrib}" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="4,4" />
          <path d="${pathCorpus}" fill="none" stroke="#3b82f6" stroke-width="3" />
          <!-- Points -->
          ${points.map(p => `
            <circle cx="${p.x}" cy="${p.yCorpus}" r="4" fill="#3b82f6">
              <title>${escHtml(p.year)}: ${escHtml(formatINR(p.projectedCorpus))}</title>
            </circle>
          `).join('')}
        </svg>
      </div>
      <div class="chart-legend-inline mt-3">
        <span class="chart-legend-item"><span class="legend-color-swatch" style="background:#3b82f6"></span> Projected Corpus</span>
        <span class="chart-legend-item ml-4"><span class="legend-color-swatch" style="background:#64748b"></span> Cumulative Contributions</span>
      </div>
      <details class="chart-fallback-details mt-4">
        <summary class="chart-fallback-summary">View projection data table</summary>
        <table class="chart-data-table mt-2">
          <thead><tr><th>Year</th><th class="text-right">Projected Corpus</th><th class="text-right">Contributions</th><th class="text-right">Estimated Growth</th></tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </details>
    </div>
  `;
}

/**
 * 6. Tax Comparison Bar Chart
 */
export function renderTaxComparisonChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData) {
    renderEmptyState(el, data?.emptyState || { title: 'Complete your income and deduction details to compare tax regimes.', message: 'Income details are needed.' });
    return;
  }

  const oldTax = Number(data.oldRegimeTax || 0);
  const newTax = Number(data.newRegimeTax || 0);
  const maxTax = Math.max(1, oldTax, newTax);
  const oldPct = ((oldTax / maxTax) * 100).toFixed(1);
  const newPct = ((newTax / maxTax) * 100).toFixed(1);
  const isNewRec = data.recommendedRegime === 'NEW';

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Tax Comparison Chart">
      <div class="chart-header">
        <h4 class="chart-title">Tax Regime Comparison (${escHtml(data.financialYear)})</h4>
        <p class="chart-desc">${escHtml(data.disclaimer)}</p>
      </div>
      <div class="tax-compare-bars mt-4">
        <div class="tax-bar-card ${isNewRec ? 'recommended' : ''}">
          <div class="tax-bar-label">
            <span>New Tax Regime ${isNewRec ? '✓' : ''}</span>
            <strong class="text-mono" title="${escHtml(formatINRFull(data.newRegimeTax))}">${escHtml(formatINR(data.newRegimeTax))}</strong>
          </div>
          <div class="nw-bar-track mt-2"><div class="nw-bar-fill blue" style="width:${newPct}%"></div></div>
          ${isNewRec ? '<span class="label-tag green mt-2 inline-block">Recommended</span>' : ''}
        </div>
        <div class="tax-bar-card mt-3 ${!isNewRec ? 'recommended' : ''}">
          <div class="tax-bar-label">
            <span>Old Tax Regime ${!isNewRec ? '✓' : ''}</span>
            <strong class="text-mono" title="${escHtml(formatINRFull(data.oldRegimeTax))}">${escHtml(formatINR(data.oldRegimeTax))}</strong>
          </div>
          <div class="nw-bar-track mt-2"><div class="nw-bar-fill slate" style="width:${oldPct}%"></div></div>
          ${!isNewRec ? '<span class="label-tag green mt-2 inline-block">Recommended</span>' : ''}
        </div>
      </div>
      <div class="chart-note mt-3">
        Estimated tax savings with recommended regime: <strong class="text-accent text-mono">${escHtml(formatINR(data.taxSavingsWithRecommended))}</strong>.
      </div>
    </div>
  `;
}

/**
 * 7. Emergency Reserve Progress Chart
 */
export function renderEmergencyReserveChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData) {
    renderEmptyState(el, data?.emptyState || { title: 'Emergency reserve details incomplete.', message: 'Add liquid assets (cash, FD) and monthly expense details.' });
    return;
  }

  const cur = Number(data.currentLiquidAssets || 0);
  const target = Number(data.targetAmount || 0);
  const pct = target > 0 ? Math.min(100, (cur / target) * 100).toFixed(1) : 0;
  const isAdequate = data.isAdequate;

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Emergency Reserve Chart">
      <div class="chart-header">
        <h4 class="chart-title">Emergency Reserve Coverage</h4>
        <p class="chart-desc">Current coverage: <strong>${escHtml(data.currentCoverageMonths)} months</strong> (Target: <strong>${escHtml(data.targetMonths)} months</strong>)</p>
      </div>
      <div class="gauge-container mt-4">
        <div class="nw-bar-track lg">
          <div class="nw-bar-fill ${isAdequate ? 'green' : 'amber'}" style="width:${pct}%"></div>
        </div>
        <div class="flex justify-between text-xs text-dimmer mt-2">
          <span>Current: <strong class="text-mono">${escHtml(formatINR(data.currentLiquidAssets))}</strong></span>
          <span>Target: <strong class="text-mono">${escHtml(formatINR(data.targetAmount))}</strong></span>
        </div>
      </div>
      <div class="gauge-status-msg mt-3">
        ${isAdequate
          ? '<span class="text-accent font-semibold">✓ Adequate liquid reserves meeting configured reference guideline.</span>'
          : `<span class="text-warn font-semibold">Shortfall of ${escHtml(formatINR(data.shortfall))} to reach reference benchmark of ${escHtml(data.targetMonths)} months essential expenses.</span>`
        }
      </div>
    </div>
  `;
}

/**
 * 8. Insurance Coverage Chart
 */
export function renderInsuranceCoverageChart(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData) {
    renderEmptyState(el, data?.emptyState || { title: 'No insurance details have been entered.', message: 'Add insurance information to view coverage analysis.' });
    return;
  }

  const cur = Number(data.currentTermCover || 0);
  const rec = Number(data.recommendedMinimumCover || 0);
  const maxVal = Math.max(1, cur, rec);
  const curPct = ((cur / maxVal) * 100).toFixed(1);
  const recPct = ((rec / maxVal) * 100).toFixed(1);

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Insurance Coverage Chart">
      <div class="chart-header">
        <h4 class="chart-title">Life Insurance Pure Term Coverage</h4>
        <p class="chart-desc">Pure term cover compared against configured benchmark (${escHtml(data.termMultiple)}x gross income)</p>
      </div>
      <div class="insurance-compare-bars mt-4">
        <div class="ins-bar-row">
          <div class="nw-bar-label"><span>Entered Pure Term Cover</span><strong class="text-mono" title="${escHtml(formatINRFull(data.currentTermCover))}">${escHtml(formatINR(data.currentTermCover))}</strong></div>
          <div class="nw-bar-track"><div class="nw-bar-fill blue" style="width:${curPct}%"></div></div>
        </div>
        <div class="ins-bar-row mt-3">
          <div class="nw-bar-label"><span>Configured Reference Benchmark (${escHtml(data.termMultiple)}x)</span><strong class="text-mono" title="${escHtml(formatINRFull(data.recommendedMinimumCover))}">${escHtml(formatINR(data.recommendedMinimumCover))}</strong></div>
          <div class="nw-bar-track"><div class="nw-bar-fill slate" style="width:${recPct}%"></div></div>
        </div>
      </div>
      <p class="text-xs text-dimmer mt-4">Note: The configured income multiple is a reference benchmark, not a mandatory advice requirement. Insurance needs depend on dependents (${escHtml(data.dependents)}), liabilities (${escHtml(formatINR(data.totalLiabilities))}), and assets.</p>
    </div>
  `;
}

/**
 * 9. Mutual Fund Overlap Visualization
 */
export function renderMfOverlapVisualization(container, data) {
  const el = getContainer(container);
  if (!el) return;
  if (!data || !data.hasData || (data.pairwiseOverlaps || []).length === 0) {
    renderEmptyState(el, data?.emptyState || { title: 'No mutual-fund holdings have been entered, so overlap analysis is not available.', message: 'Add holdings to analyze overlap.' });
    return;
  }

  const overlaps = data.pairwiseOverlaps;
  const rowsHtml = overlaps.map(o => `
    <tr>
      <td>${escHtml(o.fundA?.schemeName || 'Fund A')}</td>
      <td>${escHtml(o.fundB?.schemeName || 'Fund B')}</td>
      <td class="text-center"><span class="badge ${o.status === 'HIGH_OVERLAP' ? 'badge-danger' : 'badge-success'}">${escHtml(o.status)}</span></td>
      <td class="text-right text-mono font-bold">${escHtml(o.overlapPercentage)}%</td>
      <td class="text-right text-mono">${escHtml(o.commonHoldingsCount)}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <div class="chart-card-wrapper" role="region" aria-label="Mutual Fund Overlap Visualization">
      <div class="chart-header">
        <h4 class="chart-title">Mutual-Fund Portfolio Overlap Analysis</h4>
        <p class="chart-desc">Pairwise holdings overlap percentage across entered fund schemes (Date: ${escHtml(data.holdingsDate)})</p>
      </div>
      <table class="chart-data-table mt-3">
        <thead>
          <tr><th>Scheme A</th><th>Scheme B</th><th class="text-center">Classification</th><th class="text-right">Overlap (%)</th><th class="text-right">Common Stocks</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
