import { Router } from 'express';
import { FinancialController, profileSchema } from '../controllers/financial.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', FinancialController.getProfile);
router.put('/', validateBody(profileSchema), FinancialController.upsertProfile);

export default router;
