import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class LiabilityRepository {
  static listByUserId(userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM liabilities WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  }

  static findByIdAndUserId(id, userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM liabilities WHERE id = ? AND user_id = ?').get(id, userId) || null;
  }

  static create(userId, data) {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO liabilities (
        id, user_id, loan_type, lender_name, outstanding, emi,
        annual_interest_rate, tenure_months_left, start_year, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      data.loanType || data.loan_type,
      data.lenderName || data.lender_name || null,
      String(data.outstanding || '0.00'),
      String(data.emi || '0.00'),
      String(data.annualInterestRate || data.annual_interest_rate || '0.000000'),
      data.tenureMonthsLeft !== undefined ? parseInt(data.tenureMonthsLeft, 10) : (data.tenure_months_left !== undefined ? parseInt(data.tenure_months_left, 10) : 0),
      data.startYear ? parseInt(data.startYear, 10) : (data.start_year ? parseInt(data.start_year, 10) : null),
      now,
      now
    );

    return this.findByIdAndUserId(id, userId);
  }

  static update(id, userId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const result = db.prepare(`
      UPDATE liabilities SET
        loan_type = ?,
        lender_name = ?,
        outstanding = ?,
        emi = ?,
        annual_interest_rate = ?,
        tenure_months_left = ?,
        start_year = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      data.loanType || data.loan_type,
      data.lenderName || data.lender_name || null,
      String(data.outstanding || '0.00'),
      String(data.emi || '0.00'),
      String(data.annualInterestRate || data.annual_interest_rate || '0.000000'),
      data.tenureMonthsLeft !== undefined ? parseInt(data.tenureMonthsLeft, 10) : (data.tenure_months_left !== undefined ? parseInt(data.tenure_months_left, 10) : 0),
      data.startYear ? parseInt(data.startYear, 10) : (data.start_year ? parseInt(data.start_year, 10) : null),
      now,
      id,
      userId
    );

    if (result.changes === 0) return null;
    return this.findByIdAndUserId(id, userId);
  }

  static delete(id, userId) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM liabilities WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }
}
