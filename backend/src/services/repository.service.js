import githubService from './github.service.js';
import repositoryRepository from '../repository/repository.repository.js';
import { NotFoundError } from '../utils/errors.js';

export const repositoryService = {
  async addRepository(userId, { owner, repo, cleanUrl }) {
    const remoteRepo = await githubService.getRepository(owner, repo);

    const localRepo = await repositoryRepository.upsert({
      userId,
      githubRepoId: remoteRepo.githubRepoId,
      owner: remoteRepo.owner,
      name: remoteRepo.name,
      fullName: remoteRepo.fullName,
      url: cleanUrl || remoteRepo.url,
      defaultBranch: remoteRepo.defaultBranch,
      isPrivate: remoteRepo.isPrivate,
    });

    return localRepo;
  },

  async getUserRepositories(userId) {
    return repositoryRepository.findByUserId(userId);
  },

  async getUserRepositoryById(userId, repositoryId) {
    const repo = await repositoryRepository.findByIdAndUserId(repositoryId, userId);

    if (!repo) {
      throw new NotFoundError(
        'Repository not found or you do not have permission to access it.',
        'REPOSITORY_NOT_FOUND'
      );
    }

    return repo;
  },
};

export default repositoryService;
