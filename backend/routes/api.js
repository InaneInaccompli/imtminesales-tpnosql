import { Router } from 'express';
import * as mainController from '../controllers/mainController.js';

const router = Router();

router.get('/import/progress', mainController.importDataSSE);
router.post('/import', mainController.importData);
router.post('/products/recommended', mainController.getRecommendedProducts);
router.post('/products/adoption', mainController.getProductAdoptionDepth);
router.post('/products/viral-network', mainController.getViralNetwork);

// Routes pour les résultats sauvegardés (SQLite)
router.get('/results', mainController.getSavedResults);
router.delete('/results', mainController.deleteAllResults);

export default router;
