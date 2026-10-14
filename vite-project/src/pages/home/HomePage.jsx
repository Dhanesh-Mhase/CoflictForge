import React from 'react';
import { LinkIcon, GitForkIcon, CloseIcon, CheckIcon } from '../../components/common/Icon';
import { Button } from '../../components/common/Button';
import { useRepoForm } from '../../hooks/useRepoForm';

/**
 * HomePage Component (KISS: Single cohesive file for the home landing view)
 * Matches the ConflictForge landing page screenshot in both Dark and Light modes.
 */
export const HomePage = () => {
  const {
    url,
    error,
    isLoading,
    analysisResult,
    handleChange,
    handleSubmit,
    fillSampleUrl,
    clearAnalysis,
  } = useRepoForm();

  return (
    <main className="hero-section" id="hero">
      <div className="hero-container">
        {/* 1. Headline & Narrative */}
        <div className="hero-header">
          <h1 className="hero-title">
            Resolve merge conflicts<br />
            without leaving the<br />
            browser.
          </h1>
          <p className="hero-description">
            Paste a GitHub pull request. ConflictForge explains why the branches clash,
            opens the conflicting code in a ready-made environment, and runs your tests
            before anything is merged.
          </p>
        </div>

        {/* 2. Repository / PR Input Capsule */}
        <div className="hero-action-block">
          <div className="repo-input-section">
            <label htmlFor="repo-url-input" className="repo-input-label">
              Repository or pull request link
            </label>

            <form onSubmit={handleSubmit} className="repo-input-form" noValidate>
              <div className={`repo-input-capsule ${error ? 'input-capsule-error' : ''}`}>
                <div className="repo-input-icon-slot">
                  <LinkIcon size={18} className="repo-link-icon" />
                </div>

                <input
                  id="repo-url-input"
                  type="url"
                  name="repoUrl"
                  value={url}
                  onChange={handleChange}
                  placeholder="https://github.com/owner/repo/pull/42"
                  autoComplete="off"
                  spellCheck="false"
                  className="repo-text-input"
                  aria-invalid={Boolean(error)}
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="repo-submit-btn"
                  disabled={isLoading}
                  aria-label="Try it out"
                >
                  {isLoading ? 'Analyzing...' : 'Try it out'}
                </Button>
              </div>
            </form>

            {error && (
              <div className="repo-error-message" role="alert">
                {error}
              </div>
            )}
          </div>

          {/* 3. Sample PR Trigger Link */}
          <p className="repo-helper-text">
            <span>Works with a repo link or a single pull request. </span>
            <button
              type="button"
              onClick={fillSampleUrl}
              className="sample-pr-link-btn"
              aria-label="Fill input with sample pull request"
            >
              Use the sample pull request
            </button>
          </p>
        </div>
      </div>

      {/* 4. Conflict Analysis Simulation Modal */}
      {analysisResult && (
        <div className="modal-backdrop" onClick={clearAnalysis} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-group">
                <GitForkIcon size={20} className="modal-git-icon" />
                <h2 className="modal-title">Conflict Analysis Ready</h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={clearAnalysis}
                aria-label="Close dialog"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="analysis-summary-badge">
                <span className="status-dot"></span>
                <span>Target: <strong>{analysisResult.repo || 'owner/repo/pull/42'}</strong></span>
              </div>

              <p className="analysis-desc">
                ConflictForge inspected the git merge base. 2 conflicting files were identified and an isolated container sandbox has been prepared in your browser:
              </p>

              <ul className="conflict-file-list">
                {analysisResult.conflictingFiles.map((file, idx) => (
                  <li key={idx} className="conflict-file-item">
                    <span className="file-status-indicator">CLASH</span>
                    <code className="file-path">{file}</code>
                  </li>
                ))}
              </ul>

              <div className="environment-check-box">
                <CheckIcon size={16} className="check-icon-accent" />
                <span>Browser test runner initialized: 14 passing, 2 merge blocks waiting for resolution.</span>
              </div>
            </div>

            <div className="modal-footer">
              <Button variant="outline" size="sm" onClick={clearAnalysis}>
                Back
              </Button>
              <Button variant="primary" size="sm" onClick={clearAnalysis}>
                Launch Browser Editor
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default HomePage;
