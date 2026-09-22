import { Router } from 'express';
import { MfController, mfHoldingSchema } from '../controllers/mf.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/error.middleware.js';

const router = Router();
router.use(requireAuth);

router.get('/schemes', MfController.searchSchemes);
router.get('/schemes/:amfiCode', MfController.getScheme);
router.get('/holdings', MfController.listHoldings);
router.post('/holdings', validateBody(mfHoldingSchema), MfController.upsertHolding);
router.delete('/holdings/:id', MfController.deleteHolding);
router.get('/overlap', MfController.getOverlap);

export default router;
