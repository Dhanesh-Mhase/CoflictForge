import prisma from '../config/prisma.js';

export const repositoryRepository = {
  /**
   * Upsert a repository for a specific user and GitHub repository ID
   */
  async upsert({ userId, githubRepoId, owner, name, fullName, url, defaultBranch, isPrivate }) {
    const parsedRepoId = typeof githubRepoId === 'bigint' ? githubRepoId : BigInt(githubRepoId);

    return prisma.repository.upsert({
      where: {
        userId_githubRepoId: {
          userId,
          githubRepoId: parsedRepoId,
        },
      },
      update: {
        owner,
        name,
        fullName,
        url,
        defaultBranch: defaultBranch || 'main',
        isPrivate: Boolean(isPrivate),
      },
      create: {
        userId,
        githubRepoId: parsedRepoId,
        owner,
        name,
        fullName,
        url,
        defaultBranch: defaultBranch || 'main',
        isPrivate: Boolean(isPrivate),
      },
    });
  },

  /**
   * Find all repositories submitted by a specific user
   */
  async findByUserId(userId) {
    return prisma.repository.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { pullRequests: true },
        },
      },
    });
  },

  /**
   * Find a specific repository by internal ID and verify user ownership
   */
  async findByIdAndUserId(id, userId) {
    return prisma.repository.findFirst({
      where: {
        id,
        userId,
      },
    });
  },

  /**
   * Find a repository by ID
   */
  async findById(id) {
    return prisma.repository.findUnique({
      where: { id },
    });
  },
};

export default repositoryRepository;
