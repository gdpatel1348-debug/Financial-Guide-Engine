import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class MfRepository {
  static searchSchemes(query = '', limit = 20) {
    const db = getDatabase();
    const pattern = `%${query.trim()}%`;
    return db.prepare(`
      SELECT amfi_code, isin, scheme_name, amc, category, latest_nav, nav_date
      FROM mf_schemes
      WHERE scheme_name LIKE ? OR isin LIKE ? OR amfi_code LIKE ? OR amc LIKE ?
      LIMIT ?
    `).all(pattern, pattern, pattern, pattern, limit);
  }

  static getScheme(amfiCode) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM mf_schemes WHERE amfi_code = ?').get(amfiCode) || null;
  }

  static getSchemeHoldings(amfiCode) {
    const db = getDatabase();
    return db.prepare(`
      SELECT isin, instrument_name, sector, weight_pct, as_of_date
      FROM mf_scheme_holdings
      WHERE amfi_code = ?
      ORDER BY CAST(weight_pct AS REAL) DESC
    `).all(amfiCode);
  }

  static listUserHoldings(userId) {
    const db = getDatabase();
    return db.prepare(`
      SELECT h.*, s.scheme_name, s.amc, s.latest_nav, s.nav_date, a.label AS asset_label
      FROM mf_holdings h
      JOIN mf_schemes s ON h.amfi_code = s.amfi_code
      JOIN assets a ON h.asset_id = a.id
      WHERE h.user_id = ?
    `).all(userId);
  }

  static upsertHolding(userId, { assetId, amfiCode, units, averageCost = '0.000000' }) {
    const db = getDatabase();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM mf_holdings WHERE asset_id = ? AND amfi_code = ?').get(assetId, amfiCode);

    if (existing) {
      db.prepare(`
        UPDATE mf_holdings SET
          units = ?,
          average_cost = ?,
          updated_at = ?
        WHERE id = ? AND user_id = ?
      `).run(String(units), String(averageCost), now, existing.id, userId);
      return existing.id;
    } else {
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO mf_holdings (
          id, user_id, asset_id, amfi_code, units, average_cost, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, userId, assetId, amfiCode, String(units), String(averageCost), now, now);
      return id;
    }
  }

  static deleteHolding(id, userId) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM mf_holdings WHERE id = ? AND user_id = ?').run(id, userId);
    return result.changes > 0;
  }

  static upsertScheme(data) {
    const db = getDatabase();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR REPLACE INTO mf_schemes (
        amfi_code, isin, scheme_name, amc, category, latest_nav, nav_date, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.amfiCode,
      data.isin || null,
      data.schemeName,
      data.amc || null,
      data.category || null,
      data.latestNav ? String(data.latestNav) : null,
      data.navDate || null,
      now
    );
  }

  static upsertSchemeHoldings(amfiCode, holdings = []) {
    const db = getDatabase();
    const now = new Date().toISOString();

    db.transaction(() => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO mf_scheme_holdings (
          id, amfi_code, isin, instrument_name, sector, weight_pct, as_of_date, source_file, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const h of holdings) {
        const id = crypto.randomUUID();
        stmt.run(
          id,
          amfiCode,
          h.isin.trim().toUpperCase(),
          h.instrumentName,
          h.sector || 'Other',
          String(h.weightPct || '0.00'),
          h.asOfDate || new Date().toISOString().slice(0, 10),
          h.sourceFile || 'seed',
          now
        );
      }
    })();
  }
}
