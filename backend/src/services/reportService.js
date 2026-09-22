import { PlanRunRepository } from '../repositories/planRun.repository.js';
import { ProfileRepository } from '../repositories/profile.repository.js';
import puppeteer from 'puppeteer';

export class ReportService {
  static generateReportHtml(planRun, profile) {
    const out = planRun.outputSnapshot || {};
    const sum = out.summary || {};
    const goals = out.goals || [];
    const diags = out.diagnostics || [];
    const alloc = out.assetAllocation || { amounts: {}, percentages: {} };
    const tax = out.taxComparison || {};
    const assumptions = out.assumptionsUsed || {};

    const formatINR = (val) => {
      const num = parseFloat(val || 0);
      return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Financial Guidance Report - ${planRun.id}</title>
  <style>
    @page { size: A4; margin: 15mm 15mm 20mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; line-height: 1.5; font-size: 11pt; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20pt; font-weight: 700; color: #0f172a; margin: 0; }
    .subtitle { color: #64748b; font-size: 10pt; margin-top: 4px; }
    .meta-box { font-size: 9pt; color: #475569; text-align: right; }
    .disclaimer-banner { background-color: #f1f5f9; border-left: 4px solid #64748b; padding: 10px 14px; margin-bottom: 20px; font-size: 9pt; color: #334155; }
    h2 { font-size: 13pt; color: #1e3a8a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 24px; margin-bottom: 12px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; }
    .card-label { font-size: 8.5pt; text-transform: uppercase; color: #64748b; font-weight: 600; letter-spacing: 0.5px; }
    .card-value { font-size: 14pt; font-weight: 700; color: #0f172a; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; font-size: 9pt; }
    th { background: #f1f5f9; text-align: left; padding: 8px 10px; font-weight: 600; color: #334155; border: 1px solid #cbd5e1; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
    .text-right { text-align: right; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; font-weight: 600; }
    .badge-critical { background: #fee2e2; color: #991b1b; }
    .badge-warning { background: #fef3c7; color: #92400e; }
    .badge-info { background: #e0f2fe; color: #0369a1; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 8pt; color: #94a3b8; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">Financial Guidance Report</h1>
      <div class="subtitle">Prepared for: ${profile ? profile.full_name : 'Client'}</div>
    </div>
    <div class="meta-box">
      <div><strong>Plan ID:</strong> ${planRun.id.slice(0, 8)}...</div>
      <div><strong>Date:</strong> ${new Date(planRun.runAt).toLocaleDateString('en-IN')}</div>
      <div><strong>FY:</strong> ${planRun.financialYear} | <strong>Engine:</strong> v${planRun.engineVersion}</div>
    </div>
  </div>

  <div class="disclaimer-banner">
    <strong>Educational Analysis Disclaimer:</strong> This document is generated for illustrative and planning analysis purposes only. It is not an offer, solicitation, or personalized investment advice under SEBI regulations. All projections are indicative and depend upon the assumptions noted herein. Consult a qualified financial advisor before executing financial decisions.
  </div>

  <h2>1. Financial Snapshot & Balance Sheet</h2>
  <div class="grid">
    <div class="card">
      <div class="card-label">Net Worth</div>
      <div class="card-value">${formatINR(sum.netWorth)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Assets</div>
      <div class="card-value">${formatINR(sum.totalAssets)}</div>
    </div>
    <div class="card">
      <div class="card-label">Total Liabilities</div>
      <div class="card-value">${formatINR(sum.totalLiabilities)}</div>
    </div>
  </div>

  <h2>2. Tax Optimization (FY ${planRun.financialYear})</h2>
  <p style="font-size: 9.5pt;">Selected Regime: <strong>${planRun.inputSnapshot.income.regimeOpted || 'NEW'}</strong>. Recommended: <strong>${sum.recommendedRegime || 'NEW'}</strong> (Potential Tax Savings: ${formatINR(sum.taxSavingsWithRecommended)}).</p>
  <table>
    <thead>
      <tr>
        <th>Regime</th>
        <th class="text-right">Taxable Income</th>
        <th class="text-right">Normal Tax</th>
        <th class="text-right">Rebate 87A</th>
        <th class="text-right">Total Tax (incl Cess)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>New Tax Regime (Sec 115BAC)</td>
        <td class="text-right">${tax.newRegime ? formatINR(tax.newRegime.taxableNormalIncome) : '-'}</td>
        <td class="text-right">${tax.newRegime ? formatINR(tax.newRegime.normalIncomeTax) : '-'}</td>
        <td class="text-right">${tax.newRegime ? formatINR(tax.newRegime.rebate87A) : '-'}</td>
        <td class="text-right"><strong>${tax.newRegime ? formatINR(tax.newRegime.totalTax) : '-'}</strong></td>
      </tr>
      <tr>
        <td>Old Tax Regime</td>
        <td class="text-right">${tax.oldRegime ? formatINR(tax.oldRegime.taxableNormalIncome) : '-'}</td>
        <td class="text-right">${tax.oldRegime ? formatINR(tax.oldRegime.normalIncomeTax) : '-'}</td>
        <td class="text-right">${tax.oldRegime ? formatINR(tax.oldRegime.rebate87A) : '-'}</td>
        <td class="text-right"><strong>${tax.oldRegime ? formatINR(tax.oldRegime.totalTax) : '-'}</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>3. Goal Gap Analysis & Required SIP</h2>
  <table>
    <thead>
      <tr>
        <th>Goal</th>
        <th>Target Year</th>
        <th class="text-right">Cost Today</th>
        <th class="text-right">Future Target</th>
        <th class="text-right">Projected Corpus</th>
        <th class="text-right">Shortfall</th>
        <th class="text-right">Indicative SIP</th>
      </tr>
    </thead>
    <tbody>
      ${goals.length === 0 ? '<tr><td colspan="7">No goals recorded.</td></tr>' : goals.map(g => `
        <tr>
          <td><strong>${g.label || g.goalType}</strong> (Pri: ${g.priority})</td>
          <td>${g.targetYear} (${g.yearsToGoal}y)</td>
          <td class="text-right">${formatINR(g.amountToday)}</td>
          <td class="text-right">${formatINR(g.futureGoalValue)}</td>
          <td class="text-right">${formatINR(g.futureAllocatedCorpus)}</td>
          <td class="text-right" style="color: ${parseFloat(g.shortfall) > 0 ? '#b91c1c' : '#15803d'}; font-weight: 600;">
            ${parseFloat(g.shortfall) > 0 ? formatINR(g.shortfall) : 'Fully Funded'}
          </td>
          <td class="text-right"><strong>${parseFloat(g.indicativeMonthlySIP) > 0 ? formatINR(g.indicativeMonthlySIP) + '/mo' : '-'}</strong></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>4. Key Diagnostic Observations</h2>
  <div>
    ${diags.map(d => `
      <div style="border-left: 3px solid ${d.severity === 'CRITICAL' ? '#ef4444' : d.severity === 'WARNING' ? '#f59e0b' : '#3b82f6'}; padding: 6px 10px; margin-bottom: 10px; background: #fafafa;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="font-size: 9.5pt;">${d.title}</strong>
          <span class="badge badge-${d.severity.toLowerCase()}">${d.severity}</span>
        </div>
        <p style="margin: 4px 0; font-size: 8.5pt; color: #475569;">${d.explanation}</p>
        <p style="margin: 2px 0; font-size: 8.5pt; color: #1e3a8a;"><strong>Recommended Review:</strong> ${d.nextStep}</p>
      </div>
    `).join('')}
  </div>

  <h2>5. Key Assumptions Used (Versioned FY ${planRun.financialYear})</h2>
  <div style="font-size: 8.5pt; color: #475569;">
    <div><strong>Inflation:</strong> General: ${(parseFloat(assumptions.inflation_general || 0.06)*100).toFixed(1)}% | Education: ${(parseFloat(assumptions.inflation_education || 0.08)*100).toFixed(1)}% | Medical: ${(parseFloat(assumptions.inflation_medical || 0.09)*100).toFixed(1)}%</div>
    <div><strong>Expected Returns:</strong> Equity: ${(parseFloat(assumptions.return_equity || 0.12)*100).toFixed(1)}% | Debt: ${(parseFloat(assumptions.return_debt || 0.07)*100).toFixed(1)}% | Gold: ${(parseFloat(assumptions.return_gold || 0.08)*100).toFixed(1)}%</div>
    <div><strong>Benchmarks:</strong> Emergency Fund: ${assumptions.emergency_fund_months || 6} months | Term Cover: ${assumptions.term_cover_income_multiple || 15}x income</div>
  </div>

  <div class="footer">
    <div>Financial Guidance Engine - Immutable Snapshot #${planRun.id}</div>
    <div>Page 1 of 1</div>
  </div>
</body>
</html>`;
  }

  static async renderPdf(planRun, profile) {
    const html = this.generateReportHtml(planRun, profile);

    try {
      const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
      const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      let executablePath = undefined;
      
      const fs = await import('fs');
      if (fs.existsSync(edgePath)) {
        executablePath = edgePath;
      } else if (fs.existsSync(chromePath)) {
        executablePath = chromePath;
      }

      const browser = await puppeteer.launch({
        headless: 'new',
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '20mm', left: '15mm', right: '15mm' }
      });
      await browser.close();
      return { buffer: pdfBuffer, type: 'application/pdf' };
    } catch (err) {
      // Graceful fallback to HTML if headless browser launch fails in environment
      console.warn('[ReportService] Puppeteer PDF rendering failed, falling back to HTML stream:', err.message);
      return { buffer: Buffer.from(html, 'utf-8'), type: 'text/html' };
    }
  }
}
