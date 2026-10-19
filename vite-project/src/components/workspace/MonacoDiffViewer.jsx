import React, { useRef, useEffect } from 'react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import { useTheme } from '../../context/ThemeContext';

export const MonacoDiffViewer = ({
  filePath,
  language = 'plaintext',
  baseSource = '',
  headSource = '',
  activeConflict = null,
  viewMode = 'diff', // 'diff' | 'base' | 'head'
  onViewModeChange,
  isLoading = false,
}) => {
  const { theme } = useTheme();
  const diffEditorRef = useRef(null);
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  const editorTheme = theme === 'dark' ? 'vs-dark' : 'light';

  // Handle DiffEditor mount
  const handleDiffMount = (editor) => {
    diffEditorRef.current = editor;
  };

  // Handle single Editor mount
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  // Jump to conflict line and apply decorations when active conflict changes
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

      // Decorate conflict line range in Head (Modified) editor
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
      if (targetLine) {
        editorRef.current.revealLineInCenter(targetLine);
      }
    }
  }, [activeConflict, viewMode, filePath]);

  return (
    <div className="monaco-viewer-card">
      {/* Viewer Header Bar */}
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
          >
            Diff (Side-by-Side)
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
    </div>
  );
};

export default MonacoDiffViewer;
