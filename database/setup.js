import { getDatabase, closeDatabase } from '../backend/src/db/sqlite.js';
import { runMigrations } from './migrate.js';
import { runSeeds } from './seed.js';

export function setupDatabase() {
  console.log('[Setup] Initializing SQLite database...');
  const db = getDatabase();

  // Run health query
  const row = db.prepare('SELECT 1 AS healthy').get();
  if (!row || row.healthy !== 1) {
    throw new Error('Database health check failed during initialization.');
  }
  console.log('[Setup] Database connection verified.');

  console.log('[Setup] Running migrations...');
  runMigrations(db);

  console.log('[Setup] Running seeds...');
  runSeeds(db);

  console.log('[Setup] Setup completed successfully.');
}

if (process.argv[1].endsWith('setup.js')) {
  try {
    setupDatabase();
    closeDatabase();
  } catch (err) {
    console.error('[Setup] Error:', err.message);
    process.exit(1);
  }
}
