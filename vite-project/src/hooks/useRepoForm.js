import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SAMPLE_PULL_REQUEST_URL } from '../constants/navItems';
import repositoriesApi from '../api/repositories.api';
import { useAuth } from '../context/AuthContext';

/**
 * Custom Hook: useRepoForm
 * Encapsulates PR/repo URL state, real backend API integration, and route transitions.
 */
export const useRepoForm = (initialUrl = '', onRequireLogin = null) => {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const fillSampleUrl = useCallback(() => {
    setUrl(SAMPLE_PULL_REQUEST_URL);
    setError('');
  }, []);

  const handleChange = useCallback(
    (e) => {
      setUrl(e.target.value);
      if (error) setError('');
    },
    [error]
  );

  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      const trimmed = url.trim();
      if (!trimmed) {
        setError('Please enter a GitHub repository or pull request link');
        return;
      }

      const githubPattern = /^(https?:\/\/)?(www\.)?github\.com\/[\w-]+\/[\w.-]+(\/pull\/\d+)?\/?$/i;
      if (!githubPattern.test(trimmed)) {
        setError(
          'Please enter a valid GitHub URL (e.g., https://github.com/owner/repo or /pull/42)'
        );
        return;
      }

      if (!isAuthenticated) {
        if (onRequireLogin) {
          onRequireLogin();
          return;
        }
        setError('Please sign in first to analyze repositories and view conflicts.');
        return;
      }

      setError('');
      setIsLoading(true);

      try {
        const repo = await repositoriesApi.addRepository(trimmed);

        // Check if URL points to a specific pull request
        const prMatch = trimmed.match(/\/pull\/(\d+)/i);
        if (prMatch && prMatch[1]) {
          navigate(`/repositories/${repo.id}/pull-requests/${prMatch[1]}/analysis`);
        } else {
          navigate(`/repositories/${repo.id}`);
        }
      } catch (err) {
        console.error('Error adding repository:', err);
        setError(
          err.response?.data?.message ||
            'Failed to add repository. Please verify the GitHub URL and access permissions.'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [url, isAuthenticated, onRequireLogin, navigate]
  );

  return {
    url,
    setUrl,
    error,
    isLoading,
    handleChange,
    handleSubmit,
    fillSampleUrl,
  };
};

export default useRepoForm;
