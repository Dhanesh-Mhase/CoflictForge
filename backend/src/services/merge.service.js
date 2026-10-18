import { diff3Merge } from 'node-diff3';

export const mergeService = {
  /**
   * Determine initial conflict risk based on file path, size, and critical keywords
   */
  assessRisk(filePath, lineCount) {
    const lower = filePath.toLowerCase();
    if (
      lower.includes('package-lock.json') ||
      lower.includes('yarn.lock') ||
      lower.includes('pnpm-lock.yaml') ||
      lower.includes('cargo.lock')
    ) {
      return 'HIGH';
    }

    if (
      lower.includes('auth') ||
      lower.includes('security') ||
      lower.includes('payment') ||
      lower.includes('secret') ||
      lower.includes('credential')
    ) {
      return 'HIGH';
    }

    if (lineCount > 30) {
      return 'HIGH';
    }

    if (lineCount <= 5) {
      return 'LOW';
    }

    return 'MEDIUM';
  },

  /**
   * Run three-way merge conflict detection between base, head, and common ancestor
   * @param {string} filePath - Path of the file
   * @param {string|null} baseContent - File content in base commit (target branch)
   * @param {string|null} headContent - File content in head commit (PR branch)
   * @param {string|null} ancestorContent - File content in common ancestor (merge base)
   * @returns {Array} List of detected conflict regions
   */
  detectConflicts(filePath, baseContent, headContent, ancestorContent) {
    const conflicts = [];

    // Case 1: Both base and head are deleted (or never existed) - No conflict
    if (baseContent === null && headContent === null) {
      return [];
    }

    // Case 2: Modify / Delete conflict: File deleted in base but modified in head
    if (baseContent === null && ancestorContent !== null && headContent !== null) {
      const headLines = headContent.split(/\r?\n/);
      const ancestorLines = ancestorContent.split(/\r?\n/);
      conflicts.push({
        filePath,
        conflictType: 'MERGE',
        risk: 'HIGH',
        baseStartLine: 1,
        baseEndLine: 1,
        headStartLine: 1,
        headEndLine: Math.min(20, headLines.length),
        baseCode: '[File deleted in target base branch]',
        headCode: headLines.slice(0, 30).join('\n'),
        ancestorCode: ancestorLines.slice(0, 30).join('\n'),
        description: 'File was deleted in the base branch but modified in the PR branch.',
      });
      return conflicts;
    }

    // Case 3: Modify / Delete conflict: File deleted in head but modified in base
    if (headContent === null && ancestorContent !== null && baseContent !== null) {
      const baseLines = baseContent.split(/\r?\n/);
      const ancestorLines = ancestorContent.split(/\r?\n/);
      conflicts.push({
        filePath,
        conflictType: 'MERGE',
        risk: 'HIGH',
        baseStartLine: 1,
        baseEndLine: Math.min(20, baseLines.length),
        headStartLine: 1,
        headEndLine: 1,
        baseCode: baseLines.slice(0, 30).join('\n'),
        headCode: '[File deleted in PR branch]',
        ancestorCode: ancestorLines.slice(0, 30).join('\n'),
        description: 'File was modified in the base branch but deleted in the PR branch.',
      });
      return conflicts;
    }

    // Case 4: File added independently in both branches without a common ancestor (Add / Add conflict)
    if (ancestorContent === null && baseContent !== null && headContent !== null) {
      if (baseContent.trim() === headContent.trim()) {
        // Identical additions - no conflict
        return [];
      }
      const baseLines = baseContent.split(/\r?\n/);
      const headLines = headContent.split(/\r?\n/);
      conflicts.push({
        filePath,
        conflictType: 'MERGE',
        risk: this.assessRisk(filePath, Math.max(baseLines.length, headLines.length)),
        baseStartLine: 1,
        baseEndLine: Math.min(30, baseLines.length),
        headStartLine: 1,
        headEndLine: Math.min(30, headLines.length),
        baseCode: baseLines.slice(0, 30).join('\n'),
        headCode: headLines.slice(0, 30).join('\n'),
        ancestorCode: '[File did not exist in common ancestor]',
        description: 'File was added in both branches with differing contents.',
      });
      return conflicts;
    }

    // Standard Case 5: Three-way merge across base, ancestor, and head
    const safeBase = baseContent || '';
    const safeAncestor = ancestorContent || '';
    const safeHead = headContent || '';

    // If base and head are identical, there is no conflict
    if (safeBase === safeHead) {
      return [];
    }

    const baseLines = safeBase.split(/\r?\n/);
    const ancestorLines = safeAncestor.split(/\r?\n/);
    const headLines = safeHead.split(/\r?\n/);

    const mergeRegions = diff3Merge(baseLines, ancestorLines, headLines, {
      excludeFalseConflicts: true,
    });

    for (const region of mergeRegions) {
      if (!region.conflict) continue;

      const { a, aIndex, b, bIndex, o } = region.conflict;
      const baseLinesInConflict = a || [];
      const headLinesInConflict = b || [];
      const ancestorLinesInConflict = o || [];

      const baseStartLine = aIndex + 1;
      const baseEndLine = baseStartLine + Math.max(0, baseLinesInConflict.length - 1);

      const headStartLine = bIndex + 1;
      const headEndLine = headStartLine + Math.max(0, headLinesInConflict.length - 1);

      const MAX_EXCERPT_LINES = 60;
      const baseCode = baseLinesInConflict.slice(0, MAX_EXCERPT_LINES).join('\n');
      const headCode = headLinesInConflict.slice(0, MAX_EXCERPT_LINES).join('\n');
      const ancestorCode = ancestorLinesInConflict.slice(0, MAX_EXCERPT_LINES).join('\n');

      const maxConflictLines = Math.max(baseLinesInConflict.length, headLinesInConflict.length);
      const risk = this.assessRisk(filePath, maxConflictLines);

      conflicts.push({
        filePath,
        conflictType: 'MERGE',
        risk,
        baseStartLine,
        baseEndLine,
        headStartLine,
        headEndLine,
        baseCode,
        headCode,
        ancestorCode,
      });
    }

    return conflicts;
  },
};

export default mergeService;
