import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.resolve('data', 'financial_guidance.sqlite');
console.log('Active DB Path:', dbPath);

// Step 1: Check backup destination
const defaultBackupPath = path.resolve('data', 'financial_guidance-before-profile-upgrade.sqlite');
let backupPath = defaultBackupPath;
if (fs.existsSync(defaultBackupPath)) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  backupPath = path.resolve('data', `financial_guidance-before-profile-upgrade-${ts}.sqlite`);
}

// Step 2: Open DB to read existing state
const db = new Database(dbPath, { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('Existing tables:', tables.map(t => t.name));

let assetCount = 0;
let assetIds = [];
let assetSample = [];
if (tables.some(t => t.name === 'assets')) {
  const rows = db.prepare('SELECT id, user_id, asset_type, label, current_value, annual_contribution, created_at FROM assets').all();
  assetCount = rows.length;
  assetIds = rows.map(r => r.id);
  assetSample = rows.slice(0, 5);
}
console.log('Assets count before migration:', assetCount);
console.log('Asset IDs count:', assetIds.length);
console.log('Asset IDs:', assetIds);
console.log('Asset sample:', JSON.stringify(assetSample, null, 2));
db.close();

// Step 3: Checkpoint WAL and perform safe online backup
const srcDb = new Database(dbPath);
srcDb.pragma('wal_checkpoint(TRUNCATE)');
srcDb.backup(backupPath)
  .then(() => {
    console.log('Backup created successfully at:', backupPath);
    console.log('Backup exists:', fs.existsSync(backupPath), 'Size (bytes):', fs.statSync(backupPath).size);
    srcDb.close();
  })
  .catch(err => {
    console.error('Backup error:', err);
    srcDb.close();
    process.exit(1);
  });
