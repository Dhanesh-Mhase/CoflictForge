import React, { useRef, useEffect, useState } from 'react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';

export const MonacoDiffViewer = ({
  filePath,
  language = 'plaintext',
  baseSource = '',
  headSource = '',
  ancestorSource = '',
  baseSha = '',
  headSha = '',
  ancestorSha = '',
  activeConflict = null,
  viewMode = 'diff', // 'diff' | 'ancestor' | 'base' | 'head'
  onViewModeChange,
  isLoading = false,
}) => {
  const { theme } = useTheme();
  const diffEditorRef = useRef(null);
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  // In diff mode: allow comparing Base ↔ Head, Ancestor ↔ Head, or Ancestor ↔ Base
  const [diffComparison, setDiffComparison] = useState('base-head');

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  // Handle DiffEditor mount
  const handleDiffMount = (editor) => {
    diffEditorRef.current = editor;
  };

  // Handle single Editor mount
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  // Determine original (left) and modified (right) models for diff editor
  let diffOriginalSource = baseSource;
  let diffModifiedSource = headSource;
  let originalPaneLabel = 'Base (Target)';
  let modifiedPaneLabel = 'Head (PR)';

  if (diffComparison === 'ancestor-head') {
    diffOriginalSource = ancestorSource || '';
    diffModifiedSource = headSource;
    originalPaneLabel = `Ancestor (${ancestorSha ? ancestorSha.slice(0, 7) : 'Old Base'})`;
    modifiedPaneLabel = `Head (${headSha ? headSha.slice(0, 7) : 'PR'})`;
  } else if (diffComparison === 'ancestor-base') {
    diffOriginalSource = ancestorSource || '';
    diffModifiedSource = baseSource;
    originalPaneLabel = `Ancestor (${ancestorSha ? ancestorSha.slice(0, 7) : 'Old Base'})`;
    modifiedPaneLabel = `Base (${baseSha ? baseSha.slice(0, 7) : 'Target'})`;
  } else {
    originalPaneLabel = `Base (${baseSha ? baseSha.slice(0, 7) : 'Target'})`;
    modifiedPaneLabel = `Head (${headSha ? headSha.slice(0, 7) : 'PR'})`;
  }

  // Jump to conflict line and apply decorations when active conflict or mode changes
  useEffect(() => {
    if (viewMode === 'diff' && diffEditorRef.current) {
      const modifiedEditor = diffEditorRef.current.getModifiedEditor();
      const originalEditor = diffEditorRef.current.getOriginalEditor();
      if (!modifiedEditor) return;

      if (!activeConflict || !activeConflict.headStartLine) {
        decorationsRef.current = modifiedEditor.deltaDecorations(decorationsRef.current, []);
        return;
      }

      const targetModifiedLine =
        diffComparison === 'ancestor-base'
          ? activeConflict.baseStartLine || 1
          : activeConflict.headStartLine || 1;
      const targetEndLine =
        diffComparison === 'ancestor-base'
          ? activeConflict.baseEndLine || targetModifiedLine
          : activeConflict.headEndLine || targetModifiedLine;

      modifiedEditor.revealLineInCenter(targetModifiedLine);

      // Decorate conflict line range in Modified editor
      decorationsRef.current = modifiedEditor.deltaDecorations(decorationsRef.current, [
        {
          range: {
            startLineNumber: targetModifiedLine,
            startColumn: 1,
            endLineNumber: targetEndLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: 'monaco-conflict-highlight-head',
            glyphMarginClassName: 'monaco-conflict-glyph-head',
          },
        },
      ]);

      if (originalEditor && activeConflict.baseStartLine) {
        originalEditor.revealLineInCenter(activeConflict.baseStartLine);
      }
    } else if (editorRef.current && activeConflict) {
      const targetLine =
        viewMode === 'base'
          ? activeConflict.baseStartLine
          : viewMode === 'head'
          ? activeConflict.headStartLine
          : activeConflict.baseStartLine || activeConflict.headStartLine || 1;
      if (targetLine) {
        editorRef.current.revealLineInCenter(targetLine);
      }
    }
  }, [activeConflict, viewMode, diffComparison, filePath]);

  // Value for single editor view
  const singleEditorValue =
    viewMode === 'ancestor'
      ? (ancestorSource || '// [File did not exist in common ancestor commit]')
      : viewMode === 'base'
      ? baseSource
      : headSource;

  return (
    <div className="monaco-viewer-card">
      {/* Viewer Top Header Bar */}
      <div className="monaco-viewer-header">
        <div className="monaco-file-info">
          <span className="monaco-file-icon">📄</span>
          <span className="monaco-file-path">{filePath || 'No file selected'}</span>
          <span className="monaco-lang-pill">{language}</span>
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="monaco-view-switcher">
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'diff' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('diff')}
            title="Side-by-side comparison"
          >
            Diff (Side-by-Side)
          </button>
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'ancestor' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('ancestor')}
            title="View Common Ancestor (Old Base) commit"
          >
            Ancestor (Old Base)
          </button>
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'base' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('base')}
            title="View Target Base branch"
          >
            Base (Target)
          </button>
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'head' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('head')}
            title="View Incoming PR Head branch"
          >
            Head (PR)
          </button>
        </div>
      </div>

      {/* Subheader Toolbar: Diff Comparison Pairs or Single View Banners */}
      {viewMode === 'diff' ? (
        <div className="monaco-diff-subbar">
          <div className="diff-pair-toggle">
            <span className="diff-pair-label">Compare:</span>
            <button
              type="button"
              className={`diff-pair-btn ${diffComparison === 'base-head' ? 'active' : ''}`}
              onClick={() => setDiffComparison('base-head')}
              title="Compare Target Base against PR Head (Standard Merge Conflict Diff)"
            >
              Base ↔ Head (Merge Clash)
            </button>
            <button
              type="button"
              className={`diff-pair-btn ${diffComparison === 'ancestor-head' ? 'active' : ''}`}
              onClick={() => setDiffComparison('ancestor-head')}
              title="Compare Old Base against PR Head (Changes introduced by this PR)"
            >
              Ancestor ↔ Head (PR Changes)
            </button>
            <button
              type="button"
              className={`diff-pair-btn ${diffComparison === 'ancestor-base' ? 'active' : ''}`}
              onClick={() => setDiffComparison('ancestor-base')}
              title="Compare Old Base against Target Base (Changes introduced upstream)"
            >
              Ancestor ↔ Base (Upstream Changes)
            </button>
          </div>
          <div className="diff-pane-labels">
            <span className="pane-tag original">◀ {originalPaneLabel}</span>
            <span className="pane-tag modified">▶ {modifiedPaneLabel}</span>
          </div>
        </div>
      ) : (
        <div className={`monaco-view-context-banner ${viewMode}`}>
          {viewMode === 'ancestor' && (
            <>
              <span className="banner-icon">🕰️</span>
              <span className="banner-text">
                Viewing <strong>Common Ancestor (Old Base)</strong>
                {ancestorSha ? ` at commit ${ancestorSha.slice(0, 7)}` : ''} — file state before either branch diverged.
              </span>
              {!ancestorSource && !isLoading && (
                <span className="banner-tag warning">File did not exist in merge-base</span>
              )}
            </>
          )}
          {viewMode === 'base' && (
            <>
              <span className="banner-icon">🎯</span>
              <span className="banner-text">
                Viewing <strong>Target Base branch</strong>
                {baseSha ? ` at commit ${baseSha.slice(0, 7)}` : ''}.
              </span>
            </>
          )}
          {viewMode === 'head' && (
            <>
              <span className="banner-icon">🚀</span>
              <span className="banner-text">
                Viewing <strong>Incoming PR Head branch</strong>
                {headSha ? ` at commit ${headSha.slice(0, 7)}` : ''}.
              </span>
            </>
          )}
        </div>
      )}

      {/* Editor Surface */}
      <div className="monaco-editor-surface">
        {isLoading ? (
          <div className="monaco-loading-state">
            <div className="spinner"></div>
            <span>Fetching exact source at analyzed SHAs...</span>
          </div>
        ) : viewMode === 'diff' ? (
          <DiffEditor
            key={`diff-${diffComparison}`}
            height="100%"
            language={language}
            original={diffOriginalSource}
            modified={diffModifiedSource}
            theme={editorTheme}
            onMount={handleDiffMount}
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              renderOverviewRuler: false,
              lineNumbersMinChars: 3,
            }}
          />
        ) : (
          <Editor
            key={`single-${viewMode}`}
            height="100%"
            language={language}
            value={singleEditorValue}
            theme={editorTheme}
            onMount={handleEditorMount}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              lineNumbersMinChars: 3,
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MonacoDiffViewer;
