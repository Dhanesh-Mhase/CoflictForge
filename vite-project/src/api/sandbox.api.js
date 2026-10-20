import apiClient from './client';
import { getAccessToken } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const sandboxApi = {
  /**
   * Provision a new sandbox for a PR with resolved file content.
   */
  provision(repositoryId, prNumber, resolvedFiles, conflictId) {
    return apiClient
      .post('/sandbox/provision', { repositoryId, prNumber, resolvedFiles, conflictId })
      .then((r) => r.data.data);
  },

  /**
   * Get sandbox status.
   */
  getStatus(sandboxId) {
    return apiClient.get(`/sandbox/${sandboxId}/status`).then((r) => r.data.data);
  },

  /**
   * Push resolved files to the PR branch.
   */
  pushResolution(sandboxId) {
    return apiClient.post(`/sandbox/${sandboxId}/push`).then((r) => r.data.data);
  },

  /**
   * Teardown the container.
   */
  teardown(sandboxId) {
    return apiClient.delete(`/sandbox/${sandboxId}`).then((r) => r.data.data);
  },

  /**
   * Open an SSE stream for sandbox logs.
   * Returns an EventSource instance — caller is responsible for closing it.
   *
   * @param {string} sandboxId
   * @param {function} onText    - called with each log text chunk
   * @param {function} onStatus  - called with final status string
   * @param {function} onError   - called on EventSource error
   */
  streamLogs(sandboxId, onText, onStatus, onError) {
    const token = getAccessToken();
    const url = `${API_BASE_URL}/sandbox/${sandboxId}/logs${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    // Use fetch-based SSE since EventSource doesn't support Authorization headers
    const controller = new AbortController();

    fetch(url, {
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.text !== undefined) onText(parsed.text);
                if (parsed.status !== undefined) onStatus(parsed.status);
              } catch (_) {}
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onError?.(err);
      });

    return { close: () => controller.abort() };
  },
};

export default sandboxApi;
