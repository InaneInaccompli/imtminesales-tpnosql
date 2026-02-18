import { Router } from 'express';
const router = Router();
import * as mainController from '../controllers/mainController.js';

router.post('/import', mainController.importData);
router.post('/products/recommended', mainController.getRecommendedProducts);
router.post('/products/adoption', mainController.getProductAdoptionDepth);
router.post('/products/viral-score', mainController.getProductViralScore);

export default router;
