import Docker from 'dockerode';
import tar from 'tar-stream';
import { Readable } from 'stream';

const docker = new Docker();

// ─── Constants ──────────────────────────────────────────────────────────────

const CONTAINER_WORK_DIR = '/workspace';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const RESOURCE_LIMITS = {
  Memory: 512 * 1024 * 1024, // 512 MB
  NanoCpus: 1e9,             // 1 CPU
};

// ─── Project-type detection ──────────────────────────────────────────────────

/**
 * Detect the project type and test command from files present in the container.
 * Returns { image, testCmd }
 */
export const detectProjectType = async (container) => {
  const checks = [
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

  for (const check of checks) {
    try {
      const exec = await container.exec({
        Cmd: ['sh', '-c', `test -f ${CONTAINER_WORK_DIR}/${check.file} && echo yes || echo no`],
        AttachStdout: true,
        AttachStderr: false,
      });
      const stream = await exec.start({ hijack: true, stdin: false });
      const output = await streamToString(stream);
      if (output.trim().includes('yes')) {
        return check;
      }
    } catch (_) {
      // continue checking
    }
  }

  // Fallback — just run a no-op
  return {
    image: 'alpine:latest',
    installCmd: 'true',
    testCmd: 'echo "No test runner detected. Skipping tests." && exit 0',
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const streamToString = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });

/**
 * Build a minimal tar archive containing the resolved file contents
 * so we can copy them into the running container.
 */
const buildTarFromFiles = (resolvedFiles) =>
  new Promise((resolve, reject) => {
    const pack = tar.pack();
    for (const [filePath, content] of Object.entries(resolvedFiles)) {
      // Strip leading slash so tar entries are relative paths
      const entryName = filePath.replace(/^\//, '');
      const buf = Buffer.from(content, 'utf8');
      pack.entry({ name: entryName, size: buf.length }, buf, (err) => {
        if (err) reject(err);
      });
    }
    pack.finalize();

    const chunks = [];
    pack.on('data', (c) => chunks.push(c));
    pack.on('end', () => resolve(Buffer.concat(chunks)));
    pack.on('error', reject);
  });

// ─── Main service ─────────────────────────────────────────────────────────────

export const dockerService = {
  /**
   * Pull an image if not already cached locally (best-effort, non-blocking on error).
   */
  async ensureImage(imageName) {
    try {
      await docker.getImage(imageName).inspect();
    } catch {
      // Image not found locally — pull it
      await new Promise((resolve, reject) => {
        docker.pull(imageName, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err2) => {
            if (err2) reject(err2);
            else resolve();
          });
        });
      });
    }
  },

  /**
   * Create and start an ephemeral container with the repository cloned at headSha,
   * then apply the resolved file patches.
   *
   * @param {object} opts
   * @param {string} opts.repoCloneUrl  - HTTPS clone URL (e.g. https://github.com/owner/repo.git)
   * @param {string} opts.headSha       - Git SHA to checkout
   * @param {string} opts.image         - Docker image to use (e.g. 'node:20-alpine')
   * @param {object} opts.resolvedFiles - { "src/foo.js": "content..." }
   * @returns {string} containerId
   */
  async provisionContainer({ repoCloneUrl, headSha, image, resolvedFiles }) {
    await this.ensureImage(image);

    // Robust bootstrap script:
    // 1. Install git if missing (Alpine: apk add git, Debian/Ubuntu: apt-get install git)
    // 2. Clone repo and checkout target commit
    // 3. Signal success or failure via /tmp/clone_status
    // 4. Always keep container alive with tail -f /dev/null so logs can be inspected
    const initScript = `
(
  set -e
  if ! command -v git >/dev/null 2>&1; then
    if command -v apk >/dev/null 2>&1; then
      apk update >/dev/null 2>&1 && apk add --no-cache git >/dev/null 2>&1
    elif command -v apt-get >/dev/null 2>&1; then
      apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq git >/dev/null 2>&1
    fi
  fi

  git clone --depth=50 ${repoCloneUrl} ${CONTAINER_WORK_DIR}
  cd ${CONTAINER_WORK_DIR}
  git fetch --depth=1 origin ${headSha} 2>/dev/null || true
  git checkout ${headSha} 2>/dev/null || true
  echo "CLONE_SUCCESS" > /tmp/clone_status
) > /tmp/clone.log 2>&1 || echo "CLONE_FAILED" > /tmp/clone_status
exec tail -f /dev/null
`;

    const container = await docker.createContainer({
      Image: image,
      Cmd: ['sh', '-c', initScript],
      WorkingDir: CONTAINER_WORK_DIR,
      AttachStdout: false,
      AttachStderr: false,
      Tty: false,
      HostConfig: {
        Memory: RESOURCE_LIMITS.Memory,
        NanoCpus: RESOURCE_LIMITS.NanoCpus,
        AutoRemove: false,
        NetworkMode: 'bridge',
      },
    });

    await container.start();

    // Wait for the clone to finish (or throw with exact clone logs if it failed)
    await this._waitForClone(container);

    // Apply resolved file patches
    if (resolvedFiles && Object.keys(resolvedFiles).length > 0) {
      console.log(`[Docker] Patching in resolved files:`, Object.keys(resolvedFiles));
      const tarBuffer = await buildTarFromFiles(resolvedFiles);
      await container.putArchive(tarBuffer, { path: CONTAINER_WORK_DIR });
      console.log(`[Docker] Successfully patched files into ${CONTAINER_WORK_DIR}`);
    }

    return container.id;
  },

  /**
   * Wait until the clone script finishes by checking /tmp/clone_status.
   */
  async _waitForClone(container, timeoutMs = 90000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const exec = await container.exec({
          Cmd: ['cat', '/tmp/clone_status'],
          AttachStdout: true,
          AttachStderr: true,
        });
        const stream = await exec.start({ hijack: true, stdin: false });
        const output = (await streamToString(stream)).trim();

        if (output.includes('CLONE_SUCCESS')) {
          return;
        }

        if (output.includes('CLONE_FAILED')) {
          // Read the clone error log
          const logExec = await container.exec({
            Cmd: ['cat', '/tmp/clone.log'],
            AttachStdout: true,
            AttachStderr: true,
          });
          const logStream = await logExec.start({ hijack: true, stdin: false });
          const errorLog = (await streamToString(logStream)).trim();
          throw new Error(`Repository clone failed: ${errorLog || 'Unknown git error'}`);
        }
      } catch (err) {
        if (err.message?.startsWith('Repository clone failed:')) {
          throw err;
        }
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timed out waiting for repository clone to complete.');
  },

  /**
   * Run tests inside the container.
   * Returns { exitCode, output } when tests finish.
   *
   * @param {string} containerId
   * @param {string} installCmd - dependency install command
   * @param {string} testCmd    - test run command
   * @param {function} onData   - optional callback(chunk: string) for streaming
   * @param {number}  timeoutMs
   */
  async runTests(containerId, installCmd, testCmd, onData, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const container = docker.getContainer(containerId);
    const fullCmd = `cd ${CONTAINER_WORK_DIR} && ${installCmd} && ${testCmd}`;

    const exec = await container.exec({
      Cmd: ['sh', '-c', fullCmd],
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    const output = [];
    let timedOut = false;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      stream.destroy();
    }, timeoutMs);

    await new Promise((resolve) => {
      // dockerode multiplexes stdout/stderr — demux manually
      docker.modem.demuxStream(
        stream,
        {
          write(chunk) {
            const text = chunk.toString('utf8');
            output.push(text);
            if (onData) onData(text);
          },
        },
        {
          write(chunk) {
            const text = chunk.toString('utf8');
            output.push(text);
            if (onData) onData(text);
          },
        }
      );
      stream.on('end', resolve);
      stream.on('error', resolve);
    });

    clearTimeout(timeoutHandle);

    if (timedOut) {
      return { exitCode: 124, output: output.join('') + '\n[TIMEOUT] Test run exceeded limit.\n' };
    }

    const inspected = await exec.inspect();
    return { exitCode: inspected.ExitCode, output: output.join('') };
  },

  /**
   * Stream live container logs to a callback — used for SSE endpoint.
   *
   * @param {string}   containerId
   * @param {function} onData - callback(chunk: string)
   * @param {AbortSignal} signal - cancel when client disconnects
   */
  async streamLogs(containerId, onData, signal) {
    const container = docker.getContainer(containerId);
    const logStream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: false,
    });

    const readable = Readable.from(logStream);
    signal?.addEventListener('abort', () => readable.destroy());

    for await (const chunk of readable) {
      // Strip Docker 8-byte stream header
      const text = chunk.length > 8 ? chunk.slice(8).toString('utf8') : chunk.toString('utf8');
      onData(text);
    }
  },

  /**
   * Stop and remove a container.
   */
  async teardown(containerId) {
    try {
      const container = docker.getContainer(containerId);
      await container.stop({ t: 5 }).catch(() => {}); // ignore already-stopped
      await container.remove({ force: true });
    } catch (err) {
      console.warn(`[DockerService] teardown(${containerId}) warning:`, err.message);
    }
  },

  /**
   * Check if Docker daemon is reachable.
   */
  async ping() {
    try {
      await docker.ping();
      return true;
    } catch {
      return false;
    }
  },
};

export default dockerService;
