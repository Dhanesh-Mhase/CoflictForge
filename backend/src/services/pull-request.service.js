import repositoryService from './repository.service.js';
import githubService from './github.service.js';
import pullRequestRepository from '../repository/pull-request.repository.js';
import { NotFoundError } from '../utils/errors.js';

export const pullRequestService = {
  computeIsStale(pr) {
    if (!pr.analyzedBaseSha || !pr.analyzedHeadSha) {
      return false;
    }
    return (
      pr.baseSha !== pr.analyzedBaseSha ||
      pr.headSha !== pr.analyzedHeadSha
    );
  },

  async listPullRequests(userId, repositoryId, { state = 'open', page = 1, perPage = 20 } = {}) {
    const repo = await repositoryService.getUserRepositoryById(userId, repositoryId);

    const remotePRs = await githubService.getPullRequests(repo.owner, repo.name, {
      state,
      page,
      perPage,
    });

    if (!Array.isArray(remotePRs)) {
      return [];
    }

    const syncedPRs = await Promise.all(
      remotePRs.map(async (remotePr) => {
        const localPr = await pullRequestRepository.upsert({
          repositoryId: repo.id,
          githubPrNumber: remotePr.number,
          title: remotePr.title,
          body: remotePr.body,
          state: remotePr.state,
          baseBranch: remotePr.base?.ref || 'main',
          headBranch: remotePr.head?.ref || '',
          baseSha: remotePr.base?.sha || '',
          headSha: remotePr.head?.sha || '',
          mergeable: remotePr.mergeable !== undefined ? remotePr.mergeable : null,
        });

        return {
          ...localPr,
          isStale: this.computeIsStale(localPr),
          htmlUrl: remotePr.html_url,
          user: remotePr.user
            ? { login: remotePr.user.login, avatarUrl: remotePr.user.avatar_url }
            : null,
        };
      })
    );

    return syncedPRs;
  },

  async getPullRequest(userId, repositoryId, prNumber) {
    const repo = await repositoryService.getUserRepositoryById(userId, repositoryId);

    const parsedNumber = parseInt(prNumber, 10);
    if (isNaN(parsedNumber)) {
      throw new NotFoundError('Invalid pull request number', 'INVALID_PR_NUMBER');
    }

    const remotePr = await githubService.getPullRequest(repo.owner, repo.name, parsedNumber);

    const localPr = await pullRequestRepository.upsert({
      repositoryId: repo.id,
      githubPrNumber: parsedNumber,
      title: remotePr.title,
      body: remotePr.body,
      state: remotePr.state,
      baseBranch: remotePr.base?.ref || 'main',
      headBranch: remotePr.head?.ref || '',
      baseSha: remotePr.base?.sha || '',
      headSha: remotePr.head?.sha || '',
      mergeable: remotePr.mergeable !== undefined ? remotePr.mergeable : null,
    });

    const fullPr = await pullRequestRepository.findByRepoAndNumber(repo.id, parsedNumber, true);

    return {
      ...fullPr,
      isStale: this.computeIsStale(fullPr),
      htmlUrl: remotePr.html_url,
      user: remotePr.user
        ? { login: remotePr.user.login, avatarUrl: remotePr.user.avatar_url }
        : null,
      changedFilesCount: remotePr.changed_files,
      additions: remotePr.additions,
      deletions: remotePr.deletions,
    };
  },
};

export default pullRequestService;
