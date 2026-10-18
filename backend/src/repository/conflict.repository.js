import prisma from '../config/prisma.js';

export const conflictRepository = {
  /**
   * Find all conflicts for a given pull request
   */
  async findByPullRequestId(pullRequestId) {
    return prisma.conflict.findMany({
      where: { pullRequestId },
      orderBy: [{ filePath: 'asc' }, { headStartLine: 'asc' }],
    });
  },

  /**
   * Find a specific conflict finding by ID
   */
  async findById(id) {
    return prisma.conflict.findUnique({
      where: { id },
      include: {
        pullRequest: {
          include: {
            repository: true,
          },
        },
      },
    });
  },

  /**
   * Atomically replace conflicts and update PullRequest analysis status within a transaction
   */
  async replaceFindingsAtomic({
    pullRequestId,
    conflicts = [],
    analyzedBaseSha,
    analyzedHeadSha,
    hasConflicts,
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete prior conflict findings for this PR
      await tx.conflict.deleteMany({
        where: { pullRequestId },
      });

      // 2. Insert new conflict records if any
      if (conflicts.length > 0) {
        await tx.conflict.createMany({
          data: conflicts.map((c) => ({
            ...c,
            pullRequestId,
          })),
        });
      }

      // 3. Update PullRequest metadata and status to COMPLETED
      const updatedPR = await tx.pullRequest.update({
        where: { id: pullRequestId },
        data: {
          analysisStatus: 'COMPLETED',
          hasConflicts: Boolean(hasConflicts),
          analyzedBaseSha,
          analyzedHeadSha,
          analysisCompletedAt: new Date(),
          analysisError: null,
        },
        include: {
          conflicts: true,
        },
      });

      return updatedPR;
    });
  },
};

export default conflictRepository;
