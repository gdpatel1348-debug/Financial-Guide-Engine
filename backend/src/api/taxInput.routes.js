import { Router } from 'express';
import { TaxInputController, taxInputSchema } from '../controllers/taxInput.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', TaxInputController.getTaxInput);
router.put('/', validateBody(taxInputSchema), TaxInputController.upsertTaxInput);

export default router;
