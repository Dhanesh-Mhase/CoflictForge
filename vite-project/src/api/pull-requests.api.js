import apiClient from './client';

export const pullRequestsApi = {
  /**
   * List pull requests for a repository with pagination and state filter
   */
  async getPullRequests(repositoryId, { state = 'open', page = 1, perPage = 20 } = {}) {
    const { data } = await apiClient.get(`/repositories/${repositoryId}/pull-requests`, {
      params: { state, page, perPage },
    });
    return data?.data || [];
  },

  /**
   * Get single pull request details, refreshed SHAs and staleness
   */
  async getPullRequest(repositoryId, prNumber) {
    const { data } = await apiClient.get(
      `/repositories/${repositoryId}/pull-requests/${prNumber}`
    );
    return data?.data;
  },
};

export default pullRequestsApi;
