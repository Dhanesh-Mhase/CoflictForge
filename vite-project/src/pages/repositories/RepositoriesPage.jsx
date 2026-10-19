import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import repositoriesApi from '../../api/repositories.api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';

export const RepositoriesPage = ({ onLoginClick }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [repositories, setRepositories] = useState([]);
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadRepositories = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const data = await repositoriesApi.getRepositories();
      setRepositories(data);
    } catch (err) {
      console.error('Failed to load repositories:', err);
      setError(err.response?.data?.message || 'Failed to load your repositories.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  const handleAddRepo = async (e) => {
    e.preventDefault();
    const trimmed = newRepoUrl.trim();
    if (!trimmed) {
      setError('Please enter a GitHub repository URL.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const addedRepo = await repositoriesApi.addRepository(trimmed);
      setNewRepoUrl('');
      setSuccessMsg(`Repository ${addedRepo.fullName} added successfully!`);
      await loadRepositories();
      navigate(`/repositories/${addedRepo.id}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          'Failed to add repository. Please verify the URL and that the repo exists.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="repos-page-unauth">
        <div className="unauth-card">
          <span className="unauth-icon">🔒</span>
          <h2>Sign in to view your repositories</h2>
          <p>ConflictForge scopes your repository analysis and findings privately to your account.</p>
          <Button variant="primary" size="md" onClick={onLoginClick}>
            Sign In with Google
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="repositories-page">
      <div className="repositories-container">
        {/* Page Header */}
        <div className="repos-header">
          <div>
            <h1 className="repos-title">Your Repositories</h1>
            <p className="repos-subtitle">
              Repositories you have added to ConflictForge for pull request and merge conflict diagnostics.
            </p>
          </div>
        </div>

        {/* Add Repository Card */}
        <div className="add-repo-capsule-card">
          <form onSubmit={handleAddRepo} className="add-repo-form">
            <input
              type="text"
              placeholder="Paste GitHub repository URL (e.g., https://github.com/facebook/react)..."
              value={newRepoUrl}
              onChange={(e) => setNewRepoUrl(e.target.value)}
              className="add-repo-input"
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting || !newRepoUrl.trim()}
              className="add-repo-btn"
            >
              {isSubmitting ? 'Verifying...' : '+ Add Repository'}
            </Button>
          </form>

          {error && <div className="add-repo-error">{error}</div>}
          {successMsg && <div className="add-repo-success">{successMsg}</div>}
        </div>

        {/* Repositories Grid */}
        {isLoading ? (
          <div className="page-loading-state">
            <div className="spinner"></div>
            <p>Loading repositories...</p>
          </div>
        ) : repositories.length === 0 ? (
          <div className="page-empty-state">
            <span className="empty-state-icon">📁</span>
            <h3>No repositories added yet</h3>
            <p>Paste a GitHub repository URL above or try the sample pull request from the home page.</p>
          </div>
        ) : (
          <div className="repos-grid">
            {repositories.map((repo) => (
              <div
                key={repo.id}
                className="repo-card"
                onClick={() => navigate(`/repositories/${repo.id}`)}
              >
                <div className="repo-card-top">
                  <div className="repo-name-group">
                    <span className="repo-folder-icon">📂</span>
                    <h2 className="repo-card-name">{repo.fullName}</h2>
                  </div>
                  <span className={`repo-visibility-pill ${repo.isPrivate ? 'private' : 'public'}`}>
                    {repo.isPrivate ? 'Private' : 'Public'}
                  </span>
                </div>

                <div className="repo-card-details">
                  <span className="repo-branch-meta">
                    Default: <code>{repo.defaultBranch}</code>
                  </span>
                  <span className="repo-prs-count">
                    {repo._count?.pullRequests || 0} tracked PRs
                  </span>
                </div>

                <div className="repo-card-footer">
                  <Link
                    to={`/repositories/${repo.id}`}
                    className="view-prs-link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Browse Pull Requests →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RepositoriesPage;
