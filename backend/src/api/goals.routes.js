import { Router } from 'express';
import { FinancialController, goalSchema } from '../controllers/financial.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', FinancialController.listGoals);
router.post('/', validateBody(goalSchema), FinancialController.createGoal);
router.put('/:id', validateBody(goalSchema), FinancialController.updateGoal);
router.delete('/:id', FinancialController.deleteGoal);

export default router;
