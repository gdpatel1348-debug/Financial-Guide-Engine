import app from './app.js';
import { config } from './config/env.js';
import { getDatabase } from './db/sqlite.js';

// Verify database on startup
try {
  const db = getDatabase();
  const check = db.prepare('SELECT 1 AS ok').get();
  if (!check || check.ok !== 1) {
    throw new Error('Database ping check failed on startup.');
  }
  console.log(`[Database] SQLite connected at ${config.sqlitePath}`);
} catch (err) {
  console.error('[Database] Failed to connect to SQLite:', err.message);
  process.exit(1);
}

const server = app.listen(config.port, () => {
  console.log(`====================================================`);
  console.log(`  Financial Guidance Engine (v${config.engineVersion})`);
  console.log(`  Server listening on: http://localhost:${config.port}`);
  console.log(`  Environment: ${config.env}`);
  console.log(`====================================================`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
