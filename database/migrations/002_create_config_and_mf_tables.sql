-- Migration: 002_create_config_and_mf_tables.sql
-- Purpose: Tables for versioned assumption sets, tax slab sets, MF schemes, user MF holdings, and scheme holding breakdowns

CREATE TABLE IF NOT EXISTS assumption_sets (
  id TEXT PRIMARY KEY,
  financial_year TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'RETIRED')),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_note TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (financial_year, version)
);

CREATE TABLE IF NOT EXISTS assumptions (
  id TEXT PRIMARY KEY,
  assumption_set_id TEXT NOT NULL,
  assumption_key TEXT NOT NULL,
  numeric_value TEXT,
  text_value TEXT,
  unit TEXT NOT NULL,
  UNIQUE (assumption_set_id, assumption_key),
  FOREIGN KEY (assumption_set_id) REFERENCES assumption_sets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assumptions_set_id ON assumptions(assumption_set_id);

CREATE TABLE IF NOT EXISTS tax_slab_sets (
  id TEXT PRIMARY KEY,
  financial_year TEXT NOT NULL,
  regime TEXT NOT NULL CHECK (regime IN ('OLD', 'NEW')),
  standard_deduction TEXT NOT NULL,
  rebate_limit TEXT,
  rebate_amount TEXT,
  cess_rate TEXT NOT NULL,
  source_note TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (financial_year, regime, version)
);

CREATE TABLE IF NOT EXISTS tax_slabs (
  id TEXT PRIMARY KEY,
  tax_slab_set_id TEXT NOT NULL,
  slab_from TEXT NOT NULL,
  slab_to TEXT,
  rate TEXT NOT NULL,
  FOREIGN KEY (tax_slab_set_id) REFERENCES tax_slab_sets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tax_slabs_set_id ON tax_slabs(tax_slab_set_id);

CREATE TABLE IF NOT EXISTS mf_schemes (
  amfi_code TEXT PRIMARY KEY,
  isin TEXT,
  scheme_name TEXT NOT NULL,
  amc TEXT,
  category TEXT,
  latest_nav TEXT,
  nav_date TEXT,
  source_updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mf_schemes_isin ON mf_schemes(isin);
CREATE INDEX IF NOT EXISTS idx_mf_schemes_name ON mf_schemes(scheme_name);

CREATE TABLE IF NOT EXISTS mf_holdings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  amfi_code TEXT NOT NULL,
  units TEXT NOT NULL,
  average_cost TEXT NOT NULL DEFAULT '0.000000',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (asset_id, amfi_code),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (amfi_code) REFERENCES mf_schemes(amfi_code)
);

CREATE INDEX IF NOT EXISTS idx_mf_holdings_user_id ON mf_holdings(user_id);

CREATE TABLE IF NOT EXISTS mf_scheme_holdings (
  id TEXT PRIMARY KEY,
  amfi_code TEXT NOT NULL,
  isin TEXT NOT NULL,
  instrument_name TEXT NOT NULL,
  sector TEXT,
  weight_pct TEXT NOT NULL,
  as_of_date TEXT NOT NULL,
  source_file TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (amfi_code, isin, as_of_date),
  FOREIGN KEY (amfi_code) REFERENCES mf_schemes(amfi_code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mf_scheme_holdings_code_isin ON mf_scheme_holdings(amfi_code, isin);
