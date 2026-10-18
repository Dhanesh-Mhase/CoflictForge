import { Router } from 'express';
import repositoryController from '../controllers/repository.controller.js';
import pullRequestRoutes from './pull-request.routes.js';
import { verifyAuth } from '../middlewares/verify.middleware.js';

const router = Router();

router.use(verifyAuth);

router.post('/', repositoryController.create);
router.get('/', repositoryController.list);
router.get('/:repositoryId', repositoryController.getById);

router.use('/:repositoryId/pull-requests', pullRequestRoutes);

export default router;
