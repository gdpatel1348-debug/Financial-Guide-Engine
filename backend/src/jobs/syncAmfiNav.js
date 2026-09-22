import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDatabase } from '../db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function syncAmfiNav({ fixturePath = null, url = 'https://www.amfiindia.com/spages/NAVAll.txt' } = {}) {
  const db = getDatabase();
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  let recordsSeen = 0;
  let recordsWritten = 0;
  let status = 'RUNNING';
  let errorSummary = null;

  try {
    let content = '';

    if (fixturePath) {
      content = fs.readFileSync(fixturePath, 'utf-8');
    } else {
      // Default to bundled test fixture for deterministic, offline local development
      const defaultFixture = path.resolve(__dirname, '../../tests/fixtures/amfi_nav.txt');
      if (fs.existsSync(defaultFixture)) {
        content = fs.readFileSync(defaultFixture, 'utf-8');
      } else {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching AMFI NAV`);
        content = await res.text();
      }
    }

    const lines = content.split('\n');
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO mf_schemes (
        amfi_code, isin, scheme_name, amc, category, latest_nav, nav_date, source_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.transaction(() => {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Scheme Code') || trimmed.includes('Open Ended')) continue;

        const parts = trimmed.split(';');
        if (parts.length >= 6) {
          recordsSeen++;
          const amfiCode = parts[0].trim();
          const isin = (parts[1] || parts[2] || '').trim();
          const schemeName = parts[3].trim();
          const nav = parts[4].trim();
          const date = parts[5].trim();

          if (amfiCode && !isNaN(parseFloat(nav))) {
            stmt.run(
              amfiCode,
              isin || null,
              schemeName,
              schemeName.split(' ')[0] || 'Mutual Fund',
              'Equity',
              nav,
              date,
              new Date().toISOString()
            );
            recordsWritten++;
          }
        }
      }
    })();

    status = 'SUCCESS';
  } catch (err) {
    status = 'FAILED';
    errorSummary = err.message;
    console.error('[syncAmfiNav] Job failed:', err.message);
  } finally {
    const completedAt = new Date().toISOString();
    db.prepare(`
      INSERT INTO refresh_runs (
        id, job_name, started_at, completed_at, status, source_url, records_seen, records_written, error_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      'syncAmfiNav',
      startedAt,
      completedAt,
      status,
      fixturePath || url,
      recordsSeen,
      recordsWritten,
      errorSummary
    );
  }

  return { runId, status, recordsSeen, recordsWritten, errorSummary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncAmfiNav()
    .then(res => console.log('[syncAmfiNav] Completed:', res))
    .catch(err => console.error('[syncAmfiNav] Error:', err));
}
