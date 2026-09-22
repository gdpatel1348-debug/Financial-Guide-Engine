import { z } from 'zod';
import { ProfileRepository } from '../repositories/profile.repository.js';
import { IncomeRepository } from '../repositories/income.repository.js';
import { AssetRepository } from '../repositories/asset.repository.js';
import { InsuranceRepository } from '../repositories/insurance.repository.js';
import { LiabilityRepository } from '../repositories/liability.repository.js';
import { GoalRepository } from '../repositories/goal.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';

// --- Zod Validation Schemas ---

export const profileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.').max(150),
  displayName: z.string().max(100).optional(),
  dateOfBirth: z.string().transform(val => {
    const s = String(val).trim();
    const ddmmyyyy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (ddmmyyyy) {
      return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
    }
    return s;
  }).pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must use YYYY-MM-DD format.')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY', '']).optional(),
  maritalStatus: z.enum(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED', '']).optional(),
  phoneNumber: z.string().max(30).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  dependents: z.number().int().min(0).default(0),
  retirementAge: z.number().int().min(40).max(90).default(60),
  riskProfile: z.enum(['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']).default('MODERATE'),
  cityTier: z.enum(['TIER_1', 'TIER_2', 'TIER_3']).default('TIER_1'),
  occupationType: z.enum(['SALARIED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'PROFESSIONAL', 'RETIRED', 'STUDENT', 'HOMEMAKER', 'OTHER', '']).optional(),
  employerOrBusinessName: z.string().max(150).optional(),
  jobTitleOrBusinessType: z.string().max(150).optional(),
  employmentStartYear: z.number().int().optional(),
  monthlyExpense: z.union([z.string(), z.number()]).optional(),
  monthlyLifestyleExpenses: z.union([z.string(), z.number()]).optional()
});

export const incomeSchema = z.object({
  financialYear: z.string().default('2026-27'),
  grossAnnual: z.union([z.string(), z.number()]),
  netAnnual: z.union([z.string(), z.number()]).optional(),
  monthlyGrossIncome: z.union([z.string(), z.number()]).optional(),
  monthlyNetIncome: z.union([z.string(), z.number()]).optional(),
  otherIncome: z.union([z.string(), z.number()]).default('0.00'),
  rentalIncome: z.union([z.string(), z.number()]).default('0.00'),
  businessIncome: z.union([z.string(), z.number()]).default('0.00'),
  interestIncome: z.union([z.string(), z.number()]).default('0.00'),
  dividendIncome: z.union([z.string(), z.number()]).default('0.00'),
  capitalGains: z.union([z.string(), z.number()]).default('0.00'),
  eligibleDeductions: z.union([z.string(), z.number()]).default('0.00'),
  regimeOpted: z.enum(['OLD', 'NEW']).default('NEW')
});

export const assetSchema = z.object({
  assetType: z.enum(['MF', 'EQUITY', 'DEBT', 'REAL_ESTATE', 'GOLD', 'EPF', 'FD', 'CASH', 'PPF', 'NPS', 'OTHER']),
  label: z.string().max(100).optional(),
  currentValue: z.union([z.string(), z.number()]),
  annualContribution: z.union([z.string(), z.number()]).default('0.00'),
  metadata: z.record(z.any()).default({})
});

export const insuranceSchema = z.object({
  policyType: z.enum(['TERM', 'HEALTH', 'ULIP', 'ENDOWMENT', 'OTHER']),
  insurer: z.string().max(100).optional(),
  policyName: z.string().max(150).optional(),
  sumAssured: z.union([z.string(), z.number()]).default('0.00'),
  annualPremium: z.union([z.string(), z.number()]).default('0.00'),
  maturityYear: z.number().int().optional(),
  policyStartYear: z.number().int().optional(),
  isPureTerm: z.boolean().default(true),
  isActive: z.boolean().default(true),
  metadata: z.record(z.any()).default({})
});

export const liabilitySchema = z.object({
  loanType: z.string().min(1, 'Loan type is required.').max(100),
  lenderName: z.string().max(150).optional(),
  outstanding: z.union([z.string(), z.number()]),
  emi: z.union([z.string(), z.number()]).default('0.00'),
  annualInterestRate: z.union([z.string(), z.number()]).default('0.000000'),
  tenureMonthsLeft: z.number().int().min(0).default(0),
  startYear: z.number().int().optional()
});

export const goalSchema = z.object({
  goalType: z.string().min(1, 'Goal type is required.').max(100),
  label: z.string().max(150).optional(),
  targetAmountToday: z.union([z.string(), z.number()]),
  targetYear: z.number().int().min(new Date().getFullYear(), 'Target year must be the current year or later.'),
  priority: z.number().int().min(1).default(100),
  inflationKey: z.string().default('inflation_general'),
  linkedAssetIds: z.array(z.string()).default([])
});

// --- Controller Handlers ---

export class FinancialController {
  // Profile
  static getProfile(req, res, next) {
    try {
      const profile = ProfileRepository.findByUserId(req.user.id);
      return res.json({ data: profile, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static upsertProfile(req, res, next) {
    try {
      const profile = ProfileRepository.upsert(req.user.id, req.body);
      AuditRepository.record({ userId: req.user.id, eventType: 'PROFILE_UPDATED', requestId: req.id });
      return res.json({ data: profile, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  // Income
  static getIncome(req, res, next) {
    try {
      const fy = req.query.financialYear || '2026-27';
      const income = IncomeRepository.findByUserIdAndFY(req.user.id, fy);
      return res.json({ data: income, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static upsertIncome(req, res, next) {
    try {
      const income = IncomeRepository.upsert(req.user.id, req.body);
      AuditRepository.record({ userId: req.user.id, eventType: 'INCOME_UPDATED', requestId: req.id });
      return res.json({ data: income, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  // Assets
  static listAssets(req, res, next) {
    try {
      const assets = AssetRepository.listByUserId(req.user.id);
      return res.json({ data: assets, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static getAsset(req, res, next) {
    try {
      const asset = AssetRepository.findByIdAndUserId(req.params.id, req.user.id);
      if (!asset) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Asset not found.' }, meta: { requestId: req.id } });
      return res.json({ data: asset, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static createAsset(req, res, next) {
    try {
      const asset = AssetRepository.create(req.user.id, req.body);
      return res.status(201).json({ data: asset, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static updateAsset(req, res, next) {
    try {
      const asset = AssetRepository.update(req.params.id, req.user.id, req.body);
      if (!asset) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Asset not found.' }, meta: { requestId: req.id } });
      return res.json({ data: asset, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static deleteAsset(req, res, next) {
    try {
      const ok = AssetRepository.delete(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Asset not found.' }, meta: { requestId: req.id } });
      return res.json({ data: { success: true }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  // Insurance
  static listInsurance(req, res, next) {
    try {
      const policies = InsuranceRepository.listByUserId(req.user.id);
      return res.json({ data: policies, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static createInsurance(req, res, next) {
    try {
      const policy = InsuranceRepository.create(req.user.id, req.body);
      return res.status(201).json({ data: policy, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static updateInsurance(req, res, next) {
    try {
      const policy = InsuranceRepository.update(req.params.id, req.user.id, req.body);
      if (!policy) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Policy not found.' }, meta: { requestId: req.id } });
      return res.json({ data: policy, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static deleteInsurance(req, res, next) {
    try {
      const ok = InsuranceRepository.delete(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Policy not found.' }, meta: { requestId: req.id } });
      return res.json({ data: { success: true }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  // Liabilities
  static listLiabilities(req, res, next) {
    try {
      const loans = LiabilityRepository.listByUserId(req.user.id);
      return res.json({ data: loans, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static createLiability(req, res, next) {
    try {
      const loan = LiabilityRepository.create(req.user.id, req.body);
      return res.status(201).json({ data: loan, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static updateLiability(req, res, next) {
    try {
      const loan = LiabilityRepository.update(req.params.id, req.user.id, req.body);
      if (!loan) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Liability not found.' }, meta: { requestId: req.id } });
      return res.json({ data: loan, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static deleteLiability(req, res, next) {
    try {
      const ok = LiabilityRepository.delete(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Liability not found.' }, meta: { requestId: req.id } });
      return res.json({ data: { success: true }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  // Goals
  static listGoals(req, res, next) {
    try {
      const goals = GoalRepository.listByUserId(req.user.id);
      return res.json({ data: goals, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static createGoal(req, res, next) {
    try {
      const goal = GoalRepository.create(req.user.id, req.body);
      return res.status(201).json({ data: goal, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static updateGoal(req, res, next) {
    try {
      const goal = GoalRepository.update(req.params.id, req.user.id, req.body);
      if (!goal) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Goal not found.' }, meta: { requestId: req.id } });
      return res.json({ data: goal, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static deleteGoal(req, res, next) {
    try {
      const ok = GoalRepository.delete(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Goal not found.' }, meta: { requestId: req.id } });
      return res.json({ data: { success: true }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }
}
