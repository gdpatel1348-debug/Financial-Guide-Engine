import { Router } from 'express';
import { FinancialController, insuranceSchema } from '../controllers/financial.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', FinancialController.listInsurance);
router.post('/', validateBody(insuranceSchema), FinancialController.createInsurance);
router.put('/:id', validateBody(insuranceSchema), FinancialController.updateInsurance);
router.delete('/:id', FinancialController.deleteInsurance);

export default router;
