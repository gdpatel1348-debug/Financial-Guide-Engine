import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class InsuranceRepository {
  static listByUserId(userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM insurance_policies WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  }

  static findByIdAndUserId(id, userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM insurance_policies WHERE id = ? AND user_id = ?').get(id, userId) || null;
  }

  static create(userId, data) {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const metadata = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : (data.metadata || '{}');

    const policyType = data.policyType || data.policy_type;
    const isPureTerm = data.isPureTerm !== undefined ? (data.isPureTerm ? 1 : 0) : (policyType === 'TERM' ? 1 : 0);
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1;

    db.prepare(`
      INSERT INTO insurance_policies (
        id, user_id, policy_type, insurer, policy_name, sum_assured,
        annual_premium, maturity_year, policy_start_year, is_pure_term,
        is_active, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      policyType,
      data.insurer || null,
      data.policyName || data.policy_name || null,
      String(data.sumAssured || data.sum_assured || '0.00'),
      String(data.annualPremium || data.annual_premium || '0.00'),
      data.maturityYear ? parseInt(data.maturityYear, 10) : (data.maturity_year ? parseInt(data.maturity_year, 10) : null),
      data.policyStartYear ? parseInt(data.policyStartYear, 10) : (data.policy_start_year ? parseInt(data.policy_start_year, 10) : null),
      isPureTerm,
      isActive,
      metadata,
      now,
      now
    );

    return this.findByIdAndUserId(id, userId);
  }

  static update(id, userId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const metadata = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : (data.metadata || '{}');

    const policyType = data.policyType || data.policy_type;
    const isPureTerm = data.isPureTerm !== undefined ? (data.isPureTerm ? 1 : 0) : (policyType === 'TERM' ? 1 : 0);
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1;

    const result = db.prepare(`
      UPDATE insurance_policies SET
        policy_type = ?,
        insurer = ?,
        policy_name = ?,
        sum_assured = ?,
        annual_premium = ?,
        maturity_year = ?,
        policy_start_year = ?,
        is_pure_term = ?,
        is_active = ?,
        metadata = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      policyType,
      data.insurer || null,
      data.policyName || data.policy_name || null,
      String(data.sumAssured || data.sum_assured || '0.00'),
      String(data.annualPremium || data.annual_premium || '0.00'),
      data.maturityYear ? parseInt(data.maturityYear, 10) : (data.maturity_year ? parseInt(data.maturity_year, 10) : null),
      data.policyStartYear ? parseInt(data.policyStartYear, 10) : (data.policy_start_year ? parseInt(data.policy_start_year, 10) : null),
      isPureTerm,
      isActive,
      metadata,
      now,
      id,
      userId
    );

    if (result.changes === 0) return null;
    return this.findByIdAndUserId(id, userId);
  }

  static delete(id, userId) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM insurance_policies WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }
}
