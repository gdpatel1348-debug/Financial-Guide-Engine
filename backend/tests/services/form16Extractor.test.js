import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Form16Extractor, calculateFyFromAy, maskPan, parseCurrencyAmount } from '../../src/services/form16Extractor.js';

describe('Form 16 Extractor Unit Tests', () => {
  test('calculateFyFromAy correctly calculates FY from AY', () => {
    assert.strictEqual(calculateFyFromAy('2027', '28'), '2026-27');
    assert.strictEqual(calculateFyFromAy('2026', '27'), '2025-26');
    assert.strictEqual(calculateFyFromAy('2025', '26'), '2024-25');
  });

  test('maskPan masks sensitive PAN characters', () => {
    assert.strictEqual(maskPan('ABCDE1234F'), 'ABCDE****F');
    assert.strictEqual(maskPan('abcde1234f'), 'ABCDE****F');
    assert.strictEqual(maskPan(''), null);
    assert.strictEqual(maskPan(null), null);
  });

  test('parseCurrencyAmount handles standard and Indian currency formats', () => {
    assert.strictEqual(parseCurrencyAmount('18,00,000.00'), 1800000);
    assert.strictEqual(parseCurrencyAmount('₹ 1,42,000'), 142000);
    assert.strictEqual(parseCurrencyAmount('Rs. 150000'), 150000);
    assert.strictEqual(parseCurrencyAmount('0'), 0);
  });

  test('Extracts fields from typical Form 16 text layer', async () => {
    const sampleText = `
      FORM NO. 16
      [See rule 31(1)(a)]
      Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary
      Certificate No. ABC12345
      Last updated on 15-May-2027
      Assessment Year : 2027-28
      Period with the Employer : From 01-Apr-2026 To 31-Mar-2027
      PAN of the Employee : ABCDE1234F
      
      PART B
      Details of Salary paid and any other income and tax deducted
      Whether opting out of taxation u/s 115BAC? : No
      
      1. Gross Salary
         (a) Salary as per provisions contained in sec. 17(1) : Rs. 18,00,000.00
         (b) Value of perquisites u/s 17(2) : Rs. 0.00
         (c) Profits in lieu of salary u/s 17(3) : Rs. 0.00
         (d) Total : Rs. 18,00,000.00
      
      2. Total Deductions under Chapter VI-A
         (a) Section 80C : Rs. 1,50,000.00
         (b) Section 80D : Rs. 25,000.00
      
      3. Total tax deducted at source : Rs. 1,42,000.00
    `;

    // Mock extractRawText for unit test
    const origRaw = Form16Extractor.extractRawText;
    Form16Extractor.extractRawText = async () => ({ text: sampleText, source: 'text' });

    try {
      const result = await Form16Extractor.extract(Buffer.from('fake'), 'application/pdf', 'form16.pdf');

      assert.strictEqual(result.extracted.financial_year.value, '2026-27');
      assert.strictEqual(result.extracted.financial_year.confidence, 'high');

      assert.strictEqual(result.extracted.regime_opted.value, 'NEW');

      assert.strictEqual(result.extracted.gross_annual_salary.value, 1800000);
      assert.strictEqual(result.extracted.gross_annual_salary.confidence, 'high');

      assert.strictEqual(result.extracted.section_80c_deductions.value, 150000);
      assert.strictEqual(result.extracted.section_80d_deductions.value, 25000);

      assert.strictEqual(result.extracted.tds_paid.value, 142000);
      assert.strictEqual(result.extracted.tds_paid.confidence, 'high');

      assert.strictEqual(result.meta.panMasked, 'ABCDE****F');
      assert.strictEqual(result.meta.source, 'text');
    } finally {
      Form16Extractor.extractRawText = origRaw;
    }
  });

  test('Flags multiple candidate values with confidence low instead of silently guessing', async () => {
    const sampleTextWithConflict = `
      Assessment Year : 2027-28
      1. Gross Salary (d) Total: Rs. 18,00,000.00
      Gross Total Salary: Rs. 19,50,000.00
      Total tax deducted: Rs. 1,42,000.00
    `;

    const origRaw = Form16Extractor.extractRawText;
    Form16Extractor.extractRawText = async () => ({ text: sampleTextWithConflict, source: 'text' });

    try {
      const result = await Form16Extractor.extract(Buffer.from('fake'), 'application/pdf', 'form16.pdf');

      assert.strictEqual(result.extracted.gross_annual_salary.confidence, 'low');
      assert.ok(result.extracted.gross_annual_salary.candidates.length >= 2);
      assert.ok(result.extracted.gross_annual_salary.candidates.includes(1800000));
      assert.ok(result.extracted.gross_annual_salary.candidates.includes(1950000));
    } finally {
      Form16Extractor.extractRawText = origRaw;
    }
  });

  test('Downgrades confidence to low when source is OCR', async () => {
    const sampleText = `
      Assessment Year : 2027-28
      Gross Salary: 15,00,000
      Total tax deducted: 1,00,000
    `;

    const origRaw = Form16Extractor.extractRawText;
    Form16Extractor.extractRawText = async () => ({ text: sampleText, source: 'ocr' });

    try {
      const result = await Form16Extractor.extract(Buffer.from('fake'), 'image/jpeg', 'form16.jpg');

      assert.strictEqual(result.extracted.gross_annual_salary.confidence, 'low');
      assert.strictEqual(result.extracted.gross_annual_salary.source, 'ocr');
      assert.strictEqual(result.extracted.tds_paid.confidence, 'low');
      assert.strictEqual(result.extracted.tds_paid.source, 'ocr');
      assert.strictEqual(result.meta.isOcr, true);
    } finally {
      Form16Extractor.extractRawText = origRaw;
    }
  });

  test('Extracts comprehensive fields including Net Salary, Zero deductions, and Bullet symbols from hybrid Form 16 fixtures', async () => {
    const fixtureText = `
      FORM NO. 16 — SAMPLE / TEST DATA
      Financial Year 2026–27 Assessment Year 2027–28
      Tax Regime New Tax Regime (Default) Currency INR (■)
      Gross Annual Salary / Business Income ■ 1,800,000 Net Annual In-hand Income ■ 1,400,000
      Rental Income (Annual) ■ 0 Other Income ■ 0
      Section 80C deductions ■ 0 Maximum reference limit ■ 150,000
      Section 80D health insurance ■ 0 Home loan interest deduction ■ 0
      TDS / Advance tax paid ■ 0 Rental income ■ 0
      Other income (interest/dividend/etc.) ■ 0 Tax regime New Tax Regime
    `;

    const origRaw = Form16Extractor.extractRawText;
    Form16Extractor.extractRawText = async () => ({ text: fixtureText, source: 'text' });

    try {
      const result = await Form16Extractor.extract(Buffer.from('fake'), 'application/pdf', 'sample.pdf');
      assert.strictEqual(result.extracted.financial_year.value, '2026-27');
      assert.strictEqual(result.extracted.regime_opted.value, 'NEW');
      assert.strictEqual(result.extracted.gross_annual_salary.value, 1800000);
      assert.strictEqual(result.extracted.net_annual_salary.value, 1400000);
      assert.strictEqual(result.extracted.section_80c_deductions.value, 0);
      assert.strictEqual(result.extracted.section_80d_deductions.value, 0);
      assert.strictEqual(result.extracted.tds_paid.value, 0);
      assert.strictEqual(result.extracted.home_loan_interest_deduction.value, 0);
      assert.strictEqual(result.extracted.rental_income.value, 0);
      assert.strictEqual(result.extracted.other_income.value, 0);
    } finally {
      Form16Extractor.extractRawText = origRaw;
    }
  });
});
