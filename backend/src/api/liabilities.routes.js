import { Router } from 'express';
import { FinancialController, liabilitySchema } from '../controllers/financial.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', FinancialController.listLiabilities);
router.post('/', validateBody(liabilitySchema), FinancialController.createLiability);
router.put('/:id', validateBody(liabilitySchema), FinancialController.updateLiability);
router.delete('/:id', FinancialController.deleteLiability);

export default router;
