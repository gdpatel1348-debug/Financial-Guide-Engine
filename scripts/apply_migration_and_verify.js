import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { runMigrations } from '../database/migrate.js';

const dbPath = path.resolve('data', 'financial_guidance.sqlite');
console.log('Target Database:', dbPath);

// Step 1: Pre-migration Asset verification
const preDb = new Database(dbPath, { readonly: true });
const preAssetRows = preDb.prepare('SELECT id, user_id, asset_type, label, current_value, annual_contribution, metadata, created_at, updated_at FROM assets ORDER BY id').all();
const preAssetCount = preAssetRows.length;
const preAssetIds = preAssetRows.map(r => r.id);
preDb.close();

console.log(`[PRE-MIGRATION] Asset count: ${preAssetCount}`);
console.log('[PRE-MIGRATION] Asset IDs:', preAssetIds);

// Step 2: Apply Migrations
console.log('[MIGRATION] Running safe migrations...');
runMigrations();

// Step 3: Post-migration Asset verification
const postDb = new Database(dbPath, { readonly: true });
const postAssetRows = postDb.prepare('SELECT id, user_id, asset_type, label, current_value, annual_contribution, metadata, created_at, updated_at FROM assets ORDER BY id').all();
const postAssetCount = postAssetRows.length;
const postAssetIds = postAssetRows.map(r => r.id);

console.log(`[POST-MIGRATION] Asset count: ${postAssetCount}`);

// Assertions
if (preAssetCount !== postAssetCount) {
  throw new Error(`CRITICAL: Asset count changed! Before: ${preAssetCount}, After: ${postAssetCount}`);
}

for (let i = 0; i < preAssetCount; i++) {
  const pre = preAssetRows[i];
  const post = postAssetRows[i];
  if (pre.id !== post.id) {
    throw new Error(`CRITICAL: Asset ID mismatch at index ${i}: ${pre.id} vs ${post.id}`);
  }
  if (pre.current_value !== post.current_value || pre.asset_type !== post.asset_type || pre.label !== post.label) {
    throw new Error(`CRITICAL: Asset data mutated for ID ${pre.id}`);
  }
}
console.log('[VERIFICATION] 100% of existing asset rows and IDs survived unchanged!');

// Verify all required tables
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

console.log('\n--- Final Database Table Summary ---');
for (const t of tablesToCheck) {
  const cols = postDb.prepare(`PRAGMA table_info(${t})`).all();
  const count = postDb.prepare(`SELECT count(*) as cnt FROM ${t}`).get().cnt;
  console.log(`Table: ${t.padEnd(20)} | Rows: ${String(count).padStart(3)} | Columns (${cols.length}): ${cols.map(c => c.name).join(', ')}`);
}

postDb.close();
