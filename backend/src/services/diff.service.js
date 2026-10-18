import { createTwoFilesPatch } from 'diff';

export const diffService = {
  /**
   * Create standard unified diff format for two file contents
   */
  createUnifiedDiff(
    filePath,
    baseContent,
    headContent,
    baseLabel = 'base',
    headLabel = 'head'
  ) {
    if (baseContent === null && headContent === null) {
      return '';
    }

    return createTwoFilesPatch(
      filePath,
      filePath,
      baseContent || '',
      headContent || '',
      baseLabel,
      headLabel
    );
  },

  /**
   * Generate focused diff hunk for a specific conflict region
   */
  getConflictHunk(
    filePath,
    baseSnippet,
    headSnippet,
    baseStartLine = 1,
    headStartLine = 1
  ) {
    return createTwoFilesPatch(
      filePath,
      filePath,
      baseSnippet || '',
      headSnippet || '',
      `base:L${baseStartLine}`,
      `head:L${headStartLine}`
    );
  },
};

export default diffService;
