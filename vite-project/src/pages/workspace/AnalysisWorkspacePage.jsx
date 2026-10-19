import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import repositoriesApi from '../../api/repositories.api';
import pullRequestsApi from '../../api/pull-requests.api';
import analysisApi from '../../api/analysis.api';
import AnalysisSummary from '../../components/workspace/AnalysisSummary';
import ConflictList from '../../components/workspace/ConflictList';
import MonacoDiffViewer from '../../components/workspace/MonacoDiffViewer';
import ConflictChatPanel from '../../components/workspace/ConflictChatPanel';

export const AnalysisWorkspacePage = () => {
  const { repositoryId, prNumber } = useParams();

  const [repository, setRepository] = useState(null);
  const [pullRequest, setPullRequest] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [changedFiles, setChangedFiles] = useState([]);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [activeConflict, setActiveConflict] = useState(null);

  const [sourceData, setSourceData] = useState(null);
  const [viewMode, setViewMode] = useState('diff'); // 'diff' | 'base' | 'head'

  const [isLoadingPR, setIsLoadingPR] = useState(true);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const hasAutoAnalyzed = useRef(false);

  // 1. Fetch Repository, PR, and Conflict findings
  const loadWorkspaceData = useCallback(async () => {
    setIsLoadingPR(true);
    setErrorMessage('');
    try {
      const [repoData, prData, conflictData] = await Promise.all([
        repositoriesApi.getRepository(repositoryId),
        pullRequestsApi.getPullRequest(repositoryId, prNumber),
        analysisApi.getConflicts(repositoryId, prNumber).catch(() => ({ conflicts: [] })),
      ]);

      setRepository(repoData);
      setPullRequest(prData);

      const loadedConflicts = conflictData?.conflicts || [];
      setConflicts(loadedConflicts);

      // Collect changed files from PR or conflicts endpoint
      const allFiles =
        prData?.changedFiles?.length > 0
          ? prData.changedFiles
          : conflictData?.changedFiles || [];
      setChangedFiles(allFiles);

      // Determine initial active file and conflict
      if (loadedConflicts.length > 0) {
        setActiveConflict(loadedConflicts[0]);
        setSelectedFilePath(loadedConflicts[0].filePath);
      } else if (allFiles.length > 0) {
        const firstFile = allFiles[0].filename || allFiles[0].filePath || '';
        setSelectedFilePath(firstFile);
        setActiveConflict(null);
      }

      // Auto-trigger analysis once if PR has never been analyzed
      if (
        !hasAutoAnalyzed.current &&
        prData?.analysisStatus === 'NOT_ANALYZED'
      ) {
        hasAutoAnalyzed.current = true;
        // Trigger in background so initial diff loads immediately
        runAnalysis();
      }
    } catch (err) {
      console.error('Failed to load workspace data:', err);
      setErrorMessage(
        err.response?.data?.message || 'Failed to load pull request and analysis details.'
      );
    } finally {
      setIsLoadingPR(false);
    }
  }, [repositoryId, prNumber]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // 2. Fetch Source code for Monaco when selectedFilePath changes
  useEffect(() => {
    if (!selectedFilePath || !repositoryId || !prNumber) return;

    let isMounted = true;
    setIsLoadingSource(true);

    analysisApi
      .getSource(repositoryId, prNumber, selectedFilePath)
      .then((data) => {
        if (isMounted) {
          setSourceData(data);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch source code for file:', selectedFilePath, err);
        if (isMounted) {
          setSourceData({
            filePath: selectedFilePath,
            language: 'plaintext',
            baseSource: activeConflict?.baseCode || '',
            headSource: activeConflict?.headCode || '',
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingSource(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedFilePath, repositoryId, prNumber, activeConflict?.baseCode, activeConflict?.headCode]);

  // 3. Selection Handlers
  const handleSelectFile = (filePath) => {
    setSelectedFilePath(filePath);
    const fileConflicts = conflicts.filter((c) => c.filePath === filePath);
    if (fileConflicts.length > 0) {
      setActiveConflict(fileConflicts[0]);
    } else {
      setActiveConflict(null);
    }
  };

  const handleSelectConflict = (conflict) => {
    setActiveConflict(conflict);
    if (conflict?.filePath && conflict.filePath !== selectedFilePath) {
      setSelectedFilePath(conflict.filePath);
    }
  };

  // 4. Analysis trigger function
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage('');
    try {
      const result = await analysisApi.triggerAnalysis(repositoryId, prNumber);
      setPullRequest(result);

      const conflictRes = await analysisApi.getConflicts(repositoryId, prNumber);
      const newConflicts = conflictRes?.conflicts || [];
      setConflicts(newConflicts);

      if (conflictRes?.changedFiles?.length) {
        setChangedFiles(conflictRes.changedFiles);
      }

      if (newConflicts.length > 0) {
        setActiveConflict(newConflicts[0]);
        setSelectedFilePath(newConflicts[0].filePath);
      }
    } catch (err) {
      console.error('Analysis execution failed:', err);
      setErrorMessage(
        err.response?.data?.message || 'Analysis failed. Please check repository access.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoadingPR) {
    return (
      <div className="workspace-loading-fullscreen">
        <div className="spinner"></div>
        <p>Loading ConflictForge Analysis Workspace...</p>
      </div>
    );
  }

  if (errorMessage && !pullRequest) {
    return (
      <div className="workspace-error-container">
        <h2>Unable to load workspace</h2>
        <p>{errorMessage}</p>
        <button type="button" onClick={loadWorkspaceData} className="reanalyze-btn">
          Try Again
        </button>
      </div>
    );
  }

  const currentFilePath = selectedFilePath || sourceData?.filePath || activeConflict?.filePath || '';

  return (
    <div className="analysis-workspace-page">
      {/* Top Bar / Header */}
      <AnalysisSummary
        repository={repository}
        pullRequest={pullRequest}
        onReanalyze={runAnalysis}
        isAnalyzing={isAnalyzing}
      />

      {errorMessage && (
        <div className="workspace-error-banner" role="alert">
          <span>⚠️ {errorMessage}</span>
          <button type="button" onClick={() => setErrorMessage('')}>✕</button>
        </div>
      )}

      {/* 3-Panel Workspace Grid */}
      <div className="workspace-main-grid">
        {/* Panel 1: Conflicting & Changed Files Tree */}
        <ConflictList
          conflicts={conflicts}
          changedFiles={changedFiles}
          selectedFilePath={currentFilePath}
          activeConflictId={activeConflict?.id}
          analysisStatus={pullRequest?.analysisStatus || 'NOT_ANALYZED'}
          isAnalyzing={isAnalyzing}
          onSelectConflict={handleSelectConflict}
          onSelectFile={handleSelectFile}
          onReanalyze={runAnalysis}
        />

        {/* Panel 2: Monaco Diff Editor */}
        <section className="workspace-editor-column">
          <MonacoDiffViewer
            filePath={currentFilePath}
            language={sourceData?.language || 'javascript'}
            baseSource={sourceData?.baseSource || ''}
            headSource={sourceData?.headSource || ''}
            activeConflict={activeConflict}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isLoading={isLoadingSource}
          />
        </section>

        {/* Panel 3: AI Explanation & Contextual Chat */}
        <aside className="workspace-chat-column">
          <ConflictChatPanel
            repositoryId={repositoryId}
            prNumber={prNumber}
            conflict={activeConflict}
            selectedFilePath={currentFilePath}
            analysisStatus={pullRequest?.analysisStatus || 'NOT_ANALYZED'}
            isAnalyzing={isAnalyzing}
            onReanalyze={runAnalysis}
          />
        </aside>
      </div>
    </div>
  );
};

export default AnalysisWorkspacePage;

