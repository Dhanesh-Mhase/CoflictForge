import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { verifyAuth } from '../middlewares/verify.middleware.js';

const router = Router();

router.post('/signin', authController.signin);
router.post('/refresh', authController.refresh);
router.post('/signout', authController.signout);

router.get('/me', verifyAuth, authController.me);

export default router;
