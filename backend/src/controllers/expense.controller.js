import { z } from 'zod';
import { ExpenseRepository } from '../repositories/expense.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';

export const expenseSchema = z.object({
  financialYear: z.string().default('2026-27'),
  monthlyEssentialExpenses: z.union([z.string(), z.number()]).default('0.00'),
  monthlyLifestyleExpenses: z.union([z.string(), z.number()]).default('0.00'),
  monthlyEducationExpenses: z.union([z.string(), z.number()]).default('0.00'),
  monthlyMedicalExpenses: z.union([z.string(), z.number()]).default('0.00'),
  monthlyDebtPayments: z.union([z.string(), z.number()]).default('0.00'),
  monthlyOtherExpenses: z.union([z.string(), z.number()]).default('0.00')
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
