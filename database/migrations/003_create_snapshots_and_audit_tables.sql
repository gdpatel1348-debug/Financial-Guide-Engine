-- Migration: 003_create_snapshots_and_audit_tables.sql
-- Purpose: Immutable plan snapshots, refresh runs logging, and audit events

CREATE TABLE IF NOT EXISTS plan_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  run_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  engine_version TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  assumption_set_id TEXT NOT NULL,
  tax_slab_set_ids TEXT NOT NULL,
  input_snapshot TEXT NOT NULL,
  output_snapshot TEXT NOT NULL,
  warnings TEXT NOT NULL DEFAULT '[]',
  source_metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assumption_set_id) REFERENCES assumption_sets(id)
);

CREATE INDEX IF NOT EXISTS idx_plan_runs_user_id ON plan_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_plan_runs_run_at ON plan_runs(run_at DESC);

CREATE TABLE IF NOT EXISTS refresh_runs (
  id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  source_url TEXT,
  records_seen INTEGER,
  records_written INTEGER,
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_refresh_runs_job_name ON refresh_runs(job_name, started_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  event_type TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  request_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_user_id ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC);
