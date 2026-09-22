import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class GoalRepository {
  static listByUserId(userId) {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY priority ASC, target_year ASC').all(userId);
    return rows.map(r => ({
      ...r,
      linked_asset_ids: JSON.parse(r.linked_asset_ids || '[]')
    }));
  }

  static findByIdAndUserId(id, userId) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return null;
    return {
      ...row,
      linked_asset_ids: JSON.parse(row.linked_asset_ids || '[]')
    };
  }

  static create(userId, data) {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const linkedIds = Array.isArray(data.linkedAssetIds) ? JSON.stringify(data.linkedAssetIds) : '[]';

    db.prepare(`
      INSERT INTO goals (
        id, user_id, goal_type, label, target_amount_today,
        target_year, priority, inflation_key, linked_asset_ids,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      data.goalType,
      data.label || data.goalType,
      String(data.targetAmountToday || '0.00'),
      parseInt(data.targetYear, 10),
      parseInt(data.priority || 100, 10),
      data.inflationKey || 'inflation_general',
      linkedIds,
      now,
      now
    );

    return this.findByIdAndUserId(id, userId);
  }

  static update(id, userId, data) {
    const db = getDatabase();
    const now = new Date().toISOString();
    const linkedIds = Array.isArray(data.linkedAssetIds) ? JSON.stringify(data.linkedAssetIds) : '[]';

    const result = db.prepare(`
      UPDATE goals SET
        goal_type = ?,
        label = ?,
        target_amount_today = ?,
        target_year = ?,
        priority = ?,
        inflation_key = ?,
        linked_asset_ids = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      data.goalType,
      data.label || data.goalType,
      String(data.targetAmountToday || '0.00'),
      parseInt(data.targetYear, 10),
      parseInt(data.priority || 100, 10),
      data.inflationKey || 'inflation_general',
      linkedIds,
      now,
      id,
      userId
    );

    if (result.changes === 0) return null;
    return this.findByIdAndUserId(id, userId);
  }

  static delete(id, userId) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }
}
