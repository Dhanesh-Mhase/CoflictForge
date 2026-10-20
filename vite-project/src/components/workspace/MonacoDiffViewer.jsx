import React, { useRef, useEffect } from 'react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';

export const MonacoDiffViewer = ({
  filePath,
  language = 'plaintext',
  baseSource = '',
  headSource = '',
  activeConflict = null,
  viewMode = 'diff', // 'diff' | 'base' | 'head' | 'resolve'
  onViewModeChange,
  isLoading = false,
  // Editable resolved code props
  resolvedSource = '',
  onResolvedSourceChange,
  // Sandbox props
  onRunTests,
  onPushResolution,
  sandboxStatus = null,
  isPushing = false,
}) => {
  const { theme } = useTheme();
  const diffEditorRef = useRef(null);
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  const handleDiffMount = (editor) => { diffEditorRef.current = editor; };
  const handleEditorMount = (editor) => { editorRef.current = editor; };

  useEffect(() => {
    if (viewMode === 'diff' && diffEditorRef.current) {
      const modifiedEditor = diffEditorRef.current.getModifiedEditor();
      const originalEditor = diffEditorRef.current.getOriginalEditor();
      if (!modifiedEditor) return;

      if (!activeConflict || !activeConflict.headStartLine) {
        decorationsRef.current = modifiedEditor.deltaDecorations(decorationsRef.current, []);
        return;
      }

      modifiedEditor.revealLineInCenter(activeConflict.headStartLine);
      decorationsRef.current = modifiedEditor.deltaDecorations(decorationsRef.current, [
        {
          range: {
            startLineNumber: activeConflict.headStartLine,
            startColumn: 1,
            endLineNumber: activeConflict.headEndLine || activeConflict.headStartLine,
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
        viewMode === 'base' ? activeConflict.baseStartLine : activeConflict.headStartLine;
      if (targetLine) editorRef.current.revealLineInCenter(targetLine);
    }
  }, [activeConflict, viewMode, filePath]);

  const isRunning = ['PROVISIONING', 'CLONING', 'RUNNING_TESTS'].includes(sandboxStatus);
  const hasPassed = sandboxStatus === 'PASSED';

  const runTestsLabel = isRunning
    ? ({ PROVISIONING: '⚙️ Provisioning…', CLONING: '📦 Cloning…', RUNNING_TESTS: '🧪 Running…' })[sandboxStatus]
    : '🧪 Run Tests';

  return (
    <div className="monaco-viewer-card">
      {/* Viewer Header Bar */}
      <div className="monaco-viewer-header">
        <div className="monaco-file-info">
          <span className="monaco-file-icon">📄</span>
          <span className="monaco-file-path">{filePath || 'No file selected'}</span>
          <span className="monaco-lang-pill">{language}</span>
        </div>

        <div className="monaco-view-switcher">
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'diff' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('diff')}
          >
            Diff (Side-by-Side)
          </button>
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'resolve' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('resolve')}
            title="Edit and fix the conflict directly in the browser"
          >
            ✏️ Resolve (Editor)
          </button>
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'base' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('base')}
          >
            Base (Target)
          </button>
          <button
            type="button"
            className={`monaco-mode-btn ${viewMode === 'head' ? 'active' : ''}`}
            onClick={() => onViewModeChange?.('head')}
          >
            Head (PR)
          </button>
        </div>
      </div>

      {/* Editor Surface */}
      <div className="monaco-editor-surface">
        {isLoading ? (
          <div className="monaco-loading-state">
            <div className="spinner"></div>
            <span>Fetching exact source at analyzed SHAs...</span>
          </div>
        ) : viewMode === 'diff' ? (
          <DiffEditor
            height="100%"
            language={language}
            original={baseSource}
            modified={headSource}
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
        ) : viewMode === 'resolve' ? (
          <Editor
            height="100%"
            language={language}
            value={resolvedSource}
            onChange={(val) => onResolvedSourceChange?.(val || '')}
            theme={editorTheme}
            options={{
              readOnly: false,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              lineNumbersMinChars: 3,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={language}
            value={viewMode === 'base' ? baseSource : headSource}
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

      {/* Sandbox Action Bar */}
      {onRunTests && (
        <div className="sandbox-action-bar">
          <span className="sandbox-action-label">
            {hasPassed
              ? '✅ Tests passed — resolution is validated'
              : sandboxStatus === 'FAILED'
              ? '❌ Tests failed — fix conflicts and retry'
              : sandboxStatus === 'ERROR'
              ? '🔥 Sandbox error — retry'
              : activeConflict
              ? `Validate fix for: ${activeConflict.filePath}`
              : 'Select a conflict to run tests'}
          </span>

          <button
            type="button"
            className="btn-run-tests"
            onClick={onRunTests}
            disabled={isRunning || !activeConflict}
            title="Provision a Docker sandbox, clone the repo, and run the test suite"
          >
            {runTestsLabel}
          </button>

          <button
            type="button"
            className="btn-push-resolution"
            onClick={onPushResolution}
            disabled={!hasPassed || isPushing}
            title="Push the resolved file(s) to the PR branch on GitHub"
          >
            {isPushing ? '⏳ Pushing…' : '🚀 Push Resolution'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MonacoDiffViewer;
