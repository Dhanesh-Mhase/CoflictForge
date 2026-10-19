import React from 'react';
import { LinkIcon } from '../../components/common/Icon';
import { Button } from '../../components/common/Button';
import { useRepoForm } from '../../hooks/useRepoForm';

/**
 * HomePage Component
 * Matches the ConflictForge landing page screenshot with live API integration and instant navigation.
 */
export const HomePage = ({ onLoginClick }) => {
  const {
    url,
    error,
    isLoading,
    handleChange,
    handleSubmit,
    fillSampleUrl,
  } = useRepoForm('', onLoginClick);

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
                  {isLoading ? 'Connecting...' : 'Try it out'}
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
    </main>
  );
};

export default HomePage;
