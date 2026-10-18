import { Router } from 'express';
import chatController from '../controllers/chat.controller.js';
import { verifyAuth } from '../middlewares/verify.middleware.js';

const router = Router({ mergeParams: true });

router.use(verifyAuth);

router.post('/:conflictId/chat', chatController.ask);

export default router;
