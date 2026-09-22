import { AnalysisOrchestrator } from '../services/analysisOrchestrator.js';
import { PlanRunRepository } from '../repositories/planRun.repository.js';
import { AuditRepository } from '../repositories/audit.repository.js';

export class AnalysisController {
  static runAnalysis(req, res, next) {
    try {
      const planRun = AnalysisOrchestrator.runForUser(req.user.id, req.body || {});

      AuditRepository.record({
        userId: req.user.id,
        eventType: 'PLAN_ANALYSIS_RUN',
        resourceType: 'plan_runs',
        resourceId: planRun.id,
        requestId: req.id
      });

      return res.status(201).json({
        data: {
          planRun: {
            id: planRun.id,
            runAt: planRun.runAt,
            engineVersion: planRun.engineVersion,
            financialYear: planRun.financialYear
          },
          dataCompletenessSummary: planRun.outputSnapshot.dataCompletenessSummary,
          financialSnapshot: planRun.outputSnapshot.financialSnapshot,
          recommendedNextActions: planRun.outputSnapshot.recommendedNextActions,
          summary: planRun.outputSnapshot.summary,
          assetAllocation: planRun.outputSnapshot.assetAllocation,
          taxComparison: planRun.outputSnapshot.taxComparison,
          goals: planRun.outputSnapshot.goals,
          diagnostics: planRun.outputSnapshot.diagnostics,
          mfOverlap: planRun.outputSnapshot.mfOverlap,
          assumptionsUsed: planRun.outputSnapshot.assumptionsUsed,
          warnings: planRun.warnings
        },
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }

  static getHistory(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const history = PlanRunRepository.listByUserId(req.user.id, limit);
      return res.json({ data: history, error: null, meta: { requestId: req.id } });
    } catch (err) {
      next(err);
    }
  }

  static getSnapshot(req, res, next) {
    try {
      const planRun = PlanRunRepository.findByIdAndUserId(req.params.planRunId, req.user.id);
      if (!planRun) {
        return res.status(404).json({
          data: null,
          error: { code: 'NOT_FOUND', message: 'Plan snapshot not found.' },
          meta: { requestId: req.id }
        });
      }

      return res.json({
        data: {
          planRun: {
            id: planRun.id,
            runAt: planRun.runAt,
            engineVersion: planRun.engineVersion,
            financialYear: planRun.financialYear
          },
          dataCompletenessSummary: planRun.outputSnapshot.dataCompletenessSummary,
          financialSnapshot: planRun.outputSnapshot.financialSnapshot,
          recommendedNextActions: planRun.outputSnapshot.recommendedNextActions,
          summary: planRun.outputSnapshot.summary,
          assetAllocation: planRun.outputSnapshot.assetAllocation,
          taxComparison: planRun.outputSnapshot.taxComparison,
          goals: planRun.outputSnapshot.goals,
          diagnostics: planRun.outputSnapshot.diagnostics,
          mfOverlap: planRun.outputSnapshot.mfOverlap,
          assumptionsUsed: planRun.outputSnapshot.assumptionsUsed,
          warnings: planRun.warnings,
          inputSnapshot: planRun.inputSnapshot
        },
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }

  static runScenario(req, res, next) {
    try {
      const scenarioResult = AnalysisOrchestrator.runScenarioForUser(req.user.id, req.body?.overrides || {}, req.body?.options || {});
      return res.json({
        data: scenarioResult,
        error: null,
        meta: { requestId: req.id }
      });
    } catch (err) {
      next(err);
    }
  }
}
