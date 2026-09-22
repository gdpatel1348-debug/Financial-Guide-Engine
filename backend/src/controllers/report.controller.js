import { PlanRunRepository } from '../repositories/planRun.repository.js';
import { ProfileRepository } from '../repositories/profile.repository.js';
import { ReportService } from '../services/reportService.js';
import { AuditRepository } from '../repositories/audit.repository.js';

export class ReportController {
  static async getPdf(req, res, next) {
    try {
      const planRun = PlanRunRepository.findByIdAndUserId(req.params.planRunId, req.user.id);
      if (!planRun) {
        return res.status(404).json({
          data: null,
          error: { code: 'NOT_FOUND', message: 'Plan run not found.' },
          meta: { requestId: req.id }
        });
      }

      const profile = ProfileRepository.findByUserId(req.user.id);

      AuditRepository.record({
        userId: req.user.id,
        eventType: 'REPORT_EXPORT_PDF',
        resourceType: 'plan_runs',
        resourceId: planRun.id,
        requestId: req.id
      });

      const { buffer, type } = await ReportService.renderPdf(planRun, profile);

      if (type === 'application/pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="financial_plan_${planRun.id.slice(0, 8)}.pdf"`);
      } else {
        res.setHeader('Content-Type', 'text/html');
      }

      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
}
