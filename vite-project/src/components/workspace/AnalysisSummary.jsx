import React from 'react';
import { Link } from 'react-router-dom';

export const AnalysisSummary = ({
  repository,
  pullRequest,
  onReanalyze,
  isAnalyzing = false,
}) => {
  if (!pullRequest) return null;

  const status = pullRequest.analysisStatus || 'NOT_ANALYZED';
  const isStale = Boolean(pullRequest.isStale);

  return (
    <div className="workspace-top-bar">
      <div className="top-bar-left">
        <div className="workspace-breadcrumbs">
          <Link to="/repositories" className="crumb-link">
            Repositories
          </Link>
          <span className="crumb-sep">/</span>
          <Link to={`/repositories/${repository?.id}`} className="crumb-link">
            {repository?.fullName || `${repository?.owner}/${repository?.name}`}
          </Link>
          <span className="crumb-sep">/</span>
          <span className="crumb-active">PR #{pullRequest.githubPrNumber}</span>
        </div>

        <div className="pr-title-row">
          <h1 className="pr-heading">
            #{pullRequest.githubPrNumber}: {pullRequest.title}
          </h1>

          <div className="branch-meta-capsule">
            <code className="branch-tag base">{pullRequest.baseBranch}</code>
            <span className="branch-arrow">←</span>
            <code className="branch-tag head">{pullRequest.headBranch}</code>
          </div>
        </div>
      </div>

      <div className="top-bar-right">
        {/* Status Badges */}
        <div className="status-badges-group">
          {isStale && (
            <span className="badge-stale" title="New commits were pushed since this analysis was performed.">
              ⚠️ Stale Findings
            </span>
          )}

          <span className={`badge-status status-${status.toLowerCase()}`}>
            {(status === 'RUNNING' || isAnalyzing) && <span className="status-spinner"></span>}
            {isAnalyzing ? 'RUNNING' : status}
          </span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onReanalyze}
          disabled={isAnalyzing || status === 'RUNNING'}
          className={`reanalyze-btn ${status === 'NOT_ANALYZED' ? 'cta-highlight' : ''}`}
        >
          {isAnalyzing || status === 'RUNNING'
            ? 'Analyzing...'
            : status === 'NOT_ANALYZED'
            ? '⚡ Analyze PR'
            : 'Re-analyze PR'}
        </button>
      </div>
    </div>
  );
};

export default AnalysisSummary;
