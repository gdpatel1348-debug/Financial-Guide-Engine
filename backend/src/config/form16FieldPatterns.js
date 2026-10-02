/**
 * form16FieldPatterns.js
 * 
 * Configurable label-matching patterns and regexes for Form 16 extraction.
 * Form 16 layouts shift slightly across employers, assessment years, and payroll software.
 * Matching is driven by pattern configs so new label variants can be added
 * without touching core extraction logic.
 */

export const form16Patterns = {
  // Assessment Year -> Financial Year is AY - 1 (e.g. AY 2027-28 -> FY 2026-27)
  assessmentYear: {
    patterns: [
      /assessment\s*year[^\d\n\r]*([0-9]{4})[^\d\n\r]*([0-9]{2,4})/i,
      /\bAY[^\d\n\r]*([0-9]{4})[^\d\n\r]*([0-9]{2,4})/i
    ]
  },

  // Direct Financial Year if explicitly mentioned
  financialYearDirect: {
    patterns: [
      /financial\s*year[^\d\n\r]*([0-9]{4})[^\d\n\r]*([0-9]{2,4})/i,
      /\bFY[^\d\n\r]*([0-9]{4})[^\d\n\r]*([0-9]{2,4})/i,
      /period\s*(?:with\s+the\s+employer)?[^\d\n\r]*(?:from\s*)?[0-9]{1,2}[-/][0-9]{1,2}[-/]([0-9]{4})\s*(?:to\s*)[0-9]{1,2}[-/][0-9]{1,2}[-/]([0-9]{4})/i
    ]
  },

  // Tax Regime (New vs Old)
  taxRegime: {
    newRegimeKeywords: [
      /opting\s+out\s+of\s+taxation\s+u\/s\s*115BAC[^\w\n\r]*no\b/i,
      /opted\s+out\s+of\s+115BAC[^\w\n\r]*no\b/i,
      /whether\s+opting\s+out[^\n\r:]*[:\-–]?\s*no\b/i,
      /regime\s*opted[^\w\n\r]*(?:new|115BAC)\b/i,
      /new\s+tax\s+regime/i,
      /u\/s\s*115BAC\(1A\)\s*applicable/i,
      /tax\s+regime[^\w\n\r]*new\b/i
    ],
    oldRegimeKeywords: [
      /opting\s+out\s+of\s+taxation\s+u\/s\s*115BAC[^\w\n\r]*yes\b/i,
      /opted\s+out\s+of\s+115BAC[^\w\n\r]*yes\b/i,
      /whether\s+opting\s+out[^\n\r:]*[:\-–]?\s*yes\b/i,
      /regime\s*opted[^\w\n\r]*old\b/i,
      /old\s+tax\s+regime/i,
      /tax\s+regime[^\w\n\r]*old\b/i
    ]
  },

  // Gross Annual Salary (Part B total / Line 1 / Salary under section 17)
  grossAnnualSalary: {
    labels: [
      /Gross\s+(?:Annual\s+)?Salary\s*(?:\/\s*Business\s+Income)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Total\s+Salary\s+Paid\s*\/\s*Credited[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /1\.\s*Gross\s+Salary[\s\S]*?(?:\(d\)\s*Total|Total)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Gross\s+Salary[\s\S]*?(?:\(d\)\s*Total|Total)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Total\s+Gross\s+Salary[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Gross\s+Total\s+Salary[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Gross\s+Salary[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Salary\s+as\s+per\s+provisions\s+contained\s+in\s+sec(?:tion|\.)?\s*17\(1\)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Income\s+chargeable\s+under\s+(?:the\s+head\s+)?['"]?Salaries['"]?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Gross\s+Total\s+Income[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // Net Annual / In-hand Income (found on salary summaries, payslips & hybrid Form 16 fixtures)
  netAnnualSalary: {
    labels: [
      /Net\s+(?:Annual\s+)?(?:In-?hand\s+)?(?:Salary|Income|Pay)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /(?:Annual\s+)?(?:Net|In-?hand|Take-?home)\s+(?:Salary|Income|Pay)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Net\s+(?:Salary|Pay|Take-?home)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Salary\s+credited\s+to\s+bank[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // Section 80C deductions (Chapter VI-A itemized)
  section80C: {
    labels: [
      /(?:section|sec(?:\.|\s+)?)?80C\s*(?:deductions)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /deduction\s+under\s+section\s+80C[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /80C\s*(?:\(EPF|PPF|ELSS|Life\s+Insurance\)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?))/i
    ],
    maxLimit: 150000
  },

  // Section 80D health insurance (Chapter VI-A itemized)
  section80D: {
    labels: [
      /(?:section|sec(?:\.|\s+)?)?80D\s*(?:health\s+insurance(?:\s+premium)?)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /deduction\s+under\s+section\s+80D[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /health\s+insurance\s+premium[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /medical\s+insurance\s+premium[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // TDS / Total Tax Deducted
  tdsPaid: {
    labels: [
      /(?:TDS|tax\s+deducted\s+at\s+source)\s*(?:\/\s*advance\s+tax\s+paid)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /(?:total\s+)?tax\s+deducted(?:\s+at\s+source|\s+in\s+respect\s+of\s+the\s+employee)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /TDS\s+(?:deducted|paid)[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Total\s+TDS[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Tax\s+deducted\s+at\s+source\s+u\/s\s*192[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Tax\s+payable\s*\/\s*refund[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /Total\s+tax\s+payable[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // Home loan interest deduction / Income or loss from house property
  homeLoanInterest: {
    labels: [
      /home\s+loan\s+interest(?:\s+deduction)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /income\s*(?:\(or\s+permissible\s+loss\)\s*)?from\s+house\s+property[^\d\n\r\-]*(-?[0-9,]+(?:\.[0-9]{2})?)/i,
      /loss\s+from\s+house\s+property[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /interest\s+on\s+(?:housing|home)\s+loan[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /interest\s+on\s+borrowed\s+capital[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /sec(?:tion|\.)?\s*24(?:b)?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // Rental Income (annual)
  rentalIncome: {
    labels: [
      /rental\s+income\s*(?:\(annual\))?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /annual\s+value\s+of\s+house\s+property[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /income\s+from\s+house\s+property[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // Other Income
  otherIncome: {
    labels: [
      /other\s+income\s*(?:\([^)]*\))?[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /income\s+under\s+the\s+head\s+other\s+sources[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i,
      /any\s+other\s+income\s+reported\s+by\s+the\s+employee[^\d\n\r]*([0-9,]+(?:\.[0-9]{2})?)/i
    ]
  },

  // PAN pattern (masked before any display)
  pan: {
    patterns: [
      /\b([A-Z]{5}[0-9]{4}[A-Z])\b/
    ]
  }
};
