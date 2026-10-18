import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

export const llmService = {
  getAiClient() {
    if (!env.GEMINI_API_KEY) {
      return null;
    }
    return new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
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
   * Generate explanation and resolution recommendation using Google Gemini or fallback
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
    const ai = this.getAiClient();

    if (!ai) {
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

Provide explanation, risk evaluation, and suggested resolved code.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const responseText = response.text?.trim();
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
      console.warn(`[WARN] LLM analysis call failed (${err.message}). Using deterministic fallback.`);
      return this.generateFallback({ filePath, rawConflict, astContext });
    }
  },
};

export default llmService;
