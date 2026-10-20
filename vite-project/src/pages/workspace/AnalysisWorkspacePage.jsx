import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import repositoriesApi from '../../api/repositories.api';
import pullRequestsApi from '../../api/pull-requests.api';
import analysisApi from '../../api/analysis.api';
import sandboxApi from '../../api/sandbox.api';
import AnalysisSummary from '../../components/workspace/AnalysisSummary';
import ConflictList from '../../components/workspace/ConflictList';
import MonacoDiffViewer from '../../components/workspace/MonacoDiffViewer';
import ConflictChatPanel from '../../components/workspace/ConflictChatPanel';
import SandboxTerminal from '../../components/workspace/SandboxTerminal';

export const AnalysisWorkspacePage = () => {
  const { repositoryId, prNumber } = useParams();

  const [repository, setRepository] = useState(null);
  const [pullRequest, setPullRequest] = useState(null);
  const [conflicts, setConflicts] = useState([]);
  const [changedFiles, setChangedFiles] = useState([]);
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [activeConflict, setActiveConflict] = useState(null);

  const [sourceData, setSourceData] = useState(null);
  const [viewMode, setViewMode] = useState('diff');
  const [resolvedCodeMap, setResolvedCodeMap] = useState({});

  const [isLoadingPR, setIsLoadingPR] = useState(true);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // ── Sandbox state ────────────────────────────────────────────────────────
  const [sandboxId, setSandboxId] = useState(null);
  const [sandboxStatus, setSandboxStatus] = useState(null);
  const [sandboxLogs, setSandboxLogs] = useState('');
  const [showTerminal, setShowTerminal] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const sseRef = useRef(null); // SSE connection handle

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

      const allFiles =
        prData?.changedFiles?.length > 0
          ? prData.changedFiles
          : conflictData?.changedFiles || [];
      setChangedFiles(allFiles);

      if (loadedConflicts.length > 0) {
        setActiveConflict(loadedConflicts[0]);
        setSelectedFilePath(loadedConflicts[0].filePath);
      } else if (allFiles.length > 0) {
        const firstFile = allFiles[0].filename || allFiles[0].filePath || '';
        setSelectedFilePath(firstFile);
        setActiveConflict(null);
      }

      if (!hasAutoAnalyzed.current && prData?.analysisStatus === 'NOT_ANALYZED') {
        hasAutoAnalyzed.current = true;
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

  // 2. Fetch Source for Monaco
  useEffect(() => {
    if (!selectedFilePath || !repositoryId || !prNumber) return;

    let isMounted = true;
    setIsLoadingSource(true);

    analysisApi
      .getSource(repositoryId, prNumber, selectedFilePath)
      .then((data) => {
        if (isMounted) {
          setSourceData(data);
          setResolvedCodeMap((prev) => {
            if (prev[selectedFilePath] !== undefined) return prev;
            return {
              ...prev,
              [selectedFilePath]: data.headSource || '',
            };
          });
        }
      })
      .catch((err) => {
        console.warn('Could not fetch source:', err);
        if (isMounted) {
          setSourceData({
            filePath: selectedFilePath,
            language: 'plaintext',
            baseSource: activeConflict?.baseCode || '',
            headSource: activeConflict?.headCode || '',
            ancestorSource: activeConflict?.ancestorCode || '',
          });
        }
      })
      .finally(() => { if (isMounted) setIsLoadingSource(false); });

    return () => {
      isMounted = false;
    };
  }, [selectedFilePath, repositoryId, prNumber, activeConflict?.baseCode, activeConflict?.headCode, activeConflict?.ancestorCode]);

  // 3. Selection handlers
  const handleSelectFile = (filePath) => {
    setSelectedFilePath(filePath);
    const fileConflicts = conflicts.filter((c) => c.filePath === filePath);
    setActiveConflict(fileConflicts.length > 0 ? fileConflicts[0] : null);
  };

  const handleSelectConflict = (conflict) => {
    setActiveConflict(conflict);
    if (conflict?.filePath && conflict.filePath !== selectedFilePath) {
      setSelectedFilePath(conflict.filePath);
    }
  };

  // 4. Analysis
  const runAnalysis = async () => {
    setIsAnalyzing(true);
    setErrorMessage('');
    try {
      const result = await analysisApi.triggerAnalysis(repositoryId, prNumber);
      setPullRequest(result);

      const conflictRes = await analysisApi.getConflicts(repositoryId, prNumber);
      const newConflicts = conflictRes?.conflicts || [];
      setConflicts(newConflicts);

      if (conflictRes?.changedFiles?.length) setChangedFiles(conflictRes.changedFiles);
      if (newConflicts.length > 0) {
        setActiveConflict(newConflicts[0]);
        setSelectedFilePath(newConflicts[0].filePath);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Analysis failed. Please check repository access.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── 5. Sandbox: Run Tests ─────────────────────────────────────────────────
  const handleRunTests = async () => {
    if (!activeConflict || !repository || !pullRequest) return;

    // Close previous SSE if any
    sseRef.current?.close();
    setSandboxLogs('');
    setSandboxStatus('PROVISIONING');
    setShowTerminal(true);
    setSandboxId(null);

    try {
      const normalize = (p) => (p || '').replace(/^\/+/, '');
      const activePath = normalize(activeConflict.filePath || currentFilePath);

      // Find edited content across any path variation (with or without leading slash)
      let fileContent = null;
      for (const [k, v] of Object.entries(resolvedCodeMap)) {
        if (normalize(k) === activePath && v !== undefined) {
          fileContent = v;
          break;
        }
      }

      if (fileContent === null) {
        fileContent =
          resolvedCodeMap[currentFilePath] ??
          resolvedCodeMap[activeConflict.filePath] ??
          sourceData?.headSource ??
          activeConflict.suggestedResolution ??
          '';
      }

      console.log('[Sandbox] Running tests with file:', activePath, '\nPreview:', fileContent.slice(0, 100));

      const resolvedFiles = {
        [activePath]: fileContent,
      };

      const sandbox = await sandboxApi.provision(
        repositoryId,
        prNumber,
        resolvedFiles,
        activeConflict.id
      );

      setSandboxId(sandbox.id);
      setSandboxStatus(sandbox.status);

      // Open SSE log stream
      sseRef.current = sandboxApi.streamLogs(
        sandbox.id,
        (text) => setSandboxLogs((prev) => prev + text),
        (status) => setSandboxStatus(status),
        (err) => console.error('SSE error:', err)
      );
    } catch (err) {
      setSandboxStatus('ERROR');
      setSandboxLogs(`[ERROR] ${err.response?.data?.error?.message || err.message}\n`);
    }
  };

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => sseRef.current?.close();
  }, []);

  // ── 6. Sandbox: Push Resolution ───────────────────────────────────────────
  const handlePushResolution = async () => {
    if (!sandboxId || sandboxStatus !== 'PASSED') return;
    setIsPushing(true);
    try {
      await sandboxApi.pushResolution(sandboxId);
      alert('✅ Resolution pushed to GitHub PR branch successfully!');
    } catch (err) {
      alert(`❌ Push failed: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setIsPushing(false);
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
      {/* Sandbox Terminal Overlay */}
      {showTerminal && (
        <SandboxTerminal
          logs={sandboxLogs}
          status={sandboxStatus}
          onClose={() => setShowTerminal(false)}
        />
      )}

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

        {/* Panel 2: Monaco Diff Editor + Sandbox Action Bar */}
        <section className="workspace-editor-column">
          <MonacoDiffViewer
            filePath={currentFilePath}
            language={sourceData?.language || 'javascript'}
            baseSource={sourceData?.baseSource || ''}
            headSource={sourceData?.headSource || ''}
            ancestorSource={sourceData?.ancestorSource || ''}
            baseSha={sourceData?.baseSha || pullRequest?.baseSha || ''}
            headSha={sourceData?.headSha || pullRequest?.headSha || ''}
            ancestorSha={sourceData?.ancestorSha || activeConflict?.ancestorSha || ''}
            activeConflict={activeConflict}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isLoading={isLoadingSource}
            resolvedSource={resolvedCodeMap[currentFilePath] ?? sourceData?.headSource ?? ''}
            onResolvedSourceChange={(newCode) => {
              setResolvedCodeMap((prev) => ({
                ...prev,
                [currentFilePath]: newCode,
              }));
            }}
            onRunTests={handleRunTests}
            onPushResolution={handlePushResolution}
            sandboxStatus={sandboxStatus}
            isPushing={isPushing}
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