import repositoryService from '../services/repository.service.js';
import { asyncHandler } from '../utils/errors.js';
import { serializeResponse, deserializeBody } from '../utils/serializers.js';
import { parseGitHubUrl } from '../utils/url.js';

export const repositoryController = {
  create: asyncHandler(async (req, res) => {
    const { repoUrl } = deserializeBody(req.body, ['repoUrl']);
    const { owner, repo, cleanUrl } = parseGitHubUrl(repoUrl);

    const savedRepo = await repositoryService.addRepository(req.user.id, {
      owner,
      repo,
      cleanUrl,
    });

    return res.status(201).json(
      serializeResponse(savedRepo, 'Repository registered and verified successfully.')
    );
  }),

  list: asyncHandler(async (req, res) => {
    const repos = await repositoryService.getUserRepositories(req.user.id);

    return res.status(200).json(
      serializeResponse(repos, 'Repositories retrieved successfully.')
    );
  }),

  getById: asyncHandler(async (req, res) => {
    const repo = await repositoryService.getUserRepositoryById(
      req.user.id,
      req.params.repositoryId
    );

    return res.status(200).json(
      serializeResponse(repo, 'Repository details retrieved successfully.')
    );
  }),
};

export default repositoryController;
