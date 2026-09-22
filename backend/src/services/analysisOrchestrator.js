import { ProfileRepository } from '../repositories/profile.repository.js';
import { IncomeRepository } from '../repositories/income.repository.js';
import { TaxInputRepository } from '../repositories/taxInput.repository.js';
import { ExpenseRepository } from '../repositories/expense.repository.js';
import { AssetRepository } from '../repositories/asset.repository.js';
import { InsuranceRepository } from '../repositories/insurance.repository.js';
import { LiabilityRepository } from '../repositories/liability.repository.js';
import { GoalRepository } from '../repositories/goal.repository.js';
import { ConfigRepository } from '../repositories/config.repository.js';
import { MfRepository } from '../repositories/mf.repository.js';
import { PlanRunRepository } from '../repositories/planRun.repository.js';
import { calculatePlan, ENGINE_VERSION } from './engine/financialEngine.js';

export class AnalysisOrchestrator {
  static runForUser(userId, options = {}) {
    const fy = options.financialYear || '2026-27';

    // 1. Load User Data from Normalized Tables
    const profile = ProfileRepository.findByUserId(userId) || {};
    const income = IncomeRepository.findByUserIdAndFY(userId, fy) || {};
    const taxInputs = TaxInputRepository.findByUserIdAndFY(userId, fy) || {};
    const expenses = ExpenseRepository.findByUserIdAndFY(userId, fy) || {};
    const assets = AssetRepository.listByUserId(userId);
    const insurance = InsuranceRepository.listByUserId(userId);
    const liabilities = LiabilityRepository.listByUserId(userId);
    const goals = GoalRepository.listByUserId(userId);

    // Load MF holdings with underlying scheme holdings for overlap
    const userMfHoldings = MfRepository.listUserHoldings(userId);
    const mfFundsMap = new Map();
    for (const h of userMfHoldings) {
      if (!mfFundsMap.has(h.amfi_code)) {
        mfFundsMap.set(h.amfi_code, {
          amfiCode: h.amfi_code,
          schemeName: h.scheme_name,
          holdings: MfRepository.getSchemeHoldings(h.amfi_code)
        });
      }
    }
    const mfFunds = Array.from(mfFundsMap.values());

    // 2. Load Configuration
    const assumptionData = ConfigRepository.getActiveAssumptionSet(fy);
    if (!assumptionData) {
      throw new Error(`No active assumption set found for financial year ${fy}. Run seeds or db:setup.`);
    }

    const taxRuleSets = ConfigRepository.getTaxRuleSets(fy);
    if (!taxRuleSets.newRegime || !taxRuleSets.oldRegime) {
      throw new Error(`Incomplete tax slab sets for financial year ${fy}.`);
    }

    // 3. Map into clean serializable input DTO
    const inputSnapshot = {
      profile: {
        fullName: profile.full_name || '',
        displayName: profile.display_name || '',
        dateOfBirth: profile.date_of_birth || '',
        gender: profile.gender || '',
        maritalStatus: profile.marital_status || '',
        phoneNumber: profile.phone_number || '',
        city: profile.city || '',
        state: profile.state || '',
        cityTier: profile.city_tier || 'TIER_1',
        occupationType: profile.occupation_type || 'SALARIED',
        employerOrBusinessName: profile.employer_or_business_name || '',
        jobTitleOrBusinessType: profile.job_title_or_business_type || '',
        employmentStartYear: profile.employment_start_year || null,
        dependents: profile.dependents || 0,
        retirementAge: profile.retirement_age || 60,
        riskProfile: profile.risk_profile || 'MODERATE',
        monthlyExpense: profile.monthly_expense || '0.00',
        monthlyLifestyleExpenses: profile.monthly_lifestyle_expenses || '0.00'
      },
      income: {
        financialYear: fy,
        grossAnnual: income.gross_annual || '0.00',
        netAnnual: income.net_annual || null,
        monthlyGrossIncome: income.monthly_gross_income || null,
        monthlyNetIncome: income.monthly_net_income || null,
        otherIncome: income.other_income || '0.00',
        rentalIncome: income.rental_income || '0.00',
        businessIncome: income.business_income || '0.00',
        interestIncome: income.interest_income || '0.00',
        dividendIncome: income.dividend_income || '0.00',
        capitalGains: income.capital_gains || '0.00',
        eligibleDeductions: taxInputs.other_eligible_deductions || income.eligible_deductions || '0.00',
        regimeOpted: taxInputs.regime_opted || income.regime_opted || 'NEW'
      },
      taxInputs: {
        financialYear: fy,
        regimeOpted: taxInputs.regime_opted || income.regime_opted || 'NEW',
        standardDeduction: taxInputs.standard_deduction || '0.00',
        section80cDeductions: taxInputs.section_80c_deductions || '0.00',
        section80dDeductions: taxInputs.section_80d_deductions || '0.00',
        homeLoanInterestDeduction: taxInputs.home_loan_interest_deduction || '0.00',
        otherEligibleDeductions: taxInputs.other_eligible_deductions || '0.00',
        tdsPaid: taxInputs.tds_paid || '0.00',
        advanceTaxPaid: taxInputs.advance_tax_paid || '0.00',
        capitalGainsTaxable: taxInputs.capital_gains_taxable || '0.00',
        taxableIncomeDeclared: taxInputs.taxable_income_declared || null
      },
      expenses: {
        financialYear: fy,
        monthlyEssentialExpenses: expenses.monthly_essential_expenses || profile.monthly_expense || '0.00',
        monthlyLifestyleExpenses: expenses.monthly_lifestyle_expenses || profile.monthly_lifestyle_expenses || '0.00',
        monthlyEducationExpenses: expenses.monthly_education_expenses || '0.00',
        monthlyMedicalExpenses: expenses.monthly_medical_expenses || '0.00',
        monthlyDebtPayments: expenses.monthly_debt_payments || '0.00',
        monthlyOtherExpenses: expenses.monthly_other_expenses || '0.00'
      },
      assets: assets.map(a => ({
        id: a.id,
        assetType: a.asset_type,
        label: a.label,
        currentValue: a.current_value,
        annualContribution: a.annual_contribution,
        metadata: JSON.parse(a.metadata || '{}')
      })),
      insurance: insurance.map(p => ({
        id: p.id,
        policyType: p.policy_type,
        policyName: p.policy_name,
        insurer: p.insurer,
        sumAssured: p.sum_assured,
        annualPremium: p.annual_premium,
        maturityYear: p.maturity_year,
        policyStartYear: p.policy_start_year,
        isPureTerm: Boolean(p.is_pure_term),
        isActive: Boolean(p.is_active)
      })),
      liabilities: liabilities.map(l => ({
        id: l.id,
        loanType: l.loan_type,
        lenderName: l.lender_name,
        outstanding: l.outstanding,
        emi: l.emi,
        annualInterestRate: l.annual_interest_rate,
        tenureMonthsLeft: l.tenure_months_left,
        startYear: l.start_year
      })),
      goals: goals.map(g => ({
        id: g.id,
        goalType: g.goal_type,
        label: g.label,
        targetAmountToday: g.target_amount_today,
        targetYear: g.target_year,
        priority: g.priority,
        inflationKey: g.inflation_key,
        linkedAssetIds: typeof g.linked_asset_ids === 'string' ? JSON.parse(g.linked_asset_ids || '[]') : (g.linked_asset_ids || [])
      })),
      mfFunds,
      assumptions: assumptionData.assumptions,
      taxRuleSets,
      currentYear: new Date().getFullYear()
    };

    // 4. Run the pure calculation engine
    const outputSnapshot = calculatePlan(inputSnapshot);

    // 5. Persist immutable snapshot into plan_runs
    const planRun = PlanRunRepository.create(userId, {
      engineVersion: ENGINE_VERSION,
      financialYear: fy,
      assumptionSetId: assumptionData.set.id,
      taxSlabSetIds: [taxRuleSets.newRegime.id, taxRuleSets.oldRegime.id],
      inputSnapshot,
      outputSnapshot,
      warnings: outputSnapshot.warnings,
      sourceMetadata: {
        assumptionSetVersion: assumptionData.set.version,
        sourceNote: assumptionData.set.source_note,
        calculatedAt: outputSnapshot.calculatedAt
      }
    });

    return planRun;
  }

  /**
   * Runs a scenario simulation against the user's current data with temporary overrides.
   * Strictly ZERO database writes — does NOT persist to plan_runs or modify user profile.
   */
  static runScenarioForUser(userId, overrides = {}, options = {}) {
    const fy = options.financialYear || '2026-27';

    // 1. Load User Data
    const profile = ProfileRepository.findByUserId(userId) || {};
    const income = IncomeRepository.findByUserIdAndFY(userId, fy) || {};
    const taxInputs = TaxInputRepository.findByUserIdAndFY(userId, fy) || {};
    const expenses = ExpenseRepository.findByUserIdAndFY(userId, fy) || {};
    const assets = AssetRepository.listByUserId(userId);
    const insurance = InsuranceRepository.listByUserId(userId);
    const liabilities = LiabilityRepository.listByUserId(userId);
    const goals = GoalRepository.listByUserId(userId);

    const userMfHoldings = MfRepository.listUserHoldings(userId);
    const mfFundsMap = new Map();
    for (const h of userMfHoldings) {
      if (!mfFundsMap.has(h.amfi_code)) {
        mfFundsMap.set(h.amfi_code, {
          amfiCode: h.amfi_code,
          schemeName: h.scheme_name,
          holdings: MfRepository.getSchemeHoldings(h.amfi_code)
        });
      }
    }
    const mfFunds = Array.from(mfFundsMap.values());

    const assumptionData = ConfigRepository.getActiveAssumptionSet(fy);
    if (!assumptionData) {
      throw new Error(`No active assumption set found for financial year ${fy}.`);
    }

    const taxRuleSets = ConfigRepository.getTaxRuleSets(fy);

    // Deep-clone assumptions and apply overrides
    const scenarioAssumptions = { ...assumptionData.assumptions };
    if (overrides.inflationGeneral !== undefined && overrides.inflationGeneral !== null && overrides.inflationGeneral !== '') {
      scenarioAssumptions.inflation_general = String(Number(overrides.inflationGeneral) / (Number(overrides.inflationGeneral) > 1 ? 100 : 1));
    }
    if (overrides.returnEquity !== undefined && overrides.returnEquity !== null && overrides.returnEquity !== '') {
      scenarioAssumptions.return_equity = String(Number(overrides.returnEquity) / (Number(overrides.returnEquity) > 1 ? 100 : 1));
    }
    if (overrides.returnDebt !== undefined && overrides.returnDebt !== null && overrides.returnDebt !== '') {
      scenarioAssumptions.return_debt = String(Number(overrides.returnDebt) / (Number(overrides.returnDebt) > 1 ? 100 : 1));
    }
    if (overrides.postRetirementReturn !== undefined && overrides.postRetirementReturn !== null && overrides.postRetirementReturn !== '') {
      scenarioAssumptions.post_retirement_return = String(Number(overrides.postRetirementReturn) / (Number(overrides.postRetirementReturn) > 1 ? 100 : 1));
    }

    // Apply profile overrides
    const retirementAge = overrides.retirementAge !== undefined && overrides.retirementAge !== null && overrides.retirementAge !== ''
      ? Number(overrides.retirementAge)
      : (profile.retirement_age || 60);

    // Apply asset additional contributions if specified
    const monthlyExtraSip = Number(overrides.monthlyExtraSavings || 0);
    const modifiedAssets = assets.map(a => {
      const isGrowth = ['MF', 'EQUITY'].includes((a.asset_type || '').toUpperCase());
      const extraAnnual = isGrowth && monthlyExtraSip > 0 ? (monthlyExtraSip * 12) : 0;
      return {
        id: a.id,
        assetType: a.asset_type,
        label: a.label,
        currentValue: a.current_value,
        annualContribution: String(Number(a.annual_contribution || 0) + extraAnnual),
        metadata: JSON.parse(a.metadata || '{}')
      };
    });

    // Apply goals overrides if targetYearShift is specified
    const targetYearShift = Number(overrides.targetYearShift || 0);
    const modifiedGoals = goals.map(g => ({
      id: g.id,
      goalType: g.goal_type,
      label: g.label,
      targetAmountToday: g.target_amount_today,
      targetYear: Math.max(new Date().getFullYear() + 1, Number(g.target_year) + targetYearShift),
      priority: g.priority,
      inflationKey: g.inflation_key,
      linkedAssetIds: typeof g.linked_asset_ids === 'string' ? JSON.parse(g.linked_asset_ids || '[]') : (g.linked_asset_ids || [])
    }));

    const inputSnapshot = {
      profile: {
        fullName: profile.full_name || '',
        displayName: profile.display_name || '',
        dateOfBirth: profile.date_of_birth || '',
        gender: profile.gender || '',
        maritalStatus: profile.marital_status || '',
        phoneNumber: profile.phone_number || '',
        city: profile.city || '',
        state: profile.state || '',
        cityTier: profile.city_tier || 'TIER_1',
        occupationType: profile.occupation_type || 'SALARIED',
        employerOrBusinessName: profile.employer_or_business_name || '',
        jobTitleOrBusinessType: profile.job_title_or_business_type || '',
        employmentStartYear: profile.employment_start_year || null,
        dependents: profile.dependents || 0,
        retirementAge,
        riskProfile: profile.risk_profile || 'MODERATE',
        monthlyExpense: profile.monthly_expense || '0.00',
        monthlyLifestyleExpenses: profile.monthly_lifestyle_expenses || '0.00'
      },
      income: {
        financialYear: fy,
        grossAnnual: income.gross_annual || '0.00',
        netAnnual: income.net_annual || null,
        monthlyGrossIncome: income.monthly_gross_income || null,
        monthlyNetIncome: income.monthly_net_income || null,
        otherIncome: income.other_income || '0.00',
        rentalIncome: income.rental_income || '0.00',
        businessIncome: income.business_income || '0.00',
        interestIncome: income.interest_income || '0.00',
        dividendIncome: income.dividend_income || '0.00',
        capitalGains: income.capital_gains || '0.00',
        eligibleDeductions: taxInputs.other_eligible_deductions || income.eligible_deductions || '0.00',
        regimeOpted: taxInputs.regime_opted || income.regime_opted || 'NEW'
      },
      taxInputs: {
        financialYear: fy,
        regimeOpted: taxInputs.regime_opted || income.regime_opted || 'NEW',
        standardDeduction: taxInputs.standard_deduction || '0.00',
        section80cDeductions: taxInputs.section_80c_deductions || '0.00',
        section80dDeductions: taxInputs.section_80d_deductions || '0.00',
        homeLoanInterestDeduction: taxInputs.home_loan_interest_deduction || '0.00',
        otherEligibleDeductions: taxInputs.other_eligible_deductions || '0.00',
        tdsPaid: taxInputs.tds_paid || '0.00',
        advanceTaxPaid: taxInputs.advance_tax_paid || '0.00',
        capitalGainsTaxable: taxInputs.capital_gains_taxable || '0.00',
        taxableIncomeDeclared: taxInputs.taxable_income_declared || null
      },
      expenses: {
        financialYear: fy,
        monthlyEssentialExpenses: expenses.monthly_essential_expenses || profile.monthly_expense || '0.00',
        monthlyLifestyleExpenses: expenses.monthly_lifestyle_expenses || profile.monthly_lifestyle_expenses || '0.00',
        monthlyEducationExpenses: expenses.monthly_education_expenses || '0.00',
        monthlyMedicalExpenses: expenses.monthly_medical_expenses || '0.00',
        monthlyDebtPayments: expenses.monthly_debt_payments || '0.00',
        monthlyOtherExpenses: expenses.monthly_other_expenses || '0.00'
      },
      assets: modifiedAssets,
      insurance: insurance.map(p => ({
        id: p.id,
        policyType: p.policy_type,
        policyName: p.policy_name,
        insurer: p.insurer,
        sumAssured: p.sum_assured,
        annualPremium: p.annual_premium,
        maturityYear: p.maturity_year,
        policyStartYear: p.policy_start_year,
        isPureTerm: Boolean(p.is_pure_term),
        isActive: Boolean(p.is_active)
      })),
      liabilities: liabilities.map(l => ({
        id: l.id,
        loanType: l.loan_type,
        lenderName: l.lender_name,
        outstanding: l.outstanding,
        emi: l.emi,
        annualInterestRate: l.annual_interest_rate,
        tenureMonthsLeft: l.tenure_months_left,
        startYear: l.start_year
      })),
      goals: modifiedGoals,
      mfFunds,
      assumptions: scenarioAssumptions,
      taxRuleSets,
      currentYear: new Date().getFullYear()
    };

    const outputSnapshot = calculatePlan(inputSnapshot);

    return {
      isScenarioEstimate: true,
      appliedOverrides: {
        retirementAge,
        inflationGeneral: scenarioAssumptions.inflation_general,
        returnEquity: scenarioAssumptions.return_equity,
        returnDebt: scenarioAssumptions.return_debt,
        postRetirementReturn: scenarioAssumptions.post_retirement_return,
        monthlyExtraSavings: monthlyExtraSip,
        targetYearShift
      },
      outputSnapshot,
      assumptionsUsed: scenarioAssumptions
    };
  }
}
