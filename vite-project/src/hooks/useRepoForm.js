import { useState, useCallback } from 'react';
import { SAMPLE_PULL_REQUEST_URL } from '../constants/navItems';

/**
 * Custom Hook: useRepoForm
 * Single Responsibility: Encapsulates PR/repo URL state, sample injection, and submission status.
 */
export const useRepoForm = (initialUrl = '') => {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);

  const fillSampleUrl = useCallback(() => {
    setUrl(SAMPLE_PULL_REQUEST_URL);
    setError('');
  }, []);

  const handleChange = useCallback((e) => {
    setUrl(e.target.value);
    if (error) setError('');
  }, [error]);

  const handleSubmit = useCallback(
    (e) => {
      if (e) e.preventDefault();

      const trimmed = url.trim();
      if (!trimmed) {
        setError('Please enter a GitHub repository or pull request link');
        return;
      }

      // Basic GitHub URL validation
      const githubPattern = /^(https?:\/\/)?(www\.)?github\.com\/[\w-]+\/[\w.-]+(\/pull\/\d+)?\/?$/i;
      if (!githubPattern.test(trimmed)) {
        setError('Please enter a valid GitHub URL (e.g., https://github.com/owner/repo/pull/42)');
        return;
      }

      setError('');
      setIsLoading(true);

      // Simulate ConflictForge analysis step (instant/clean mock response)
      setTimeout(() => {
        setIsLoading(false);
        setAnalysisResult({
          repo: trimmed.replace(/^(https?:\/\/)?(www\.)?github\.com\//, ''),
          hasConflicts: true,
          conflictingFiles: ['src/services/auth.ts', 'package.json'],
          status: 'ready',
        });
      }, 700);
    },
    [url]
  );

  const clearAnalysis = useCallback(() => {
    setAnalysisResult(null);
  }, []);

  return {
    url,
    setUrl,
    error,
    isLoading,
    analysisResult,
    handleChange,
    handleSubmit,
    fillSampleUrl,
    clearAnalysis,
  };
};
