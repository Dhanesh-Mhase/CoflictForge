import apiClient from './client';

export const repositoriesApi = {
  /**
   * Submit and validate a GitHub repository URL
   */
  async addRepository(repoUrl) {
    const { data } = await apiClient.post('/repositories', { repoUrl });
    return data?.data;
  },

  /**
   * List all repositories added by current user
   */
  async getRepositories() {
    const { data } = await apiClient.get('/repositories');
    return data?.data || [];
  },

  /**
   * Get repository details by ID
   */
  async getRepository(repositoryId) {
    const { data } = await apiClient.get(`/repositories/${repositoryId}`);
    return data?.data;
  },
};

export default repositoriesApi;
