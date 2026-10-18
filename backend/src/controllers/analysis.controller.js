import analysisService from '../services/analysis.service.js';
import { asyncHandler } from '../utils/errors.js';
import { serializeResponse } from '../utils/serializers.js';

export const analysisController = {
  trigger: asyncHandler(async (req, res) => {
    const { repositoryId, prNumber } = req.params;

    const result = await analysisService.analyzePullRequest(
      req.user.id,
      repositoryId,
      prNumber
    );

    return res.status(200).json(
      serializeResponse(result, 'Pull request analysis completed successfully.')
    );
  }),

  getConflicts: asyncHandler(async (req, res) => {
    const { repositoryId, prNumber } = req.params;

    const result = await analysisService.getConflicts(
      req.user.id,
      repositoryId,
      prNumber
    );

    return res.status(200).json(
      serializeResponse(result, 'Conflict findings retrieved successfully.')
    );
  }),

  getSource: asyncHandler(async (req, res) => {
    const { repositoryId, prNumber } = req.params;
    const { path } = req.query;

    const result = await analysisService.getSource(
      req.user.id,
      repositoryId,
      prNumber,
      path
    );

    return res.status(200).json(
      serializeResponse(result, 'Source file contents retrieved successfully.')
    );
  }),
};

export default analysisController;
