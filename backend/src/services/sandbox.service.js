import prisma from '../config/prisma.js';
import dockerService, { detectProjectType } from './docker.service.js';
import githubService from './github.service.js';
import repositoryService from './repository.service.js';
import pullRequestRepository from '../repository/pull-request.repository.js';
import { NotFoundError, BadRequestError, AppError } from '../utils/errors.js';
import { env } from '../config/env.js';

// ─── In-memory SSE subscriber registry ───────────────────────────────────────
// sandboxId → Set<(chunk: string) => void>
const sseSubscribers = new Map();

const emit = (sandboxId, text) => {
  const subs = sseSubscribers.get(sandboxId);
  if (subs) subs.forEach((fn) => fn(text));
};

const subscribe = (sandboxId, fn) => {
  if (!sseSubscribers.has(sandboxId)) sseSubscribers.set(sandboxId, new Set());
  sseSubscribers.get(sandboxId).add(fn);
  return () => sseSubscribers.get(sandboxId)?.delete(fn);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const updateSandbox = (id, data) =>
  prisma.sandbox.update({ where: { id }, data });

const log = (sandboxId, msg) => {
  const line = `[ConflictForge] ${msg}\n`;
  emit(sandboxId, line);
  console.log(`[Sandbox:${sandboxId.slice(0, 8)}] ${msg}`);
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const sandboxService = {
  /**
   * Check Docker is available before any sandbox operation.
   */
  async assertDockerAvailable() {
    const ok = await dockerService.ping();
    if (!ok) {
      throw new AppError(
        'Docker daemon is not reachable. Please ensure Docker Desktop is running.',
        503,
        'DOCKER_UNAVAILABLE'
      );
    }
  },

  /**
   * Provision a new ephemeral sandbox for a pull request.
   *
   * @param {string} userId
   * @param {string} repositoryId
   * @param {number} prNumber
   * @param {object} resolvedFiles - { "src/foo.js": "<resolved content>" }
   * @param {string} [conflictId]
   * @returns {object} sandbox record
   */
  async provision(userId, repositoryId, prNumber, resolvedFiles, conflictId) {
    await this.assertDockerAvailable();

    const repo = await repositoryService.getUserRepositoryById(userId, repositoryId);

    const parsedNumber = parseInt(prNumber, 10);
    if (isNaN(parsedNumber)) {
      throw new BadRequestError('Invalid pull request number.', 'INVALID_PR_NUMBER');
    }

    const pr = await pullRequestRepository.findByRepoAndNumber(repo.id, parsedNumber, false);
    if (!pr) {
      throw new NotFoundError('Pull request not found.', 'PULL_REQUEST_NOT_FOUND');
    }

    // Create the sandbox DB record
    const sandbox = await prisma.sandbox.create({
      data: {
        pullRequestId: pr.id,
        conflictId: conflictId || null,
        status: 'PROVISIONING',
        resolvedFiles,
      },
    });

    // Run provisioning asynchronously so the HTTP response returns immediately
    this._runProvisioningPipeline(sandbox.id, repo, pr, resolvedFiles).catch((err) => {
      console.error(`[Sandbox:${sandbox.id}] pipeline crashed:`, err.message);
    });

    return sandbox;
  },

  /**
   * Async pipeline: clone → patch → detect → install → test
   */
  async _runProvisioningPipeline(sandboxId, repo, pr, resolvedFiles) {
    let containerId = null;

    try {
      // Build the HTTPS clone URL (public repos) or with token for private
      const cloneUrl = env.GITHUB_TOKEN
        ? `https://${env.GITHUB_TOKEN}@github.com/${repo.owner}/${repo.name}.git`
        : `https://github.com/${repo.owner}/${repo.name}.git`;

      const headSha = pr.analyzedHeadSha || pr.headSha;

      // ── Step 1: Detect project type (before container — use a lightweight Alpine container) ──
      log(sandboxId, 'Detecting project type…');

      // We need to pull a base image to peek at files, so start with node:20-alpine as default
      // then re-detect from inside. For efficiency we detect by checking GitHub file tree instead.
      const projectType = await this._detectProjectTypeFromGitHub(repo, headSha);
      log(sandboxId, `Detected: ${projectType.image} | test: ${projectType.testCmd}`);

      await updateSandbox(sandboxId, { status: 'CLONING' });
      log(sandboxId, `Cloning ${repo.fullName} @ ${headSha.slice(0, 7)}…`);

      // ── Step 2: Provision container ──
      containerId = await dockerService.provisionContainer({
        repoCloneUrl: cloneUrl,
        headSha,
        image: projectType.image,
        resolvedFiles,
      });

      await updateSandbox(sandboxId, { containerId, status: 'RUNNING_TESTS' });
      log(sandboxId, 'Repository cloned. Resolved files patched in. Installing dependencies…');

      // ── Step 3: Run tests ──
      const { exitCode, output } = await dockerService.runTests(
        containerId,
        projectType.installCmd,
        projectType.testCmd,
        (chunk) => emit(sandboxId, chunk)
      );

      console.log(`[Sandbox:${sandboxId.slice(0, 8)}] Test output (${exitCode}):\n${output}`);

      const finalStatus = exitCode === 0 ? 'PASSED' : exitCode === 124 ? 'TIMED_OUT' : 'FAILED';

      await updateSandbox(sandboxId, {
        status: finalStatus,
        exitCode,
        testOutput: output,
        completedAt: new Date(),
      });

      log(sandboxId, `Tests ${finalStatus}. Exit code: ${exitCode}`);
      emit(sandboxId, `\n__SANDBOX_STATUS__:${finalStatus}\n`);
    } catch (err) {
      console.error(`[Sandbox:${sandboxId}] error:`, err.message);
      await updateSandbox(sandboxId, {
        status: 'ERROR',
        testOutput: err.message,
        completedAt: new Date(),
      }).catch(() => {});
      emit(sandboxId, `\n[ERROR] ${err.message}\n__SANDBOX_STATUS__:ERROR\n`);
    } finally {
      // Always teardown container — even on error
      if (containerId) {
        await dockerService.teardown(containerId).catch(() => {});
        log(sandboxId, 'Container torn down.');
      }
      // Clean up SSE subscribers
      sseSubscribers.delete(sandboxId);
    }
  },

  /**
   * Detect project type from GitHub file tree rather than from inside container.
   * Avoids needing to spin up a second container just for detection.
   */
  async _detectProjectTypeFromGitHub(repo, headSha) {
    const fileChecks = [
      {
        file: 'package.json',
        image: 'node:20-alpine',
        installCmd: 'npm install --prefer-offline 2>&1 || true',
        testCmd: 'npm test 2>&1',
      },
      {
        file: 'requirements.txt',
        image: 'python:3.11-slim',
        installCmd: 'pip install -r requirements.txt -q 2>&1 || true',
        testCmd: 'python -m pytest --tb=short 2>&1',
      },
      {
        file: 'pom.xml',
        image: 'maven:3.9-eclipse-temurin-21-alpine',
        installCmd: 'true',
        testCmd: 'mvn test -q 2>&1',
      },
      {
        file: 'build.gradle',
        image: 'gradle:8-jdk21-alpine',
        installCmd: 'true',
        testCmd: './gradlew test 2>&1',
      },
      {
        file: 'go.mod',
        image: 'golang:1.22-alpine',
        installCmd: 'go mod download 2>&1 || true',
        testCmd: 'go test ./... 2>&1',
      },
    ];

    for (const check of fileChecks) {
      const content = await githubService.getFileContent(repo.owner, repo.name, check.file, headSha);
      if (content !== null) return check;
    }

    return {
      file: null,
      image: 'alpine:latest',
      installCmd: 'true',
      testCmd: 'echo "No test runner detected. Skipping tests." && exit 0',
    };
  },

  /**
   * Register an SSE subscriber for a sandbox. Returns an unsubscribe function.
   */
  addLogSubscriber(sandboxId, fn) {
    return subscribe(sandboxId, fn);
  },

  /**
   * Get sandbox record by ID, verifying user has access to its pull request.
   */
  async getSandbox(userId, sandboxId) {
    const sandbox = await prisma.sandbox.findUnique({
      where: { id: sandboxId },
      include: { pullRequest: { include: { repository: true } } },
    });

    if (!sandbox) {
      throw new NotFoundError('Sandbox not found.', 'SANDBOX_NOT_FOUND');
    }

    if (sandbox.pullRequest.repository.userId !== userId) {
      throw new NotFoundError('Sandbox not found.', 'SANDBOX_NOT_FOUND');
    }

    return sandbox;
  },

  /**
   * Push resolved files to the PR's head branch via GitHub API.
   * Creates one commit per resolved file.
   */
  async pushResolution(userId, sandboxId) {
    const sandbox = await this.getSandbox(userId, sandboxId);

    if (sandbox.status !== 'PASSED') {
      throw new BadRequestError(
        'Can only push resolutions from sandboxes with PASSED status.',
        'SANDBOX_NOT_PASSED'
      );
    }

    const pr = sandbox.pullRequest;
    const repo = pr.repository;
    const resolvedFiles = sandbox.resolvedFiles || {};

    if (Object.keys(resolvedFiles).length === 0) {
      throw new BadRequestError('No resolved files to push.', 'NO_RESOLVED_FILES');
    }

    const results = [];

    for (const [filePath, content] of Object.entries(resolvedFiles)) {
      // Get the current file's blob SHA (needed for the update API)
      let sha;
      try {
        const fileData = await githubService.request(
          `/repos/${repo.owner}/${repo.name}/contents/${filePath}?ref=${pr.headBranch}`
        );
        sha = fileData.sha;
      } catch (err) {
        if (err.errorCode !== 'GITHUB_RESOURCE_NOT_FOUND') throw err;
        sha = undefined; // new file
      }

      const body = {
        message: `fix: resolve merge conflict in ${filePath} [ConflictForge]`,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: pr.headBranch,
        ...(sha ? { sha } : {}),
      };

      const result = await githubService.request(
        `/repos/${repo.owner}/${repo.name}/contents/${filePath}`,
        { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }
      );

      results.push({ filePath, commitSha: result.commit?.sha });
    }

    await updateSandbox(sandboxId, { status: 'PUSHED' });

    return { pushed: results };
  },

  /**
   * Teardown a sandbox container manually (e.g., user cancels).
   */
  async teardown(userId, sandboxId) {
    const sandbox = await this.getSandbox(userId, sandboxId);

    if (sandbox.containerId) {
      await dockerService.teardown(sandbox.containerId);
    }

    await updateSandbox(sandboxId, { status: 'TORN_DOWN', completedAt: new Date() });
    sseSubscribers.delete(sandboxId);

    return { success: true };
  },
};

export default sandboxService;
