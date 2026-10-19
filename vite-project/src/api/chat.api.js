import apiClient from './client';

export const chatApi = {
  /**
   * Send a contextual follow-up question regarding a specific conflict
   */
  async sendChatMessage(repositoryId, prNumber, conflictId, message, history = []) {
    const { data } = await apiClient.post(
      `/repositories/${repositoryId}/pull-requests/${prNumber}/conflicts/${conflictId}/chat`,
      {
        message,
        history,
      }
    );
    return data?.data;
  },
};

export default chatApi;
