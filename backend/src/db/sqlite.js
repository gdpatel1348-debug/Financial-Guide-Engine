import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let dbInstance = null;

export function getDatabase(customPath = null) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const dbPath = customPath || process.env.SQLITE_DATABASE_PATH || './data/financial_guidance.sqlite';

  // In-memory support for testing
  if (dbPath === ':memory:') {
    const memDb = new Database(':memory:');
    memDb.pragma('foreign_keys = ON');
    return memDb;
  }

  // Ensure target directory exists
  const dir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Enforce foreign keys, WAL mode, and busy timeout
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export default getDatabase;
