import sandboxService from '../services/sandbox.service.js';

export const sandboxController = {
  /**
   * POST /api/sandbox/provision
   * Body: { repositoryId, prNumber, resolvedFiles, conflictId? }
   */
  async provision(req, res, next) {
    try {
      const userId = req.user.id;
      const { repositoryId, prNumber, resolvedFiles, conflictId } = req.body;

      if (!repositoryId || !prNumber) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_PARAMS', message: 'repositoryId and prNumber are required.' },
        });
      }

      console.log('[SandboxController.provision] resolvedFiles keys:', Object.keys(resolvedFiles || {}));
      for (const [k, v] of Object.entries(resolvedFiles || {})) {
        console.log(`[SandboxController.provision] File: ${k}, Content preview:`, (v || '').slice(0, 100));
      }

      const sandbox = await sandboxService.provision(
        userId,
        repositoryId,
        prNumber,
        resolvedFiles || {},
        conflictId
      );

      return res.status(201).json({ success: true, data: sandbox });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/sandbox/:sandboxId/status
   */
  async getStatus(req, res, next) {
    try {
      const sandbox = await sandboxService.getSandbox(req.user.id, req.params.sandboxId);
      return res.json({ success: true, data: sandbox });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/sandbox/:sandboxId/logs  (SSE)
   * Streams real-time test output as Server-Sent Events.
   */
  async streamLogs(req, res, next) {
    try {
      const { sandboxId } = req.params;

      // Verify user access
      const sandbox = await sandboxService.getSandbox(req.user.id, sandboxId);

      // If already completed, stream the stored output and close
      if (['PASSED', 'FAILED', 'TIMED_OUT', 'ERROR', 'TORN_DOWN'].includes(sandbox.status)) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        if (sandbox.testOutput) {
          res.write(`data: ${JSON.stringify({ text: sandbox.testOutput })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ status: sandbox.status })}\n\n`);
        res.end();
        return;
      }

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      // Subscribe to live log chunks
      const unsubscribe = sandboxService.addLogSubscriber(sandboxId, (text) => {
        // Check for status sentinel
        const statusMatch = text.match(/__SANDBOX_STATUS__:(\w+)/);
        if (statusMatch) {
          res.write(`data: ${JSON.stringify({ status: statusMatch[1] })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      });

      // Clean up when client disconnects
      req.on('close', () => {
        unsubscribe();
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/sandbox/:sandboxId/push
   * Push resolved files to the PR branch.
   */
  async pushResolution(req, res, next) {
    try {
      const result = await sandboxService.pushResolution(req.user.id, req.params.sandboxId);
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/sandbox/:sandboxId
   * Teardown the container.
   */
  async teardown(req, res, next) {
    try {
      const result = await sandboxService.teardown(req.user.id, req.params.sandboxId);
      return res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

export default sandboxController;
