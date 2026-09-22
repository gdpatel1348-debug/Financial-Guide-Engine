import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class ExpenseRepository {
  static findByUserIdAndFY(userId, financialYear = '2026-27') {
    const db = getDatabase();
    return db.prepare('SELECT * FROM expenses WHERE user_id = ? AND financial_year = ?').get(userId, financialYear) || null;
  }

  static upsert(userId, data) {
    const db = getDatabase();
    const fy = data.financialYear || data.financial_year || '2026-27';
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM expenses WHERE user_id = ? AND financial_year = ?').get(userId, fy);

    const essential = String(data.monthlyEssentialExpenses || data.monthly_essential_expenses || '0.00');
    const lifestyle = String(data.monthlyLifestyleExpenses || data.monthly_lifestyle_expenses || '0.00');
    const education = String(data.monthlyEducationExpenses || data.monthly_education_expenses || '0.00');
    const medical = String(data.monthlyMedicalExpenses || data.monthly_medical_expenses || '0.00');
    const debt = String(data.monthlyDebtPayments || data.monthly_debt_payments || '0.00');
    const insurance = String(data.monthlyInsurancePremiums || data.monthly_insurance_premiums || '0.00');
    const other = String(data.monthlyOtherExpenses || data.monthly_other_expenses || '0.00');

    if (existing) {
      db.prepare(`
        UPDATE expenses SET
          monthly_essential_expenses = ?,
          monthly_lifestyle_expenses = ?,
          monthly_education_expenses = ?,
          monthly_medical_expenses = ?,
          monthly_debt_payments = ?,
          monthly_insurance_premiums = ?,
          monthly_other_expenses = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        essential,
        lifestyle,
        education,
        medical,
        debt,
        insurance,
        other,
        now,
        existing.id
      );
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO expenses (
          id, user_id, financial_year, monthly_essential_expenses,
          monthly_lifestyle_expenses, monthly_education_expenses,
          monthly_medical_expenses, monthly_debt_payments, monthly_insurance_premiums, monthly_other_expenses,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        fy,
        essential,
        lifestyle,
        education,
        medical,
        debt,
        insurance,
        other,
        now,
        now
      );
    }

    return this.findByUserIdAndFY(userId, fy);
  }
}
