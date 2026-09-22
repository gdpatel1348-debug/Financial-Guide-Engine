import { z } from 'zod';
import { MfRepository } from '../repositories/mf.repository.js';
import { analyzePortfolioOverlap } from '../services/engine/mfOverlapEngine.js';

export const mfHoldingSchema = z.object({
  assetId: z.string().min(1, 'Linked asset ID is required.'),
  amfiCode: z.string().min(1, 'AMFI code is required.'),
  units: z.union([z.string(), z.number()]),
  averageCost: z.union([z.string(), z.number()]).default('0.000000')
});

export class MfController {
  static searchSchemes(req, res, next) {
    try {
      const q = req.query.search || '';
      const limit = parseInt(req.query.limit || '20', 10);
      const schemes = MfRepository.searchSchemes(q, limit);
      return res.json({ data: schemes, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static getScheme(req, res, next) {
    try {
      const scheme = MfRepository.getScheme(req.params.amfiCode);
      if (!scheme) {
        return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Scheme not found.' }, meta: { requestId: req.id } });
      }
      const holdings = MfRepository.getSchemeHoldings(req.params.amfiCode);
      return res.json({ data: { ...scheme, holdings }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static listHoldings(req, res, next) {
    try {
      const holdings = MfRepository.listUserHoldings(req.user.id);
      return res.json({ data: holdings, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static upsertHolding(req, res, next) {
    try {
      const id = MfRepository.upsertHolding(req.user.id, req.body);
      return res.status(201).json({ data: { id, success: true }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static deleteHolding(req, res, next) {
    try {
      const ok = MfRepository.deleteHolding(req.params.id, req.user.id);
      if (!ok) return res.status(404).json({ data: null, error: { code: 'NOT_FOUND', message: 'Holding not found.' }, meta: { requestId: req.id } });
      return res.json({ data: { success: true }, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }

  static getOverlap(req, res, next) {
    try {
      const userHoldings = MfRepository.listUserHoldings(req.user.id);
      // Group unique amfiCodes
      const codeMap = new Map();
      for (const h of userHoldings) {
        if (!codeMap.has(h.amfi_code)) {
          codeMap.set(h.amfi_code, {
            amfiCode: h.amfi_code,
            schemeName: h.scheme_name,
            holdings: MfRepository.getSchemeHoldings(h.amfi_code)
          });
        }
      }

      const funds = Array.from(codeMap.values());
      const overlapReport = analyzePortfolioOverlap(funds);

      return res.json({ data: overlapReport, error: null, meta: { requestId: req.id } });
    } catch (err) { next(err); }
  }
}
