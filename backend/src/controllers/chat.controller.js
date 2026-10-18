import chatService from '../services/chat.service.js';
import { asyncHandler } from '../utils/errors.js';
import { serializeResponse } from '../utils/serializers.js';

export const chatController = {
  ask: asyncHandler(async (req, res) => {
    const { repositoryId, prNumber, conflictId } = req.params;
    const { message, history } = req.body;

    const result = await chatService.ask({
      userId: req.user.id,
      repositoryId,
      prNumber,
      conflictId,
      message,
      history,
    });

    return res.status(200).json(
      serializeResponse(result, 'Chat response generated successfully.')
    );
  }),
};

export default chatController;
