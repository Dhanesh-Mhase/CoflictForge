import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import repositoriesApi from '../../api/repositories.api';
import pullRequestsApi from '../../api/pull-requests.api';
import analysisApi from '../../api/analysis.api';

export const PullRequestOverviewPage = () => {
  const { repositoryId } = useParams();
  const navigate = useNavigate();

  const [repository, setRepository] = useState(null);
  const [pullRequests, setPullRequests] = useState([]);
  const [stateFilter, setStateFilter] = useState('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [analyzingPrId, setAnalyzingPrId] = useState(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [repoData, prsData] = await Promise.all([
        repositoriesApi.getRepository(repositoryId),
        pullRequestsApi.getPullRequests(repositoryId, { state: stateFilter }),
      ]);
      console.log(repoData);
      console.log(prsData);
      setRepository(repoData);
      setPullRequests(prsData);
    } catch (err) {
      console.error('Error loading PRs:', err);
      setError(err.response?.data?.message || 'Failed to load pull requests for repository.');
    } finally {
      setIsLoading(false);
    }
  }, [repositoryId, stateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuickAnalyze = async (prNumber, e) => {
    e.stopPropagation();
    setAnalyzingPrId(prNumber);
    try {
      await analysisApi.triggerAnalysis(repositoryId, prNumber);
      navigate(`/repositories/${repositoryId}/pull-requests/${prNumber}/analysis`);
    } catch (err) {
      alert(err.response?.data?.message || 'Analysis failed to start.');
      setAnalyzingPrId(null);
    }
  };

  const filteredPrs = pullRequests.filter((pr) => {
    const query = searchQuery.toLowerCase();
    return (
      pr.title?.toLowerCase().includes(query) ||
      pr.githubPrNumber?.toString().includes(query) ||
      pr.headBranch?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="pr-overview-page">
      <div className="pr-overview-container">
        {/* Breadcrumb & Repo Header */}
        <div className="pr-page-header">
          <div className="repo-breadcrumb">
            <Link to="/repositories">Repositories</Link>
            <span>/</span>
            <span>{repository?.fullName || `${repository?.owner}/${repository?.name}`}</span>
          </div>

          <div className="repo-header-info">
            <div>
              <h1 className="repo-title-heading">{repository?.fullName}</h1>
              <p className="repo-sub-info">
                Default branch: <code>{repository?.defaultBranch || 'main'}</code> ·{' '}
                <a href={repository?.url} target="_blank" rel="noopener noreferrer">
                  View on GitHub ↗
                </a>
              </p>
            </div>

            {/* Filter Pills */}
            <div className="pr-filter-controls">
              <button
                type="button"
                className={`filter-pill ${stateFilter === 'open' ? 'active' : ''}`}
                onClick={() => setStateFilter('open')}
              >
                Open PRs
              </button>
              <button
                type="button"
                className={`filter-pill ${stateFilter === 'closed' ? 'active' : ''}`}
                onClick={() => setStateFilter('closed')}
              >
                Closed PRs
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="pr-search-bar">
          <input
            type="text"
            placeholder="Search pull requests by title, number, or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-search-input"
          />
        </div>

        {error && <div className="page-error-alert">{error}</div>}

        {/* PR List */}
        {isLoading ? (
          <div className="page-loading-state">
            <div className="spinner"></div>
            <p>Fetching pull requests from GitHub...</p>
          </div>
        ) : filteredPrs.length === 0 ? (
          <div className="page-empty-state">
            <span className="empty-state-icon">📭</span>
            <h3>No {stateFilter} pull requests found</h3>
            <p>
              {pullRequests.length === 0
                ? 'There are currently no pull requests matching this state in the repository.'
                : 'No pull requests match your search filter.'}
            </p>
          </div>
        ) : (
          <div className="pr-cards-list">
            {filteredPrs.map((pr) => {
              const status = pr.analysisStatus || 'NOT_ANALYZED';
              const isStale = Boolean(pr.isStale);
              const isAnalyzingThis = analyzingPrId === pr.githubPrNumber;

              return (
                <div
                  key={pr.id || pr.githubPrNumber}
                  className="pr-card-row"
                  onClick={() =>
                    navigate(`/repositories/${repositoryId}/pull-requests/${pr.githubPrNumber}/analysis`)
                  }
                >
                  <div className="pr-card-main">
                    <div className="pr-card-header">
                      <span className="pr-number-tag">#{pr.githubPrNumber}</span>
                      <h3 className="pr-card-title">{pr.title}</h3>
                    </div>

                    <div className="pr-card-meta">
                      <div className="pr-branches">
                        <code>{pr.baseBranch}</code> ← <code>{pr.headBranch}</code>
                      </div>

                      {pr.user && (
                        <span className="pr-author">
                          by <strong>{pr.user.login}</strong>
                        </span>
                      )}

                      {pr.mergeable !== null && (
                        <span
                          className={`mergeable-pill ${pr.mergeable ? 'mergeable-yes' : 'mergeable-no'
                            }`}
                        >
                          {pr.mergeable ? 'GitHub: Mergeable' : 'GitHub: Conflicting'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pr-card-actions">
                    {/* Status & Staleness Badges */}
                    <div className="pr-status-group">
                      {isStale && <span className="badge-stale">⚠️ Stale</span>}
                      <span className={`badge-status status-${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      className="pr-open-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(
                          `/repositories/${repositoryId}/pull-requests/${pr.githubPrNumber}/analysis`
                        );
                      }}
                    >
                      {status === 'COMPLETED' ? 'View Workspace' : 'Inspect & Analyze'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PullRequestOverviewPage;
