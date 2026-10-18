import { BadRequestError } from './errors.js';

export const parseGitHubUrl = (repoUrl) => {
  if (!repoUrl || typeof repoUrl !== 'string') {
    throw new BadRequestError('Repository URL is required.', 'INVALID_REPO_URL');
  }

  const trimmed = repoUrl.trim();
  const regex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)(?:\/.*)?$/;
  const match = trimmed.match(regex);

  if (!match) {
    throw new BadRequestError(
      'Invalid GitHub repository URL. Expected format: https://github.com/owner/repo',
      'MALFORMED_REPO_URL'
    );
  }

  const owner = match[1];
  let repo = match[2];

  if (repo.endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  return { owner, repo, cleanUrl: `https://github.com/${owner}/${repo}` };
};

export default parseGitHubUrl;
