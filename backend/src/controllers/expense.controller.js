import { z } from 'zod';
import { ExpenseRepository } from '../repositories/expense.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';

export const expenseSchema = z.object({
  financialYear: z.string().default('2026-27'),
  financial_year: z.string().optional(),
  monthlyEssentialExpenses: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_essential_expenses: z.union([z.string(), z.number()]).optional(),
  monthlyLifestyleExpenses: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_lifestyle_expenses: z.union([z.string(), z.number()]).optional(),
  monthlyEducationExpenses: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_education_expenses: z.union([z.string(), z.number()]).optional(),
  monthlyMedicalExpenses: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_medical_expenses: z.union([z.string(), z.number()]).optional(),
  monthlyDebtPayments: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_debt_payments: z.union([z.string(), z.number()]).optional(),
  monthlyInsurancePremiums: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_insurance_premiums: z.union([z.string(), z.number()]).optional(),
  monthlyOtherExpenses: z.union([z.string(), z.number()]).optional().default('0.00'),
  monthly_other_expenses: z.union([z.string(), z.number()]).optional()
});

export class ExpenseController {
  static getExpenses(req, res, next) {
    try {
      const fy = req.query.financialYear || '2026-27';
      const expenses = ExpenseRepository.findByUserIdAndFY(req.user.id, fy);
      return res.json({ data: expenses, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static upsertExpenses(req, res, next) {
    try {
      const expenses = ExpenseRepository.upsert(req.user.id, req.body);
      AuditRepository.record({ userId: req.user.id, eventType: 'EXPENSES_UPDATED', requestId: req.id });
      return res.json({ data: expenses, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }
}
