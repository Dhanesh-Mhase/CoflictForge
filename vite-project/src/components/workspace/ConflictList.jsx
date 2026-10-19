import React, { useState } from 'react';

export const ConflictList = ({
  conflicts = [],
  changedFiles = [],
  selectedFilePath = '',
  activeConflictId = null,
  analysisStatus = 'NOT_ANALYZED',
  isAnalyzing = false,
  onSelectConflict,
  onSelectFile,
  onReanalyze,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  // 1. Group conflicts by filePath
  const groupedConflicts = conflicts.reduce((acc, conflict) => {
    if (!acc[conflict.filePath]) {
      acc[conflict.filePath] = [];
    }
    acc[conflict.filePath].push(conflict);
    return acc;
  }, {});

  const conflictingPathsSet = new Set(Object.keys(groupedConflicts));
  const conflictingFiles = Object.keys(groupedConflicts);

  // 2. Identify clean files from PR changed files
  const cleanFiles = changedFiles.filter((f) => {
    const name = f.filename || f.filePath || '';
    return name && !conflictingPathsSet.has(name);
  });

  // 3. Apply search filter
  const query = filterQuery.toLowerCase();
  const filteredConflictingFiles = conflictingFiles.filter((path) =>
    path.toLowerCase().includes(query)
  );
  const filteredCleanFiles = cleanFiles.filter((f) => {
    const name = f.filename || f.filePath || '';
    return name.toLowerCase().includes(query);
  });

  const totalFilesCount = new Set([
    ...conflictingFiles,
    ...cleanFiles.map((f) => f.filename || f.filePath),
  ]).size;

  return (
    <aside className="workspace-conflict-list-panel">
      {/* Panel Header */}
      <div className="conflict-list-header">
        <div className="conflict-list-title-row">
          <span
            className={`conflict-count-badge ${
              conflicts.length === 0 ? 'zero-clashes' : ''
            }`}
          >
            {conflicts.length} {conflicts.length === 1 ? 'Clash' : 'Clashes'}
          </span>
          <span className="file-count-label">
            in {totalFilesCount} {totalFilesCount === 1 ? 'file' : 'files'}
          </span>
        </div>

        {/* Search / Filter Input */}
        <input
          type="text"
          placeholder="Filter files..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          className="conflict-search-input"
        />
      </div>

      {/* Analysis Status Banners */}
      {isAnalyzing && (
        <div className="conflict-list-analyzing-banner">
          <span className="status-spinner"></span>
          <span>Running 3-Way AST & AI analysis...</span>
        </div>
      )}

      {!isAnalyzing && analysisStatus === 'NOT_ANALYZED' && (
        <div className="conflict-list-pending-banner">
          <div className="pending-text">
            <strong>⚡ Analysis Pending</strong>
            <p>Scan for merge conflicts and AST symbol impacts.</p>
          </div>
          <button
            type="button"
            onClick={onReanalyze}
            className="pending-analyze-btn"
          >
            Analyze Now
          </button>
        </div>
      )}

      {/* Panel Body */}
      <div className="conflict-list-body">
        {filteredConflictingFiles.length === 0 &&
        filteredCleanFiles.length === 0 ? (
          <div className="empty-conflicts-state">
            {conflicts.length === 0 && cleanFiles.length === 0 ? (
              <>
                <span className="clean-check-icon">📂</span>
                <p className="clean-label">No files found</p>
                <span className="clean-subtext">
                  This pull request has no modified files.
                </span>
              </>
            ) : (
              <p className="no-matches-label">No files match your filter.</p>
            )}
          </div>
        ) : (
          <div className="conflict-files-sections">
            {/* SECTION 1: Conflicting Files */}
            {filteredConflictingFiles.length > 0 && (
              <div className="files-section">
                <div className="files-section-title">
                  <span>⚠️ Conflicting Files ({filteredConflictingFiles.length})</span>
                </div>

                <ul className="conflict-files-tree">
                  {filteredConflictingFiles.map((filePath) => {
                    const fileConflicts = groupedConflicts[filePath] || [];
                    const highestRisk = fileConflicts.some((c) => c.risk === 'HIGH')
                      ? 'HIGH'
                      : fileConflicts.some((c) => c.risk === 'MEDIUM')
                      ? 'MEDIUM'
                      : 'LOW';

                    const isFileActive = selectedFilePath === filePath;

                    return (
                      <li key={filePath} className="conflict-file-group">
                        <div
                          className={`conflict-file-header ${
                            isFileActive ? 'selected-file' : ''
                          }`}
                          onClick={() => onSelectFile?.(filePath)}
                          title="Click to view file diff"
                        >
                          <span className="file-icon">📄</span>
                          <span className="file-name" title={filePath}>
                            {filePath}
                          </span>
                          <span
                            className={`risk-badge risk-${highestRisk.toLowerCase()}`}
                          >
                            {highestRisk}
                          </span>
                        </div>

                        <ul className="conflict-chunks-list">
                          {fileConflicts.map((c, index) => {
                            const isChunkActive = activeConflictId === c.id;
                            return (
                              <li
                                key={c.id || index}
                                className={`conflict-chunk-item ${
                                  isChunkActive ? 'active' : ''
                                }`}
                                onClick={() => onSelectConflict?.(c)}
                              >
                                <div className="chunk-indicator"></div>
                                <div className="chunk-info">
                                  <span className="chunk-scope">
                                    {c.astContext?.scope ||
                                      `Conflict Region #${index + 1}`}
                                  </span>
                                  <span className="chunk-lines">
                                    Base: L{c.baseStartLine}-{c.baseEndLine} · Head: L
                                    {c.headStartLine}-{c.headEndLine}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* SECTION 2: Clean Files */}
            {filteredCleanFiles.length > 0 && (
              <div className="files-section">
                <div className="files-section-title clean">
                  <span>
                    {analysisStatus === 'NOT_ANALYZED'
                      ? `Changed Files (${filteredCleanFiles.length})`
                      : `Clean Files (${filteredCleanFiles.length})`}
                  </span>
                </div>

                <ul className="clean-files-list">
                  {filteredCleanFiles.map((file) => {
                    const filename = file.filename || file.filePath || '';
                    const isFileActive =
                      selectedFilePath === filename && !activeConflictId;

                    return (
                      <li
                        key={filename}
                        className={`clean-file-item ${
                          isFileActive ? 'active' : ''
                        }`}
                        onClick={() => onSelectFile?.(filename)}
                        title="Click to view file diff"
                      >
                        <span className="file-icon">📄</span>
                        <span className="file-name" title={filename}>
                          {filename}
                        </span>

                        <div className="clean-file-meta">
                          {analysisStatus === 'NOT_ANALYZED' ? (
                            <span className="badge-pending-tag">Pending</span>
                          ) : (
                            <span className="badge-clean-tag">✓ Clean</span>
                          )}

                          {file.additions !== undefined && (
                            <span className="diff-stat-add" title="Lines added">
                              +{file.additions}
                            </span>
                          )}
                          {file.deletions !== undefined && file.deletions > 0 && (
                            <span className="diff-stat-del" title="Lines deleted">
                              -{file.deletions}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

export default ConflictList;

