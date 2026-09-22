import { getDatabase } from '../db/sqlite.js';

export class ConfigRepository {
  static getActiveAssumptionSet(financialYear = '2026-27') {
    const db = getDatabase();
    // Get latest active or draft set
    const set = db.prepare(`
      SELECT * FROM assumption_sets
      WHERE financial_year = ?
      ORDER BY version DESC
      LIMIT 1
    `).get(financialYear);

    if (!set) return null;

    const rows = db.prepare('SELECT * FROM assumptions WHERE assumption_set_id = ?').all(set.id);
    const assumptionsMap = {};
    for (const r of rows) {
      assumptionsMap[r.assumption_key] = r.numeric_value || r.text_value;
    }

    return {
      set,
      assumptions: assumptionsMap,
      rawRows: rows
    };
  }

  static getTaxSlabSet(financialYear = '2026-27', regime = 'NEW') {
    const db = getDatabase();
    const set = db.prepare(`
      SELECT * FROM tax_slab_sets
      WHERE financial_year = ? AND regime = ?
      ORDER BY version DESC
      LIMIT 1
    `).get(financialYear, regime);

    if (!set) return null;

    const slabs = db.prepare('SELECT * FROM tax_slabs WHERE tax_slab_set_id = ? ORDER BY CAST(slab_from AS REAL) ASC').all(set.id);

    return {
      id: set.id,
      financialYear: set.financial_year,
      regime: set.regime,
      standardDeduction: set.standard_deduction,
      rebateLimit: set.rebate_limit,
      rebateAmount: set.rebate_amount,
      cessRate: set.cess_rate,
      sourceNote: set.source_note,
      version: set.version,
      slabs: slabs.map(s => ({
        slabFrom: s.slab_from,
        slabTo: s.slab_to,
        rate: s.rate
      }))
    };
  }

  static getTaxRuleSets(financialYear = '2026-27') {
    return {
      newRegime: this.getTaxSlabSet(financialYear, 'NEW'),
      oldRegime: this.getTaxSlabSet(financialYear, 'OLD')
    };
  }
}
