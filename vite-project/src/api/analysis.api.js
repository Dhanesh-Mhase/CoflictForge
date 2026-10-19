import apiClient from './client';

export const analysisApi = {
  /**
   * Trigger 3-way merge, AST, and LLM analysis for a pull request
   */
  async triggerAnalysis(repositoryId, prNumber) {
    const { data } = await apiClient.post(
      `/repositories/${repositoryId}/pull-requests/${prNumber}/analyze`
    );
    return data?.data;
  },

  /**
   * Retrieve latest completed conflict findings for a PR
   */
  async getConflicts(repositoryId, prNumber) {
    const { data } = await apiClient.get(
      `/repositories/${repositoryId}/pull-requests/${prNumber}/conflicts`
    );
    return data?.data;
  },

  /**
   * Stream raw source code at analyzed SHAs for Monaco Diff Editor
   */
  async getSource(repositoryId, prNumber, filePath) {
    const { data } = await apiClient.get(
      `/repositories/${repositoryId}/pull-requests/${prNumber}/source`,
      {
        params: { path: filePath },
      }
    );
    return data?.data;
  },
};

export default analysisApi;
