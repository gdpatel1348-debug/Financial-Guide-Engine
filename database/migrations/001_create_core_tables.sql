-- Migration: 001_create_core_tables.sql
-- Purpose: Core tables for users, profiles, incomes, assets, insurance, liabilities, goals, and token revocations

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);

CREATE TABLE IF NOT EXISTS token_revocations (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  revoked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_token_revocations_user_id ON token_revocations(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  dependents INTEGER NOT NULL DEFAULT 0 CHECK (dependents >= 0),
  retirement_age INTEGER NOT NULL CHECK (retirement_age BETWEEN 40 AND 90),
  risk_profile TEXT NOT NULL CHECK (risk_profile IN ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE')),
  city_tier TEXT CHECK (city_tier IN ('TIER_1', 'TIER_2', 'TIER_3')),
  monthly_expense TEXT CHECK (monthly_expense IS NULL OR CAST(monthly_expense AS REAL) >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  gross_annual TEXT NOT NULL,
  net_annual TEXT,
  other_income TEXT NOT NULL DEFAULT '0.00',
  eligible_deductions TEXT NOT NULL DEFAULT '0.00',
  regime_opted TEXT NOT NULL CHECK (regime_opted IN ('OLD', 'NEW')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, financial_year),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_incomes_user_id ON incomes(user_id);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('MF', 'EQUITY', 'DEBT', 'REAL_ESTATE', 'GOLD', 'EPF', 'FD', 'CASH', 'OTHER')),
  label TEXT,
  current_value TEXT NOT NULL,
  annual_contribution TEXT NOT NULL DEFAULT '0.00',
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK (policy_type IN ('TERM', 'HEALTH', 'ULIP', 'ENDOWMENT', 'OTHER')),
  insurer TEXT,
  sum_assured TEXT NOT NULL DEFAULT '0.00',
  annual_premium TEXT NOT NULL DEFAULT '0.00',
  maturity_year INTEGER,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_insurance_policies_user_id ON insurance_policies(user_id);

CREATE TABLE IF NOT EXISTS liabilities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  loan_type TEXT NOT NULL,
  outstanding TEXT NOT NULL,
  emi TEXT NOT NULL DEFAULT '0.00',
  annual_interest_rate TEXT NOT NULL DEFAULT '0.000000',
  tenure_months_left INTEGER NOT NULL DEFAULT 0 CHECK (tenure_months_left >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);

CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  label TEXT,
  target_amount_today TEXT NOT NULL,
  target_year INTEGER NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 1),
  inflation_key TEXT NOT NULL,
  linked_asset_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
