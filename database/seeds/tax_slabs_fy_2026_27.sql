-- Seed: tax_slabs_fy_2026_27.sql
-- Financial Year 2026-27 Tax Slabs and Rules
-- Status: DRAFT (Development and local prototype; must be reviewed against official gazette notification before production use)
-- Source: Income Tax Department of India, Finance (No. 2) Act 2024 slab framework for FY 2025-26/2026-27.

-- 1. NEW REGIME (Section 115BAC)
INSERT OR REPLACE INTO tax_slab_sets (
  id,
  financial_year,
  regime,
  standard_deduction,
  rebate_limit,
  rebate_amount,
  cess_rate,
  source_note,
  version,
  created_at
) VALUES (
  'tax-set-2627-new-v1',
  '2026-27',
  'NEW',
  '75000.00',
  '700000.00',
  '25000.00',
  '0.040000',
  'FY 2026-27 New Tax Regime (Finance Act framework, standard deduction Rs. 75,000, 87A rebate up to Rs. 7,00,000 taxable income). DRAFT status.',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- New Regime Slabs
INSERT OR REPLACE INTO tax_slabs (id, tax_slab_set_id, slab_from, slab_to, rate) VALUES
  ('ts-2627-new-1', 'tax-set-2627-new-v1', '0.00', '300000.00', '0.000000'),
  ('ts-2627-new-2', 'tax-set-2627-new-v1', '300000.00', '700000.00', '0.050000'),
  ('ts-2627-new-3', 'tax-set-2627-new-v1', '700000.00', '1000000.00', '0.100000'),
  ('ts-2627-new-4', 'tax-set-2627-new-v1', '1000000.00', '1200000.00', '0.150000'),
  ('ts-2627-new-5', 'tax-set-2627-new-v1', '1200000.00', '1500000.00', '0.200000'),
  ('ts-2627-new-6', 'tax-set-2627-new-v1', '1500000.00', NULL, '0.300000');

-- 2. OLD REGIME
INSERT OR REPLACE INTO tax_slab_sets (
  id,
  financial_year,
  regime,
  standard_deduction,
  rebate_limit,
  rebate_amount,
  cess_rate,
  source_note,
  version,
  created_at
) VALUES (
  'tax-set-2627-old-v1',
  '2026-27',
  'OLD',
  '50000.00',
  '500000.00',
  '12500.00',
  '0.040000',
  'FY 2026-27 Old Tax Regime (Standard deduction Rs. 50,000, 87A rebate up to Rs. 5,00,000 taxable income, Chapter VI-A deductions eligible). DRAFT status.',
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
);

-- Old Regime Slabs
INSERT OR REPLACE INTO tax_slabs (id, tax_slab_set_id, slab_from, slab_to, rate) VALUES
  ('ts-2627-old-1', 'tax-set-2627-old-v1', '0.00', '250000.00', '0.000000'),
  ('ts-2627-old-2', 'tax-set-2627-old-v1', '250000.00', '500000.00', '0.050000'),
  ('ts-2627-old-3', 'tax-set-2627-old-v1', '500000.00', '1000000.00', '0.200000'),
  ('ts-2627-old-4', 'tax-set-2627-old-v1', '1000000.00', NULL, '0.300000');
