import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase, closeDatabase } from '../backend/src/db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(db = null) {
  const activeDb = db || getDatabase();
  const migrationsDir = path.join(__dirname, 'migrations');

  // Track applied migrations in a schema_migrations table
  activeDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[Migration] Found ${files.length} migration file(s).`);

  for (const file of files) {
    const isApplied = activeDb.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(file);
    if (isApplied) {
      console.log(`[Migration] Skipping ${file} (already applied).`);
      continue;
    }

    console.log(`[Migration] Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    activeDb.transaction(() => {
      activeDb.exec(sql);
      activeDb.prepare('INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)').run(file);
    })();

    console.log(`[Migration] Successfully applied ${file}.`);
  }

  console.log('[Migration] All migrations applied successfully.');
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runMigrations();
    closeDatabase();
  } catch (err) {
    console.error('[Migration] Failed:', err.message);
    process.exit(1);
  }
}
