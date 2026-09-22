import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('data', 'financial_guidance.sqlite');
const db = new Database(dbPath);
db.pragma('wal_checkpoint(TRUNCATE)');
console.log('WAL checkpoint TRUNCATE executed successfully.');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\n=== Available Tables in data/financial_guidance.sqlite ===');
for (const t of tables) {
  const cnt = db.prepare(`SELECT count(*) as c FROM "${t.name}"`).get().c;
  const cols = db.prepare(`PRAGMA table_info("${t.name}")`).all().map(c => c.name);
  console.log(`Table: ${t.name.padEnd(22)} | Rows: ${String(cnt).padStart(3)} | Columns: ${cols.join(', ')}`);
}
db.close();
