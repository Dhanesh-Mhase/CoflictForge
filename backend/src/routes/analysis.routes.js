import { Router } from 'express';
import analysisController from '../controllers/analysis.controller.js';
import chatRoutes from './chat.routes.js';
import { verifyAuth } from '../middlewares/verify.middleware.js';

const router = Router({ mergeParams: true });

router.use(verifyAuth);

router.post('/analyze', analysisController.trigger);
router.get('/conflicts', analysisController.getConflicts);
router.get('/source', analysisController.getSource);

router.use('/conflicts', chatRoutes);

export default router;
