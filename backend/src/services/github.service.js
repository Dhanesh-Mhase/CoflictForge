import { env } from '../config/env.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';

export const githubService = {
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('https://')
      ? endpoint
      : `https://api.github.com${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ConflictForge-Backend',
      ...(options.headers || {}),
    };

    if (env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    }

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (err) {
      throw new AppError(
        `Failed to reach GitHub API: ${err.message}`,
        502,
        'GITHUB_NETWORK_ERROR'
      );
    }

    if (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0') {
      throw new AppError(
        'GitHub API rate limit exceeded. Please configure a GITHUB_TOKEN.',
        429,
        'GITHUB_RATE_LIMITED'
      );
    }

    if (response.status === 404) {
      throw new NotFoundError(
        'Resource not found on GitHub. The repository may not exist or may be private without authorization.',
        'GITHUB_RESOURCE_NOT_FOUND'
      );
    }

    if (response.status === 401) {
      throw new ForbiddenError(
        'GitHub API credentials invalid or lacking permission.',
        'GITHUB_UNAUTHORIZED'
      );
    }

    if (response.status === 403) {
      throw new ForbiddenError(
        'Access to this GitHub resource is forbidden.',
        'GITHUB_FORBIDDEN'
      );
    }

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMsg = `GitHub API error (${response.status})`;
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.message) errorMsg = parsed.message;
      } catch (_) {}
      throw new AppError(errorMsg, response.status, 'GITHUB_API_ERROR');
    }

    return response.json();
  },

  async getRepository(owner, repo) {
    const data = await this.request(`/repos/${owner}/${repo}`);

    return {
      githubRepoId: BigInt(data.id),
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      defaultBranch: data.default_branch || 'main',
      isPrivate: Boolean(data.private),
    };
  },

  async getPullRequests(owner, repo, { state = 'open', page = 1, perPage = 20 } = {}) {
    return this.request(
      `/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}&sort=updated&direction=desc`
    );
  },

  async getPullRequest(owner, repo, prNumber) {
    return this.request(`/repos/${owner}/${repo}/pulls/${prNumber}`);
  },

  async getPullRequestFiles(owner, repo, prNumber) {
    return this.request(`/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`);
  },

  async getFileContent(owner, repo, filePath, ref) {
    try {
      const data = await this.request(
        `/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${ref}`
      );

      if (data.encoding === 'base64' && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }

      if (data.download_url) {
        const rawRes = await fetch(data.download_url, {
          headers: env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {},
        });
        if (rawRes.ok) return rawRes.text();
      }

      return null;
    } catch (err) {
      if (err instanceof NotFoundError || err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  },

  async compareCommits(owner, repo, base, head) {
    return this.request(`/repos/${owner}/${repo}/compare/${base}...${head}`);
  },
};

export default githubService;
