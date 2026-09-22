import { Router } from 'express';
import { FinancialController, assetSchema } from '../controllers/financial.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', FinancialController.listAssets);
router.get('/:id', FinancialController.getAsset);
router.post('/', validateBody(assetSchema), FinancialController.createAsset);
router.put('/:id', validateBody(assetSchema), FinancialController.updateAsset);
router.delete('/:id', FinancialController.deleteAsset);

export default router;
