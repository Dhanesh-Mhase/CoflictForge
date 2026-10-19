import { env } from '../config/env.js';
import conflictRepository from '../repository/conflict.repository.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js';

export const chatService = {
  hasApiKey() {
    return Boolean(env.GROQ_API_KEY);
  },

  /**
   * Deterministic fallback when Groq API is unconfigured or unavailable
   */
  generateFallbackAnswer(conflict, userMessage) {
    const symbolContext = conflict.astContext?.scope
      ? ` within symbol \`${conflict.astContext.scope}\``
      : '';

    return (
      `Regarding the conflict in \`${conflict.filePath}\`${symbolContext} (Base lines ${conflict.baseStartLine}-${conflict.baseEndLine}, ` +
      `Head lines ${conflict.headStartLine}-${conflict.headEndLine}):\n\n` +
      `In response to your query "${userMessage}":\n` +
      `The target base branch introduced changes to this block while the PR head branch also modified it. ` +
      `The recommended approach is to review both variants:\n\n` +
      `\`\`\`javascript\n` +
      (conflict.suggestedResolution || conflict.headCode || '// Merge changes manually') +
      `\n\`\`\`\n\n` +
      `Ensure that any dependencies or calls originating from both branches are preserved.`
    );
  },

  /**
   * Answer a contextual question about a specific conflict finding using OpenAI (e.g. gpt-4o-mini, gpt-4o)
   */
  async ask({ userId, repositoryId, prNumber, conflictId, message, history = [] }) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new BadRequestError('Chat message is required.', 'MISSING_MESSAGE');
    }

    const parsedNumber = parseInt(prNumber, 10);
    if (isNaN(parsedNumber)) {
      throw new BadRequestError('Invalid pull request number.', 'INVALID_PR_NUMBER');
    }

    // 1. Retrieve the conflict finding with PR and repository relation
    const conflict = await conflictRepository.findById(conflictId);
    if (!conflict) {
      throw new NotFoundError('Conflict finding not found.', 'CONFLICT_NOT_FOUND');
    }

    // 2. Validate repository and PR ownership
    const pr = conflict.pullRequest;
    if (!pr || pr.githubPrNumber !== parsedNumber || pr.repositoryId !== repositoryId) {
      throw new NotFoundError(
        'Conflict finding does not belong to the specified pull request.',
        'CONFLICT_MISMATCH'
      );
    }

    if (pr.repository?.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to access this conflict finding.',
        'FORBIDDEN'
      );
    }

    // 3. Assemble trusted system context from database records
    const systemContext = `You are ConflictForge's code resolution assistant.
A developer is asking questions about a specific Git merge conflict in a GitHub Pull Request.

--- CONFLICT DETAILS ---
Repository: ${pr.repository.fullName}
Pull Request: #${pr.githubPrNumber} - "${pr.title}" (${pr.baseBranch} <- ${pr.headBranch})
File Path: ${conflict.filePath}
Conflict Type: ${conflict.conflictType}
Risk Level: ${conflict.risk}
Conflict Line Ranges: Base: L${conflict.baseStartLine}-L${conflict.baseEndLine}, Head: L${conflict.headStartLine}-L${conflict.headEndLine}
AST Symbol Scope: ${conflict.astContext ? JSON.stringify(conflict.astContext) : 'Global / Not applicable'}

--- BASE CODE (Target branch version) ---
${conflict.baseCode || '[Empty or deleted]'}

--- HEAD CODE (Incoming PR version) ---
${conflict.headCode || '[Empty or deleted]'}

--- ANCESTOR CODE (Shared merge base version) ---
${conflict.ancestorCode || '[None]'}

--- INITIAL EXPLANATION ---
${conflict.explanation}

--- INITIAL SUGGESTED RESOLUTION ---
${conflict.suggestedResolution}

--- DIFF HUNK ---
${conflict.diff || 'N/A'}

--- INSTRUCTIONS ---
- Answer the developer's question specifically with respect to this conflict.
- Provide concrete code blocks if suggesting an implementation or resolution.
- Be concise, accurate, and explain any trade-offs or breaking risks.`;

    if (!this.hasApiKey()) {
      return {
        conflictId,
        answer: this.generateFallbackAnswer(conflict, message.trim()),
        timestamp: new Date().toISOString(),
      };
    }

    // 4. Format conversation history (bounded to last 6 messages)
    const messages = [
      { role: 'system', content: systemContext },
    ];

    if (Array.isArray(history)) {
      const recentHistory = history.slice(-6);
      for (const turn of recentHistory) {
        if (!turn.content || typeof turn.content !== 'string') continue;
        const role = turn.role === 'model' || turn.role === 'assistant' ? 'assistant' : 'user';
        messages.push({
          role,
          content: turn.content,
        });
      }
    }

    messages.push({
      role: 'user',
      content: message.trim(),
    });

    try {
      const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          temperature: 0.3,
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const answer =
        data.choices?.[0]?.message?.content?.trim() ||
        this.generateFallbackAnswer(conflict, message.trim());

      return {
        conflictId,
        answer,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.warn(`[WARN] Groq chat call failed (${err.message}). Using deterministic fallback.`);
      return {
        conflictId,
        answer: this.generateFallbackAnswer(conflict, message.trim()),
        timestamp: new Date().toISOString(),
      };
    }
  },
};

export default chatService;
