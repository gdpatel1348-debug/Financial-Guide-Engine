-- Seed: assumptions_fy_2026_27.sql
-- Financial Year 2026-27 Planning Assumptions
-- Status: DRAFT (Development and local prototype; requires qualified review before production use)
-- Source: Indicative planning guidelines based on historical Indian macroeconomic trends and SEBI/AMFI literature.

INSERT OR REPLACE INTO assumption_sets (
  id,
  financial_year,
  version,
  status,
  effective_from,
  effective_to,
  source_note,
  created_at
) VALUES (
  'as-fy-2026-27-v1',
  '2026-27',
  1,
  'DRAFT',
  '2026-04-01',
  '2027-03-31',
  'Indicative FY 2026-27 planning assumptions for educational modeling. Development/Draft status.',
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- Inflation Assumptions (Annual rates as decimal fractions)
INSERT OR REPLACE INTO assumptions (id, assumption_set_id, assumption_key, numeric_value, text_value, unit) VALUES
  ('as-2627-inf-gen', 'as-fy-2026-27-v1', 'inflation_general', '0.060000', 'General Inflation Rate', 'rate'),
  ('as-2627-inf-edu', 'as-fy-2026-27-v1', 'inflation_education', '0.080000', 'Education Cost Inflation', 'rate'),
  ('as-2627-inf-med', 'as-fy-2026-27-v1', 'inflation_medical', '0.090000', 'Medical Cost Inflation', 'rate'),
  ('as-2627-inf-life', 'as-fy-2026-27-v1', 'inflation_lifestyle', '0.060000', 'Lifestyle Inflation', 'rate');

-- Asset Class Return Expectations (Annual rates as decimal fractions)
INSERT OR REPLACE INTO assumptions (id, assumption_set_id, assumption_key, numeric_value, text_value, unit) VALUES
  ('as-2627-ret-eq', 'as-fy-2026-27-v1', 'return_equity', '0.120000', 'Expected Return on Equity/MF', 'rate'),
  ('as-2627-ret-debt', 'as-fy-2026-27-v1', 'return_debt', '0.070000', 'Expected Return on Debt', 'rate'),
  ('as-2627-ret-gold', 'as-fy-2026-27-v1', 'return_gold', '0.080000', 'Expected Return on Gold', 'rate'),
  ('as-2627-ret-re', 'as-fy-2026-27-v1', 'return_real_estate', '0.080000', 'Expected Return on Real Estate', 'rate'),
  ('as-2627-ret-epf', 'as-fy-2026-27-v1', 'return_epf', '0.082500', 'Expected Return on EPF', 'rate'),
  ('as-2627-ret-fd', 'as-fy-2026-27-v1', 'return_fd', '0.065000', 'Expected Return on Fixed Deposits', 'rate'),
  ('as-2627-ret-cash', 'as-fy-2026-27-v1', 'return_cash', '0.035000', 'Expected Return on Savings/Cash', 'rate'),
  ('as-2627-ret-other', 'as-fy-2026-27-v1', 'return_other', '0.060000', 'Expected Return on Other Assets', 'rate');

-- Diagnostic Benchmarks & Rules of Thumb
INSERT OR REPLACE INTO assumptions (id, assumption_set_id, assumption_key, numeric_value, text_value, unit) VALUES
  ('as-2627-em-months', 'as-fy-2026-27-v1', 'emergency_fund_months', '6.00', 'Recommended Emergency Reserve in Months', 'months'),
  ('as-2627-term-mult', 'as-fy-2026-27-v1', 'term_cover_income_multiple', '15.00', 'Recommended Term Life Cover Multiple of Gross Income', 'multiple'),
  ('as-2627-max-dti', 'as-fy-2026-27-v1', 'debt_to_income_ratio_warning', '0.400000', 'Maximum Recommended EMI-to-Gross-Income Ratio', 'rate'),
  ('as-2627-life-exp', 'as-fy-2026-27-v1', 'default_life_expectancy', '85.00', 'Default Life Expectancy in Years', 'years'),
  ('as-2627-post-ret', 'as-fy-2026-27-v1', 'post_retirement_return', '0.070000', 'Expected Conservative Return During Retirement', 'rate');
