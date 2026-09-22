import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { closeDatabase } from '../backend/src/db/sqlite.js';
import { setupDatabase } from './setup.js';

dotenv.config();

export function resetDevelopmentDatabase() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('db:reset:development refused to run: NODE_ENV must be set to "development".');
  }

  const dbPath = process.env.SQLITE_DATABASE_PATH || './data/financial_guidance.sqlite';
  const resolvedPath = path.resolve(dbPath);

  // Safety: ensure path is within data/ and points to a .sqlite file
  if (!resolvedPath.includes('data') || !resolvedPath.endsWith('.sqlite')) {
    throw new Error(`Refusing to delete unsafe target database path: ${resolvedPath}`);
  }

  console.log(`[Reset] Resetting development database: ${resolvedPath}`);
  closeDatabase();

  for (const ext of ['', '-wal', '-shm', '-journal']) {
    const file = resolvedPath + ext;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`[Reset] Deleted: ${file}`);
    }
  }

  console.log('[Reset] Re-running setup...');
  setupDatabase();
  closeDatabase();
  console.log('[Reset] Development database has been safely reset.');
}

if (process.argv[1].endsWith('reset.js')) {
  try {
    resetDevelopmentDatabase();
  } catch (err) {
    console.error('[Reset] Error:', err.message);
    process.exit(1);
  }
}
