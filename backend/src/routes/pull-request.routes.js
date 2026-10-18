import { Router } from 'express';
import pullRequestController from '../controllers/pull-request.controller.js';
import analysisRoutes from './analysis.routes.js';
import { verifyAuth } from '../middlewares/verify.middleware.js';

const router = Router({ mergeParams: true });

router.use(verifyAuth);

router.get('/', pullRequestController.list);
router.get('/:prNumber', pullRequestController.getByNumber);

router.use('/:prNumber', analysisRoutes);

export default router;
