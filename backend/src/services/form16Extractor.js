/**
 * form16Extractor.js
 * 
 * Pure extraction logic for Form 16 (Part A & Part B).
 * Handles text-layer PDFs via pdf-parse and scanned PDFs/images via Tesseract OCR.
 * Uses pattern configurations from form16FieldPatterns.js.
 * Sensitive data (PAN/salary) is never logged in plaintext.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
import Tesseract from 'tesseract.js';
import { form16Patterns } from '../config/form16FieldPatterns.js';

/**
 * Mask PAN: e.g. ABCDE1234F -> ABCDE****F
 */
export function maskPan(pan) {
  if (!pan || typeof pan !== 'string') return null;
  const clean = pan.trim().toUpperCase();
  if (clean.length === 10) {
    return `${clean.slice(0, 5)}****${clean.slice(9)}`;
  }
  return '*****';
}

/**
 * Clean and parse Indian currency amounts into numbers
 */
export function parseCurrencyAmount(rawStr) {
  if (rawStr === null || rawStr === undefined) return null;
  // Remove currency symbols (₹, Rs., Rs, INR), bullets/squares (■, ●, etc.), commas, whitespace
  const clean = String(rawStr)
    .replace(/(?:₹|INR|Rs\.?)/gi, '')
    .replace(/[■●◆▪\u25A0\u25CF]/g, '')
    .replace(/,/g, '')
    .trim();

  const num = parseFloat(clean);
  if (isNaN(num) || !isFinite(num)) return null;
  return Math.round(num);
}

/**
 * Formats Assessment Year into Financial Year (AY - 1)
 * e.g. AY 2027-28 -> FY 2026-27
 */
export function calculateFyFromAy(ayStartStr, ayEndStr) {
  const ayStart = parseInt(ayStartStr, 10);
  if (isNaN(ayStart) || ayStart < 2000 || ayStart > 2100) return null;

  const fyStart = ayStart - 1;
  const fyEnd = fyStart + 1;
  const fyEndShort = String(fyEnd).slice(-2);
  return `${fyStart}-${fyEndShort}`;
}

/**
 * Core Form 16 Extractor
 */
export class Form16Extractor {
  /**
   * Extract raw text from buffer depending on file type
   * @param {Buffer} buffer 
   * @param {string} mimeType 
   * @param {string} originalName 
   * @returns {Promise<{ text: string, source: 'text' | 'ocr' }>}
   */
  static async extractRawText(buffer, mimeType = '', originalName = '') {
    const isPdf = mimeType.includes('pdf') || originalName.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      let parser = null;
      try {
        parser = new PDFParse({ data: buffer });
        const textResult = await parser.getText();
        const text = textResult?.text || '';

        // If the PDF has an actual text layer with substantial content
        if (text.trim().length >= 50) {
          return { text, source: 'text' };
        }

        // Fallback for scanned PDF without text layer: check if embedded image can be OCR'd
        const imgResult = await parser.getImage({ imageBuffer: true }).catch(() => null);
        if (imgResult && Array.isArray(imgResult.pages) && imgResult.pages.length > 0) {
          let aggregatedOcrText = '';
          for (const page of imgResult.pages) {
            for (const img of page.images || []) {
              if (img?.data && img.data.length > 1000) {
                const { data: { text: ocrText } } = await Tesseract.recognize(Buffer.from(img.data), 'eng');
                aggregatedOcrText += '\n' + (ocrText || '');
              }
            }
          }
          if (aggregatedOcrText.trim().length >= 20) {
            return { text: aggregatedOcrText, source: 'ocr' };
          }
        }
      } catch (err) {
        // PDF parsing error - fall through to direct OCR if possible
      } finally {
        if (parser && typeof parser.destroy === 'function') {
          await parser.destroy().catch(() => {});
        }
      }
    }

    // Direct OCR path for images or scanned PDFs
    try {
      const { data: { text: ocrText } } = await Tesseract.recognize(buffer, 'eng');
      if (ocrText && ocrText.trim().length > 0) {
        return { text: ocrText, source: 'ocr' };
      }
    } catch (ocrErr) {
      throw new Error('Failed to run OCR on document.');
    }

    throw new Error('Document appears to be blank or unreadable.');
  }

  /**
   * Helper to resolve best candidate among multiple detected figures
   */
  static resolveCandidates(candidates, options = {}) {
    const { isDeduction = false, preferNonZero = true } = options;
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return { value: candidates[0], multiple: false, candidates };

    const nonZero = candidates.filter(c => c > 0);
    if (preferNonZero && nonZero.length === 1) {
      return { value: nonZero[0], multiple: false, candidates };
    }
    if (preferNonZero && nonZero.length > 1) {
      const chosen = isDeduction ? Math.max(...nonZero) : nonZero[0];
      return { value: chosen, multiple: true, candidates: nonZero };
    }
    return { value: candidates[0], multiple: false, candidates };
  }

  /**
   * Find candidate numbers for a pattern list
   * @param {string} text 
   * @param {Array<RegExp>} regexList 
   * @param {Object} options 
   * @returns {Array<number>} unique sorted candidate numbers
   */
  static findNumericCandidates(text, regexList, options = {}) {
    const { min = 0, max = 100000000, excludeYears = true } = options;
    const candidates = new Set();

    for (const regex of regexList) {
      // Create a global copy of the regex if needed
      const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
      const re = new RegExp(regex.source, flags);
      let match;

      while ((match = re.exec(text)) !== null) {
        const rawVal = match[1] !== undefined ? match[1] : match[0];
        const num = parseCurrencyAmount(rawVal);

        if (num !== null && num >= min && num <= max) {
          // Avoid confusing year numbers (e.g., 2026, 2027) with salary amounts
          if (excludeYears && num >= 1990 && num <= 2040) {
            continue;
          }
          // Avoid section numbers (e.g., 80, 16, 17, 192, 115)
          if ([16, 17, 24, 80, 115, 192].includes(num)) {
            continue;
          }
          candidates.add(num);
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Extract financial year from text
   */
  static extractFinancialYear(text, source) {
    // 1. Try Assessment Year
    for (const regex of form16Patterns.assessmentYear.patterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        const fy = calculateFyFromAy(match[1], match[2]);
        if (fy) {
          return {
            field: 'financial_year',
            value: fy,
            confidence: source === 'ocr' ? 'medium' : 'high',
            source
          };
        }
      }
    }

    // 2. Try direct Financial Year / Period with employer
    for (const regex of form16Patterns.financialYearDirect.patterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        let fyStart = parseInt(match[1], 10);
        if (fyStart >= 2000 && fyStart <= 2100) {
          const fyEnd = fyStart + 1;
          const fy = `${fyStart}-${String(fyEnd).slice(-2)}`;
          return {
            field: 'financial_year',
            value: fy,
            confidence: source === 'ocr' ? 'medium' : 'high',
            source
          };
        }
      }
    }

    return null;
  }

  /**
   * Extract Tax Regime
   */
  static extractTaxRegime(text, source) {
    let newRegimeScore = 0;
    let oldRegimeScore = 0;

    for (const kw of form16Patterns.taxRegime.newRegimeKeywords) {
      if (kw.test(text)) newRegimeScore++;
    }
    for (const kw of form16Patterns.taxRegime.oldRegimeKeywords) {
      if (kw.test(text)) oldRegimeScore++;
    }

    if (newRegimeScore > 0 && oldRegimeScore === 0) {
      return {
        field: 'regime_opted',
        value: 'NEW',
        confidence: source === 'ocr' ? 'low' : 'medium',
        source
      };
    }
    if (oldRegimeScore > 0 && newRegimeScore === 0) {
      return {
        field: 'regime_opted',
        value: 'OLD',
        confidence: source === 'ocr' ? 'low' : 'medium',
        source
      };
    }
    if (newRegimeScore > 0 && oldRegimeScore > 0) {
      return {
        field: 'regime_opted',
        value: 'NEW',
        confidence: 'low',
        candidates: ['NEW', 'OLD'],
        source
      };
    }

    return null;
  }

  /**
   * Extract masked PAN if present
   */
  static extractMaskedPan(text) {
    for (const regex of form16Patterns.pan.patterns) {
      const match = text.match(regex);
      if (match && match[1]) {
        return maskPan(match[1]);
      }
    }
    return null;
  }

  /**
   * Main extraction entry point
   * @param {Buffer} buffer - File buffer
   * @param {string} mimeType - Mime type
   * @param {string} originalName - Original file name
   * @returns {Promise<{ extracted: Object, warnings: Array<string>, meta: Object }>}
   */
  static async extract(buffer, mimeType = '', originalName = '') {
    const { text, source } = await this.extractRawText(buffer, mimeType, originalName);

    const extracted = {};
    const warnings = [];

    // 1. Financial Year
    const fyResult = this.extractFinancialYear(text, source);
    if (fyResult) {
      extracted.financial_year = {
        value: fyResult.value,
        confidence: fyResult.confidence,
        source: fyResult.source
      };
    } else {
      warnings.push('Could not locate Assessment / Financial Year on document — please verify manually.');
    }

    // 2. Tax Regime Opted
    const regimeResult = this.extractTaxRegime(text, source);
    if (regimeResult) {
      const entry = {
        value: regimeResult.value,
        confidence: regimeResult.confidence,
        source: regimeResult.source
      };
      if (regimeResult.candidates) entry.candidates = regimeResult.candidates;
      extracted.regime_opted = entry;
    } else {
      warnings.push('Tax regime not explicitly specified on Form 16 — default to New Tax Regime or select manually.');
    }

    // 3. Gross Annual Salary
    const grossCandidates = this.findNumericCandidates(
      text,
      form16Patterns.grossAnnualSalary.labels,
      { min: 10000, max: 100000000 }
    );
    const grossPick = this.resolveCandidates(grossCandidates);
    if (grossPick) {
      extracted.gross_annual_salary = {
        value: grossPick.value,
        confidence: source === 'ocr' ? 'low' : (grossPick.multiple ? 'low' : 'high'),
        ...(grossPick.multiple ? { candidates: grossPick.candidates } : {}),
        source
      };
      if (grossPick.multiple) {
        warnings.push(`Multiple gross salary candidates found (${grossPick.candidates.join(', ')}). Please verify.`);
      }
    } else {
      warnings.push('Could not locate Gross Salary figure — left blank.');
    }

    // 4. Net Annual / In-hand Income
    const netCandidates = this.findNumericCandidates(
      text,
      form16Patterns.netAnnualSalary.labels,
      { min: 10000, max: 100000000 }
    );
    const netPick = this.resolveCandidates(netCandidates);
    if (netPick) {
      extracted.net_annual_salary = {
        value: netPick.value,
        confidence: source === 'ocr' ? 'low' : (netPick.multiple ? 'low' : 'high'),
        ...(netPick.multiple ? { candidates: netPick.candidates } : {}),
        source
      };
    } else if (extracted.gross_annual_salary) {
      // If not explicitly written on standard Form 16, provide an estimated in-hand salary candidate
      const grossVal = extracted.gross_annual_salary.value;
      const taxVal = extracted.tds_paid ? extracted.tds_paid.value : 0;
      const estimatedNet = Math.max(0, Math.round(grossVal - taxVal - (grossVal * 0.05)));
      if (estimatedNet > 0 && estimatedNet < grossVal) {
        extracted.net_annual_salary = {
          value: estimatedNet,
          confidence: 'low',
          isEstimated: true,
          candidates: [estimatedNet],
          source: 'calculated'
        };
        warnings.push(`Net in-hand income estimated at ₹${estimatedNet.toLocaleString('en-IN')}. Please adjust to match your exact bank credit.`);
      }
    }

    // 5. Section 80C Deductions
    const s80cCandidates = this.findNumericCandidates(
      text,
      form16Patterns.section80C.labels,
      { min: 0, max: form16Patterns.section80C.maxLimit, excludeYears: false }
    );
    const s80cPick = this.resolveCandidates(s80cCandidates, { isDeduction: true });
    if (s80cPick) {
      extracted.section_80c_deductions = {
        value: s80cPick.value,
        confidence: source === 'ocr' ? 'low' : 'medium',
        ...(s80cPick.multiple ? { candidates: s80cPick.candidates } : {}),
        source
      };
    }

    // 6. Section 80D Health Insurance
    const s80dCandidates = this.findNumericCandidates(
      text,
      form16Patterns.section80D.labels,
      { min: 0, max: 100000, excludeYears: false }
    );
    const s80dPick = this.resolveCandidates(s80dCandidates, { isDeduction: true });
    if (s80dPick) {
      extracted.section_80d_deductions = {
        value: s80dPick.value,
        confidence: source === 'ocr' ? 'low' : 'medium',
        ...(s80dPick.multiple ? { candidates: s80dPick.candidates } : {}),
        source
      };
    }

    // 7. TDS Paid / Total Tax Deducted
    const tdsCandidates = this.findNumericCandidates(
      text,
      form16Patterns.tdsPaid.labels,
      { min: 0, max: 50000000 }
    );
    const tdsPick = this.resolveCandidates(tdsCandidates);
    if (tdsPick) {
      extracted.tds_paid = {
        value: tdsPick.value,
        confidence: source === 'ocr' ? 'low' : 'high',
        ...(tdsPick.multiple ? { candidates: tdsPick.candidates } : {}),
        source
      };
    }

    // 8. Home loan interest deduction / House property loss
    const hlCandidates = this.findNumericCandidates(
      text,
      form16Patterns.homeLoanInterest.labels,
      { min: 0, max: 500000, excludeYears: false }
    );
    const hlPick = this.resolveCandidates(hlCandidates);
    if (hlPick) {
      extracted.home_loan_interest_deduction = {
        value: Math.abs(hlPick.value),
        confidence: 'low',
        ...(hlPick.multiple ? { candidates: hlPick.candidates.map(Math.abs) } : {}),
        source
      };
    }

    // 9. Rental income (annual)
    const rentCandidates = this.findNumericCandidates(
      text,
      form16Patterns.rentalIncome.labels,
      { min: 0, max: 10000000 }
    );
    const rentPick = this.resolveCandidates(rentCandidates);
    if (rentPick) {
      extracted.rental_income = {
        value: rentPick.value,
        confidence: 'low',
        ...(rentPick.multiple ? { candidates: rentPick.candidates } : {}),
        source
      };
    }

    // 10. Other income
    const otherCandidates = this.findNumericCandidates(
      text,
      form16Patterns.otherIncome.labels,
      { min: 0, max: 10000000 }
    );
    const otherPick = this.resolveCandidates(otherCandidates);
    if (otherPick) {
      extracted.other_income = {
        value: otherPick.value,
        confidence: 'low',
        ...(otherPick.multiple ? { candidates: otherPick.candidates } : {}),
        source
      };
    }

    // Extract masked PAN if found
    const panMasked = this.extractMaskedPan(text);

    return {
      extracted,
      warnings,
      meta: {
        source,
        panMasked,
        isOcr: source === 'ocr',
        fieldsFoundCount: Object.keys(extracted).length
      }
    };
  }
}
