import repositoryService from './repository.service.js';
import githubService from './github.service.js';
import pullRequestService from './pull-request.service.js';
import pullRequestRepository from '../repository/pull-request.repository.js';
import conflictRepository from '../repository/conflict.repository.js';
import mergeService from './merge.service.js';
import diffService from './diff.service.js';
import astService from './ast.service.js';
import llmService from './llm.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

const detectLanguage = (filePath) => {
  const ext = filePath?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'json':
      return 'json';
    case 'css':
    case 'scss':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'yml':
    case 'yaml':
      return 'yaml';
    default:
      return 'plaintext';
  }
};

export const analysisService = {
  /**
   * Run full three-way merge conflict detection, AST symbol extraction, and LLM resolution pipeline
   */
  async analyzePullRequest(userId, repositoryId, prNumber) {
    // 1. Verify user access to repository
    const repo = await repositoryService.getUserRepositoryById(userId, repositoryId);

    const parsedNumber = parseInt(prNumber, 10);
    if (isNaN(parsedNumber)) {
      throw new BadRequestError('Invalid pull request number.', 'INVALID_PR_NUMBER');
    }

    // 2. Fetch fresh PR metadata from GitHub
    const remotePr = await githubService.getPullRequest(repo.owner, repo.name, parsedNumber);

    // 3. Upsert local PullRequest record
    const localPr = await pullRequestRepository.upsert({
      repositoryId: repo.id,
      githubPrNumber: parsedNumber,
      title: remotePr.title,
      body: remotePr.body,
      state: remotePr.state,
      baseBranch: remotePr.base?.ref || 'main',
      headBranch: remotePr.head?.ref || '',
      baseSha: remotePr.base?.sha || '',
      headSha: remotePr.head?.sha || '',
      mergeable: remotePr.mergeable !== undefined ? remotePr.mergeable : null,
    });

    // 4. Mark analysis status as RUNNING
    await pullRequestRepository.updateAnalysisState(localPr.id, {
      analysisStatus: 'RUNNING',
      analysisStartedAt: new Date(),
      analysisError: null,
    });

    try {
      // 5. Compare commits to determine common ancestor (merge base commit)
      const compareData = await githubService.compareCommits(
        repo.owner,
        repo.name,
        remotePr.base.sha,
        remotePr.head.sha
      );

      const ancestorSha = compareData?.merge_base_commit?.sha || remotePr.base.sha;
      const recentCommits = (compareData?.commits || []).slice(-5).map((c) => ({
        sha: c.sha?.slice(0, 7),
        message: c.commit?.message?.split('\n')[0],
        author: c.commit?.author?.name,
      }));

      // 6. Fetch changed files list from GitHub
      const changedFiles = await githubService.getPullRequestFiles(
        repo.owner,
        repo.name,
        parsedNumber
      );

      const conflictsToStore = [];

      // 7. Process each changed file with 3-way merge conflict detection
      for (const file of changedFiles) {
        const filePath = file.filename;

        // Skip files that were removed with no patch data
        if (file.status === 'removed' && !file.patch) {
          continue;
        }

        // Fetch file versions at exact SHAs
        const [baseContent, headContent, ancestorContent] = await Promise.all([
          githubService.getFileContent(repo.owner, repo.name, filePath, remotePr.base.sha),
          githubService.getFileContent(repo.owner, repo.name, filePath, remotePr.head.sha),
          githubService.getFileContent(repo.owner, repo.name, filePath, ancestorSha),
        ]);

        // Run 3-way merge conflict detection
        const detectedRawConflicts = mergeService.detectConflicts(
          filePath,
          baseContent,
          headContent,
          ancestorContent
        );

        for (const rawConflict of detectedRawConflicts) {
          // Generate focused diff hunk
          const diffHunk = diffService.getConflictHunk(
            filePath,
            rawConflict.baseCode,
            rawConflict.headCode,
            rawConflict.baseStartLine,
            rawConflict.headStartLine
          );

          // Extract AST symbol context if JS/TS file
          const astContext = astService.extractSymbolContext(
            headContent || baseContent,
            rawConflict.headStartLine,
            rawConflict.headEndLine,
            filePath
          );

          // Call LLM for explanation and suggested resolution
          const enriched = await llmService.generateConflictResolution({
            prTitle: remotePr.title,
            prBody: remotePr.body,
            filePath,
            rawConflict,
            astContext,
            commitContext: recentCommits,
            diff: diffHunk,
          });

          conflictsToStore.push({
            filePath,
            conflictType: enriched.conflictType || 'MERGE',
            risk: enriched.risk || rawConflict.risk || 'MEDIUM',
            baseStartLine: rawConflict.baseStartLine,
            baseEndLine: rawConflict.baseEndLine,
            headStartLine: rawConflict.headStartLine,
            headEndLine: rawConflict.headEndLine,
            baseSha: remotePr.base.sha,
            headSha: remotePr.head.sha,
            ancestorSha,
            baseCode: rawConflict.baseCode,
            headCode: rawConflict.headCode,
            ancestorCode: rawConflict.ancestorCode,
            diff: diffHunk,
            astContext: astContext ? astContext : null,
            commitContext: recentCommits.length > 0 ? recentCommits : null,
            explanation: enriched.explanation,
            suggestedResolution: enriched.suggestedResolution,
          });
        }
      }

      // 8. Commit findings atomically in a Prisma transaction
      const updatedPr = await conflictRepository.replaceFindingsAtomic({
        pullRequestId: localPr.id,
        conflicts: conflictsToStore,
        analyzedBaseSha: remotePr.base.sha,
        analyzedHeadSha: remotePr.head.sha,
        hasConflicts: conflictsToStore.length > 0,
      });

      return {
        ...updatedPr,
        isStale: pullRequestService.computeIsStale(updatedPr),
        htmlUrl: remotePr.html_url,
        changedFilesCount: changedFiles.length,
        conflictsCount: conflictsToStore.length,
      };
    } catch (err) {
      // Record failure state while preserving prior successful findings
      await pullRequestRepository.updateAnalysisState(localPr.id, {
        analysisStatus: 'FAILED',
        analysisError: err.message || 'Analysis pipeline execution failed.',
      });

      throw err;
    }
  },

  /**
   * Retrieve stored conflict findings for a pull request
   */
  async getConflicts(userId, repositoryId, prNumber) {
    const repo = await repositoryService.getUserRepositoryById(userId, repositoryId);

    const parsedNumber = parseInt(prNumber, 10);
    if (isNaN(parsedNumber)) {
      throw new BadRequestError('Invalid pull request number.', 'INVALID_PR_NUMBER');
    }

    const pr = await pullRequestRepository.findByRepoAndNumber(repo.id, parsedNumber, true);
    if (!pr) {
      throw new NotFoundError('Pull request not found.', 'PULL_REQUEST_NOT_FOUND');
    }

    return {
      pullRequestId: pr.id,
      githubPrNumber: pr.githubPrNumber,
      title: pr.title,
      analysisStatus: pr.analysisStatus,
      hasConflicts: pr.hasConflicts,
      analyzedBaseSha: pr.analyzedBaseSha,
      analyzedHeadSha: pr.analyzedHeadSha,
      isStale: pullRequestService.computeIsStale(pr),
      analysisCompletedAt: pr.analysisCompletedAt,
      analysisError: pr.analysisError,
      conflicts: pr.conflicts || [],
    };
  },

  /**
   * Stream raw file contents at analyzed SHAs for Monaco Diff Editor
   */
  async getSource(userId, repositoryId, prNumber, filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new BadRequestError('File path parameter is required.', 'MISSING_FILE_PATH');
    }

    const repo = await repositoryService.getUserRepositoryById(userId, repositoryId);

    const parsedNumber = parseInt(prNumber, 10);
    if (isNaN(parsedNumber)) {
      throw new BadRequestError('Invalid pull request number.', 'INVALID_PR_NUMBER');
    }

    const pr = await pullRequestRepository.findByRepoAndNumber(repo.id, parsedNumber, false);
    if (!pr) {
      throw new NotFoundError('Pull request not found.', 'PULL_REQUEST_NOT_FOUND');
    }

    // Use analyzed SHAs if completed analysis exists; otherwise use current observed SHAs
    const baseSha = pr.analyzedBaseSha || pr.baseSha;
    const headSha = pr.analyzedHeadSha || pr.headSha;

    const [baseSource, headSource] = await Promise.all([
      baseSha ? githubService.getFileContent(repo.owner, repo.name, filePath, baseSha) : null,
      headSha ? githubService.getFileContent(repo.owner, repo.name, filePath, headSha) : null,
    ]);

    return {
      filePath,
      language: detectLanguage(filePath),
      baseSha,
      headSha,
      baseSource: baseSource !== null ? baseSource : '',
      headSource: headSource !== null ? headSource : '',
    };
  },
};

export default analysisService;
