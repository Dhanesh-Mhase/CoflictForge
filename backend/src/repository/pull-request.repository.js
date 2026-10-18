import prisma from '../config/prisma.js';

export const pullRequestRepository = {
  /**
   * Upsert a pull request record by repository ID and GitHub PR number
   */
  async upsert({
    repositoryId,
    githubPrNumber,
    title,
    body,
    state,
    baseBranch,
    headBranch,
    baseSha,
    headSha,
    mergeable,
  }) {
    return prisma.pullRequest.upsert({
      where: {
        repositoryId_githubPrNumber: {
          repositoryId,
          githubPrNumber: Number(githubPrNumber),
        },
      },
      update: {
        title,
        body,
        state: state || 'open',
        baseBranch,
        headBranch,
        baseSha,
        headSha,
        mergeable,
      },
      create: {
        repositoryId,
        githubPrNumber: Number(githubPrNumber),
        title,
        body,
        state: state || 'open',
        baseBranch,
        headBranch,
        baseSha,
        headSha,
        mergeable,
        analysisStatus: 'NOT_ANALYZED',
      },
    });
  },

  /**
   * List all pull requests for a given repository
   */
  async findByRepositoryId(repositoryId) {
    return prisma.pullRequest.findMany({
      where: { repositoryId },
      orderBy: { githubPrNumber: 'desc' },
      include: {
        _count: {
          select: { conflicts: true },
        },
      },
    });
  },

  /**
   * Find a pull request by repository ID and PR number
   */
  async findByRepoAndNumber(repositoryId, githubPrNumber, includeConflicts = false) {
    return prisma.pullRequest.findUnique({
      where: {
        repositoryId_githubPrNumber: {
          repositoryId,
          githubPrNumber: Number(githubPrNumber),
        },
      },
      include: {
        conflicts: includeConflicts,
      },
    });
  },

  /**
   * Find a pull request by ID
   */
  async findById(id) {
    return prisma.pullRequest.findUnique({
      where: { id },
      include: {
        repository: true,
      },
    });
  },

  /**
   * Update analysis execution state
   */
  async updateAnalysisState(id, updateData) {
    return prisma.pullRequest.update({
      where: { id },
      data: updateData,
    });
  },
};

export default pullRequestRepository;
