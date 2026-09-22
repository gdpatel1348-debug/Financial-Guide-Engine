import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('data', 'financial_guidance.sqlite');
const db = new Database(dbPath, { readonly: true });

const tablesToCheck = [
  'users',
  'profiles',
  'incomes',
  'tax_inputs',
  'expenses',
  'assets',
  'insurance_policies',
  'liabilities',
  'goals',
  'plan_runs',
  'assumptions',
  'tax_slabs'
];

for (const t of tablesToCheck) {
  try {
    const cols = db.prepare(`PRAGMA table_info(${t})`).all();
    const count = db.prepare(`SELECT count(*) as cnt FROM ${t}`).get().cnt;
    console.log(`\n=== Table: ${t} (${cols.length} columns, ${count} rows) ===`);
    console.log(cols.map(c => `${c.name} (${c.type})`).join(', '));
  } catch (err) {
    console.log(`\n=== Table: ${t} does not exist or error: ${err.message} ===`);
  }
}

db.close();
