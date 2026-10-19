import { env } from '../config/env.js';

export const llmService = {
  hasApiKey() {
    return Boolean(env.GROQ_API_KEY);
  },

  /**
   * Deterministic high-quality fallback analysis when LLM API is unavailable or unconfigured
   */
  generateFallback({ filePath, rawConflict, astContext }) {
    const symbolInfo = astContext?.scope
      ? ` within symbol \`${astContext.scope}\``
      : '';
    const baseLinesDesc = `base branch (lines ${rawConflict.baseStartLine}-${rawConflict.baseEndLine})`;
    const headLinesDesc = `PR branch (lines ${rawConflict.headStartLine}-${rawConflict.headEndLine})`;

    const explanation =
      `Merge conflict detected in \`${filePath}\`${symbolInfo}. ` +
      `Both the target ${baseLinesDesc} and the incoming ${headLinesDesc} modified this section simultaneously ` +
      `relative to the common merge ancestor. Resolving this requires verifying which changes must be preserved ` +
      `or combining the logic without overriding required functionality.`;

    let suggestedResolution = '';
    if (rawConflict.headCode && rawConflict.baseCode) {
      suggestedResolution =
        `// Suggested resolution strategy:\n` +
        `// Carefully review both edits below and synthesize the desired behavior:\n\n` +
        `/* Head Version (Incoming PR changes): */\n${rawConflict.headCode}\n\n` +
        `/* Base Version (Target branch changes): */\n${rawConflict.baseCode}`;
    } else if (rawConflict.headCode) {
      suggestedResolution = rawConflict.headCode;
    } else {
      suggestedResolution = rawConflict.baseCode || '// Remove obsolete block';
    }

    return {
      conflictType: 'MERGE',
      risk: rawConflict.risk || 'MEDIUM',
      explanation,
      suggestedResolution,
    };
  },

  /**
   * Generate explanation and resolution recommendation using Groq Free LLM (e.g. llama-3.3-70b-versatile)
   */
  async generateConflictResolution({
    prTitle,
    prBody,
    filePath,
    rawConflict,
    astContext,
    commitContext,
    diff,
  }) {
    if (!this.hasApiKey()) {
      return this.generateFallback({ filePath, rawConflict, astContext });
    }

    const systemPrompt = `You are ConflictForge's code analysis engine. 
Analyze the provided merge conflict in a GitHub Pull Request and provide a clear, technical explanation and actionable suggested resolution.

Respond STRICTLY in valid JSON matching this schema:
{
  "conflictType": "MERGE" | "SEMANTIC" | "UNKNOWN",
  "risk": "LOW" | "MEDIUM" | "HIGH",
  "explanation": "Clear 2-4 sentence explanation of what collided and why",
  "suggestedResolution": "The recommended resolved code or concrete resolution guidance"
}`;

    const userPrompt = `Pull Request Title: ${prTitle || 'N/A'}
Pull Request Description: ${prBody || 'N/A'}
File Path: ${filePath}
Conflict Lines: Base: L${rawConflict.baseStartLine}-L${rawConflict.baseEndLine}, Head: L${rawConflict.headStartLine}-L${rawConflict.headEndLine}
AST Context: ${astContext ? JSON.stringify(astContext) : 'None'}
Commit Context: ${commitContext ? JSON.stringify(commitContext) : 'None'}

--- ANCESTOR CODE (Original shared version) ---
${rawConflict.ancestorCode || '[Empty or none]'}

--- BASE CODE (Target branch version) ---
${rawConflict.baseCode || '[Empty or deleted]'}

--- HEAD CODE (Incoming PR version) ---
${rawConflict.headCode || '[Empty or deleted]'}

--- DIFF HUNK ---
${diff || 'N/A'}

Provide explanation, risk evaluation, and suggested resolved code in valid JSON.`;



    try {
      const response = await fetch(`${env.GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.GROQ_MODEL,
          response_format: { type: 'json_object' },
          temperature: 0.2,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const responseText = data.choices?.[0]?.message?.content?.trim();

      if (!responseText) {
        return this.generateFallback({ filePath, rawConflict, astContext });
      }

      const parsed = JSON.parse(responseText);

      return {
        conflictType: ['MERGE', 'SEMANTIC', 'UNKNOWN'].includes(parsed.conflictType)
          ? parsed.conflictType
          : 'MERGE',
        risk: ['LOW', 'MEDIUM', 'HIGH'].includes(parsed.risk)
          ? parsed.risk
          : rawConflict.risk || 'MEDIUM',
        explanation: parsed.explanation || 'Conflict detected between base and head changes.',
        suggestedResolution: parsed.suggestedResolution || rawConflict.headCode || '',
      };
    } catch (err) {
      console.warn(`[WARN] AI analysis call failed (${err.message}). Using deterministic fallback.`);
      return this.generateFallback({ filePath, rawConflict, astContext });
    }
  },
};

export default llmService;
