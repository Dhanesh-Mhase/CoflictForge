import { Router } from 'express';
import { sandboxController } from '../controllers/sandbox.controller.js';
import { verifyAuth } from '../middlewares/verify.middleware.js';

const router = Router();

// All sandbox routes require authentication
router.use(verifyAuth);

// Provision a new sandbox
router.post('/provision', sandboxController.provision);

// Get sandbox status
router.get('/:sandboxId/status', sandboxController.getStatus);

// Stream live logs (SSE)
router.get('/:sandboxId/logs', sandboxController.streamLogs);

// Push resolved files to GitHub PR branch
router.post('/:sandboxId/push', sandboxController.pushResolution);

// Teardown container
router.delete('/:sandboxId', sandboxController.teardown);

export default router;
