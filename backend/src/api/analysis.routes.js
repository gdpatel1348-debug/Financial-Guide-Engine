import { Router } from 'express';
import { AnalysisController } from '../controllers/analysis.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.post('/run', AnalysisController.runAnalysis);
router.post('/scenario', AnalysisController.runScenario);
router.get('/history', AnalysisController.getHistory);
router.get('/:planRunId', AnalysisController.getSnapshot);

export default router;
