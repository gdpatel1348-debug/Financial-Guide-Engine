import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class IncomeRepository {
  static findByUserIdAndFY(userId, financialYear = '2026-27') {
    const db = getDatabase();
    return db.prepare('SELECT * FROM incomes WHERE user_id = ? AND financial_year = ?').get(userId, financialYear) || null;
  }

  static upsert(userId, data) {
    const db = getDatabase();
    const fy = data.financialYear || data.financial_year || '2026-27';
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM incomes WHERE user_id = ? AND financial_year = ?').get(userId, fy);

    const grossAnnual = String(data.grossAnnual || data.gross_annual || '0.00');
    const netAnnual = data.netAnnual ? String(data.netAnnual) : (data.net_annual ? String(data.net_annual) : null);
    const monthlyGross = data.monthlyGrossIncome ? String(data.monthlyGrossIncome) : (data.monthly_gross_income ? String(data.monthly_gross_income) : null);
    const monthlyNet = data.monthlyNetIncome ? String(data.monthlyNetIncome) : (data.monthly_net_income ? String(data.monthly_net_income) : null);
    const otherIncome = String(data.otherIncome || data.other_income || '0.00');
    const rentalIncome = String(data.rentalIncome || data.rental_income || '0.00');
    const businessIncome = String(data.businessIncome || data.business_income || '0.00');
    const interestIncome = String(data.interestIncome || data.interest_income || '0.00');
    const dividendIncome = String(data.dividendIncome || data.dividend_income || '0.00');
    const capitalGains = String(data.capitalGains || data.capital_gains || '0.00');
    const eligibleDeductions = String(data.eligibleDeductions || data.eligible_deductions || '0.00');
    const regimeOpted = (data.regimeOpted || data.regime_opted || 'NEW').toUpperCase();

    if (existing) {
      db.prepare(`
        UPDATE incomes SET
          gross_annual = ?,
          net_annual = ?,
          monthly_gross_income = ?,
          monthly_net_income = ?,
          other_income = ?,
          rental_income = ?,
          business_income = ?,
          interest_income = ?,
          dividend_income = ?,
          capital_gains = ?,
          eligible_deductions = ?,
          regime_opted = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        grossAnnual,
        netAnnual,
        monthlyGross,
        monthlyNet,
        otherIncome,
        rentalIncome,
        businessIncome,
        interestIncome,
        dividendIncome,
        capitalGains,
        eligibleDeductions,
        regimeOpted,
        now,
        existing.id
      );
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO incomes (
          id, user_id, financial_year, gross_annual, net_annual,
          monthly_gross_income, monthly_net_income, other_income, rental_income,
          business_income, interest_income, dividend_income, capital_gains,
          eligible_deductions, regime_opted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        userId,
        fy,
        grossAnnual,
        netAnnual,
        monthlyGross,
        monthlyNet,
        otherIncome,
        rentalIncome,
        businessIncome,
        interestIncome,
        dividendIncome,
        capitalGains,
        eligibleDeductions,
        regimeOpted,
        now,
        now
      );
    }

    return this.findByUserIdAndFY(userId, fy);
  }
}
