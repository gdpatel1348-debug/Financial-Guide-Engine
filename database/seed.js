import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase, closeDatabase } from '../backend/src/db/sqlite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runSeeds(db = null) {
  const activeDb = db || getDatabase();
  const seedsDir = path.join(__dirname, 'seeds');

  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[Seed] Found ${files.length} seed file(s).`);

  for (const file of files) {
    console.log(`[Seed] Executing ${file}...`);
    const sql = fs.readFileSync(path.join(seedsDir, file), 'utf-8');

    activeDb.transaction(() => {
      activeDb.exec(sql);
    })();

    console.log(`[Seed] Finished ${file}.`);
  }

  console.log('[Seed] All seeds executed successfully.');
}

// Allow direct execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    runSeeds();
    closeDatabase();
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
    process.exit(1);
  }
}
