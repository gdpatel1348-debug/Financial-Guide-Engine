import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDatabase } from '../db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function syncMfHoldings({ fixturePath = null } = {}) {
  const db = getDatabase();
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  let recordsSeen = 0;
  let recordsWritten = 0;
  let status = 'RUNNING';
  let errorSummary = null;

  try {
    const file = fixturePath || path.resolve(__dirname, '../../tests/fixtures/holdings.json');
    if (!fs.existsSync(file)) {
      throw new Error(`Holdings fixture not found: ${file}`);
    }

    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO mf_scheme_holdings (
        id, amfi_code, isin, instrument_name, sector, weight_pct, as_of_date, source_file, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const scheme of data) {
        for (const h of (scheme.holdings || [])) {
          recordsSeen++;
          if (!h.isin || !h.instrumentName) continue;

          const id = crypto.randomUUID();
          stmt.run(
            id,
            scheme.amfiCode,
            h.isin.trim().toUpperCase(),
            h.instrumentName,
            h.sector || 'Other',
            String(h.weightPct || '0.00'),
            h.asOfDate || new Date().toISOString().slice(0, 10),
            path.basename(file),
            now
          );
          recordsWritten++;
        }
      }
    })();

    status = 'SUCCESS';
  } catch (err) {
    status = 'FAILED';
    errorSummary = err.message;
    console.error('[syncMfHoldings] Job failed:', err.message);
  } finally {
    const completedAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO refresh_runs (
        id, job_name, started_at, completed_at, status, source_url, records_seen, records_written, error_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      'syncMfHoldings',
      startedAt,
      completedAt,
      status,
      fixturePath || 'fixtures/holdings.json',
      recordsSeen,
      recordsWritten,
      errorSummary
    );
  }

  return { runId, status, recordsSeen, recordsWritten, errorSummary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncMfHoldings()
    .then(res => console.log('[syncMfHoldings] Completed:', res))
    .catch(err => console.error('[syncMfHoldings] Error:', err));
}
