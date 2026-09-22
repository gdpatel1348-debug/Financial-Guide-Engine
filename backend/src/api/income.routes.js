import { Router } from 'express';
import { FinancialController, incomeSchema } from '../controllers/financial.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', FinancialController.getIncome);
router.put('/', validateBody(incomeSchema), FinancialController.upsertIncome);

export default router;
