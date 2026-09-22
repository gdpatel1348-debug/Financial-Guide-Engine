import { Router } from 'express';
import { ExpenseController, expenseSchema } from '../controllers/expense.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', ExpenseController.getExpenses);
router.put('/', validateBody(expenseSchema), ExpenseController.upsertExpenses);

export default router;
