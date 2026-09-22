import { z } from 'zod';
import { TaxInputRepository } from '../repositories/taxInput.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';

export const taxInputSchema = z.object({
  financialYear: z.string().default('2026-27'),
  regimeOpted: z.enum(['OLD', 'NEW']).default('NEW'),
  standardDeduction: z.union([z.string(), z.number()]).default('0.00'),
  section80cDeductions: z.union([z.string(), z.number()]).default('0.00'),
  section80dDeductions: z.union([z.string(), z.number()]).default('0.00'),
  homeLoanInterestDeduction: z.union([z.string(), z.number()]).default('0.00'),
  otherEligibleDeductions: z.union([z.string(), z.number()]).default('0.00'),
  tdsPaid: z.union([z.string(), z.number()]).default('0.00'),
  advanceTaxPaid: z.union([z.string(), z.number()]).default('0.00'),
  capitalGainsTaxable: z.union([z.string(), z.number()]).default('0.00'),
  taxableIncomeDeclared: z.union([z.string(), z.number()]).optional()
});

export class TaxInputController {
  static getTaxInput(req, res, next) {
    try {
      const fy = req.query.financialYear || '2026-27';
      const taxInput = TaxInputRepository.findByUserIdAndFY(req.user.id, fy);
      return res.json({ data: taxInput, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static upsertTaxInput(req, res, next) {
    try {
      const taxInput = TaxInputRepository.upsert(req.user.id, req.body);
      AuditRepository.record({ userId: req.user.id, eventType: 'TAX_INPUTS_UPDATED', requestId: req.id });
      return res.json({ data: taxInput, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }
}
