import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class AssetRepository {
  static listByUserId(userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM assets WHERE user_id = ? ORDER BY created_at ASC').all(userId);
  }

  static findByIdAndUserId(id, userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM assets WHERE id = ? AND user_id = ?').get(id, userId) || null;
  }

  static create(userId, data) {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const metadata = typeof data.metadata === 'object' ? JSON.stringify(data.metadata) : (data.metadata || '{}');

    db.prepare(`
      INSERT INTO assets (
        id, user_id, asset_type, label, current_value,
        annual_contribution, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      data.assetType,
      data.label || data.assetType,
      String(data.currentValue || '0.00'),
      String(data.annualContribution || '0.00'),
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

    const result = db.prepare(`
      UPDATE assets SET
        asset_type = ?,
        label = ?,
        current_value = ?,
        annual_contribution = ?,
        metadata = ?,
        updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      data.assetType,
      data.label || data.assetType,
      String(data.currentValue || '0.00'),
      String(data.annualContribution || '0.00'),
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
    const result = db.prepare('DELETE FROM assets WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }
}
