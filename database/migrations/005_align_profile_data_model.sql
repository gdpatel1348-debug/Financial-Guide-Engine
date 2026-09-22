-- Migration: 005_align_profile_data_model.sql
-- Purpose: Add non-destructive column alignments for complete financial-profile specifications

-- 1. Profiles Table Extension
ALTER TABLE profiles ADD COLUMN number_of_dependents INTEGER DEFAULT 0;
UPDATE profiles SET number_of_dependents = COALESCE(dependents, 0) WHERE number_of_dependents IS NULL OR number_of_dependents = 0;

-- 2. Incomes Table Extensions
ALTER TABLE incomes ADD COLUMN gross_annual_income TEXT;
ALTER TABLE incomes ADD COLUMN net_annual_income TEXT;
UPDATE incomes SET gross_annual_income = gross_annual WHERE gross_annual_income IS NULL;
UPDATE incomes SET net_annual_income = net_annual WHERE net_annual_income IS NULL;

-- 3. Expenses Table Extension
ALTER TABLE expenses ADD COLUMN monthly_insurance_premiums TEXT NOT NULL DEFAULT '0.00';
