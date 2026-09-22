import crypto from 'crypto';
import { getDatabase } from '../db/sqlite.js';

export class PlanRunRepository {
  static create(userId, {
    engineVersion,
    financialYear,
    assumptionSetId,
    taxSlabSetIds = [],
    inputSnapshot,
    outputSnapshot,
    warnings = [],
    sourceMetadata = {}
  }) {
    const db = getDatabase();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO plan_runs (
        id, user_id, run_at, engine_version, financial_year,
        assumption_set_id, tax_slab_set_ids, input_snapshot, output_snapshot,
        warnings, source_metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      now,
      engineVersion,
      financialYear,
      assumptionSetId,
      JSON.stringify(taxSlabSetIds),
      JSON.stringify(inputSnapshot),
      JSON.stringify(outputSnapshot),
      JSON.stringify(warnings),
      JSON.stringify(sourceMetadata)
    );

    return this.findByIdAndUserId(id, userId);
  }

  static findByIdAndUserId(id, userId) {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM plan_runs WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      runAt: row.run_at,
      engineVersion: row.engine_version,
      financialYear: row.financial_year,
      assumptionSetId: row.assumption_set_id,
      taxSlabSetIds: JSON.parse(row.tax_slab_set_ids || '[]'),
      inputSnapshot: JSON.parse(row.input_snapshot || '{}'),
      outputSnapshot: JSON.parse(row.output_snapshot || '{}'),
      warnings: JSON.parse(row.warnings || '[]'),
      sourceMetadata: JSON.parse(row.source_metadata || '{}')
    };
  }

  static listByUserId(userId, limit = 50) {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT id, user_id, run_at, engine_version, financial_year, output_snapshot
      FROM plan_runs
      WHERE user_id = ?
      ORDER BY run_at DESC
      LIMIT ?
    `).all(userId, limit);

    return rows.map(r => {
      const output = JSON.parse(r.output_snapshot || '{}');
      return {
        id: r.id,
        runAt: r.run_at,
        engineVersion: r.engine_version,
        financialYear: r.financial_year,
        netWorth: output.summary ? output.summary.netWorth : '0.00',
        totalFutureGoalValue: output.summary ? output.summary.totalFutureGoalValue : '0.00',
        totalShortfall: output.summary ? output.summary.totalShortfall : '0.00',
        totalRecommendedSIP: output.summary ? output.summary.totalRecommendedSIP : '0.00'
      };
    });
  }
}
