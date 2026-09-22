import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class TaxInputRepository {
  static findByUserIdAndFY(userId, financialYear = '2026-27') {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tax_inputs WHERE user_id = ? AND financial_year = ?').get(userId, financialYear) || null;
  }

  static upsert(userId, data) {
    const db = getDatabase();
    const fy = data.financialYear || data.financial_year || '2026-27';
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM tax_inputs WHERE user_id = ? AND financial_year = ?').get(userId, fy);

    const regimeOpted = (data.regimeOpted || data.regime_opted || 'NEW').toUpperCase();
    const standardDeduction = String(data.standardDeduction || data.standard_deduction || '0.00');
    const section80cDeductions = String(data.section80cDeductions || data.section_80c_deductions || '0.00');
    const section80dDeductions = String(data.section80dDeductions || data.section_80d_deductions || '0.00');
    const homeLoanInterestDeduction = String(data.homeLoanInterestDeduction || data.home_loan_interest_deduction || '0.00');
    const otherEligibleDeductions = String(data.otherEligibleDeductions || data.other_eligible_deductions || '0.00');
    const tdsPaid = String(data.tdsPaid || data.tds_paid || '0.00');
    const advanceTaxPaid = String(data.advanceTaxPaid || data.advance_tax_paid || '0.00');
    const capitalGainsTaxable = String(data.capitalGainsTaxable || data.capital_gains_taxable || '0.00');
    const taxableIncomeDeclared = data.taxableIncomeDeclared ? String(data.taxableIncomeDeclared) : (data.taxable_income_declared ? String(data.taxable_income_declared) : null);

    if (existing) {
      db.prepare(`
        UPDATE tax_inputs SET
          regime_opted = ?,
          standard_deduction = ?,
          section_80c_deductions = ?,
          section_80d_deductions = ?,
          home_loan_interest_deduction = ?,
          other_eligible_deductions = ?,
          tds_paid = ?,
          advance_tax_paid = ?,
          capital_gains_taxable = ?,
          taxable_income_declared = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        regimeOpted,
        standardDeduction,
        section80cDeductions,
        section80dDeductions,
        homeLoanInterestDeduction,
        otherEligibleDeductions,
        tdsPaid,
        advanceTaxPaid,
        capitalGainsTaxable,
        taxableIncomeDeclared,
        now,
        existing.id
      );
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO tax_inputs (
          id, user_id, financial_year, regime_opted, standard_deduction,
          section_80c_deductions, section_80d_deductions, home_loan_interest_deduction,
          other_eligible_deductions, tds_paid, advance_tax_paid, capital_gains_taxable,
          taxable_income_declared, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        fy,
        regimeOpted,
        standardDeduction,
        section80cDeductions,
        section80dDeductions,
        homeLoanInterestDeduction,
        otherEligibleDeductions,
        tdsPaid,
        advanceTaxPaid,
        capitalGainsTaxable,
        taxableIncomeDeclared,
        now,
        now
      );
    }

    return this.findByUserIdAndFY(userId, fy);
  }
}
