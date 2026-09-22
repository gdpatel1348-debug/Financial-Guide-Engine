-- Migration: 004_upgrade_data_model.sql
-- Purpose: Upgrade user data model to support complete financial profiles across normalized tables

-- 1. Profiles Table Extensions
ALTER TABLE profiles ADD COLUMN display_name TEXT;
ALTER TABLE profiles ADD COLUMN gender TEXT CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'));
ALTER TABLE profiles ADD COLUMN marital_status TEXT CHECK (marital_status IS NULL OR marital_status IN ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'));
ALTER TABLE profiles ADD COLUMN phone_number TEXT;
ALTER TABLE profiles ADD COLUMN city TEXT;
ALTER TABLE profiles ADD COLUMN state TEXT;
ALTER TABLE profiles ADD COLUMN occupation_type TEXT CHECK (occupation_type IS NULL OR occupation_type IN ('SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'PROFESSIONAL', 'RETIRED', 'STUDENT', 'HOMEMAKER', 'OTHER'));
ALTER TABLE profiles ADD COLUMN employer_or_business_name TEXT;
ALTER TABLE profiles ADD COLUMN job_title_or_business_type TEXT;
ALTER TABLE profiles ADD COLUMN employment_start_year INTEGER;
ALTER TABLE profiles ADD COLUMN monthly_lifestyle_expenses TEXT CHECK (monthly_lifestyle_expenses IS NULL OR CAST(monthly_lifestyle_expenses AS REAL) >= 0);

-- 2. Incomes Table Extensions
ALTER TABLE incomes ADD COLUMN monthly_gross_income TEXT;
ALTER TABLE incomes ADD COLUMN monthly_net_income TEXT;
ALTER TABLE incomes ADD COLUMN rental_income TEXT NOT NULL DEFAULT '0.00';
ALTER TABLE incomes ADD COLUMN business_income TEXT NOT NULL DEFAULT '0.00';
ALTER TABLE incomes ADD COLUMN interest_income TEXT NOT NULL DEFAULT '0.00';
ALTER TABLE incomes ADD COLUMN dividend_income TEXT NOT NULL DEFAULT '0.00';
ALTER TABLE incomes ADD COLUMN capital_gains TEXT NOT NULL DEFAULT '0.00';

-- 3. Tax Inputs Table
CREATE TABLE IF NOT EXISTS tax_inputs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  regime_opted TEXT NOT NULL CHECK (regime_opted IN ('OLD', 'NEW')),
  standard_deduction TEXT NOT NULL DEFAULT '0.00',
  section_80c_deductions TEXT NOT NULL DEFAULT '0.00',
  section_80d_deductions TEXT NOT NULL DEFAULT '0.00',
  home_loan_interest_deduction TEXT NOT NULL DEFAULT '0.00',
  other_eligible_deductions TEXT NOT NULL DEFAULT '0.00',
  tds_paid TEXT NOT NULL DEFAULT '0.00',
  advance_tax_paid TEXT NOT NULL DEFAULT '0.00',
  capital_gains_taxable TEXT NOT NULL DEFAULT '0.00',
  taxable_income_declared TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, financial_year),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tax_inputs_user_id ON tax_inputs(user_id);

-- 4. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  monthly_essential_expenses TEXT NOT NULL DEFAULT '0.00',
  monthly_lifestyle_expenses TEXT NOT NULL DEFAULT '0.00',
  monthly_education_expenses TEXT NOT NULL DEFAULT '0.00',
  monthly_medical_expenses TEXT NOT NULL DEFAULT '0.00',
  monthly_debt_payments TEXT NOT NULL DEFAULT '0.00',
  monthly_other_expenses TEXT NOT NULL DEFAULT '0.00',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, financial_year),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);

-- 5. Insurance Policies Extensions
ALTER TABLE insurance_policies ADD COLUMN policy_name TEXT;
ALTER TABLE insurance_policies ADD COLUMN policy_start_year INTEGER;
ALTER TABLE insurance_policies ADD COLUMN is_pure_term INTEGER NOT NULL DEFAULT 1 CHECK (is_pure_term IN (0, 1));
ALTER TABLE insurance_policies ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

-- 6. Liabilities Extensions
ALTER TABLE liabilities ADD COLUMN lender_name TEXT;
ALTER TABLE liabilities ADD COLUMN start_year INTEGER;
