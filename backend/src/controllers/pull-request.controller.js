import pullRequestService from '../services/pull-request.service.js';
import { asyncHandler } from '../utils/errors.js';
import { serializeResponse } from '../utils/serializers.js';

export const pullRequestController = {
  list: asyncHandler(async (req, res) => {
    const { repositoryId } = req.params;
    const { state = 'open', page = '1', perPage = '20' } = req.query;

    const prs = await pullRequestService.listPullRequests(req.user.id, repositoryId, {
      state,
      page: parseInt(page, 10) || 1,
      perPage: Math.min(parseInt(perPage, 10) || 20, 100),
    });

    return res.status(200).json(
      serializeResponse(prs, 'Pull requests retrieved successfully.')
    );
  }),

  getByNumber: asyncHandler(async (req, res) => {
    const { repositoryId, prNumber } = req.params;

    const pr = await pullRequestService.getPullRequest(
      req.user.id,
      repositoryId,
      prNumber
    );

    return res.status(200).json(
      serializeResponse(pr, 'Pull request details retrieved successfully.')
    );
  }),
};

export default pullRequestController;
