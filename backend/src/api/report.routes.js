import { Router } from 'express';
import { ReportController } from '../controllers/report.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/:planRunId/pdf', ReportController.getPdf);

export default router;
