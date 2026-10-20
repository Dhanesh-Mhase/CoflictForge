import React, { useState } from 'react';
import { chatApi } from '../../api/chat.api';

export const ConflictChatPanel = ({
  repositoryId,
  prNumber,
  conflict,
  selectedFilePath,
  analysisStatus = 'NOT_ANALYZED',
  isAnalyzing = false,
  onReanalyze,
}) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatError, setChatError] = useState('');

  const handleCopyCode = () => {
    if (!conflict?.suggestedResolution) return;
    navigator.clipboard.writeText(conflict.suggestedResolution);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = inputMessage.trim();
    if (!trimmed || isSending || !conflict?.id) return;

    setChatError('');
    const newTurn = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, newTurn];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsSending(true);

    try {
      const response = await chatApi.sendChatMessage(
        repositoryId,
        prNumber,
        conflict.id,
        trimmed,
        updatedMessages
      );

      if (response?.answer) {
        setMessages((prev) => [
          ...prev,
          { role: 'model', content: response.answer },
        ]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to get answer from AI.';
      setChatError(msg);
    } finally {
      setIsSending(false);
    }
  };

  if (!conflict) {
    if (isAnalyzing) {
      return (
        <div className="workspace-ai-panel empty analyzing">
          <div className="status-spinner large"></div>
          <h3 className="empty-ai-title">AI Analysis in Progress</h3>
          <p className="empty-ai-desc">
            Evaluating 3-way merge differences, extracting AST symbol scopes, and generating AI conflict resolutions...
          </p>
        </div>
      );
    }

    if (analysisStatus === 'NOT_ANALYZED') {
      return (
        <div className="workspace-ai-panel empty pending">
          <span className="empty-ai-icon">⚡</span>
          <h3 className="empty-ai-title">Analysis Pending</h3>
          <p className="empty-ai-desc">
            This Pull Request hasn't been analyzed yet. Run analysis to detect merge clashes, AST symbol impacts, and get one-click AI fixes.
          </p>
          <button
            type="button"
            onClick={onReanalyze}
            className="ai-start-analysis-btn"
          >
            Run Full PR Analysis
          </button>
        </div>
      );
    }

    return (
      <div className="workspace-ai-panel empty">
        <span className="empty-ai-icon">💡</span>
        <h3 className="empty-ai-title">Select a Conflict</h3>
        <p className="empty-ai-desc">
          Select a conflict chunk from the left panel to inspect the AI collision explanation, suggested resolution, and ask follow-up questions.
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-ai-panel">
      {/* 1. Header with Metadata */}
      <div className="ai-panel-header">
        <div className="ai-header-top">
          <span className="ai-brand-badge">⚡ ConflictForge AI</span>
          <span className={`risk-pill risk-${conflict.risk?.toLowerCase()}`}>
            {conflict.risk} RISK
          </span>
        </div>
        {conflict.astContext?.scope && (
          <div className="ast-scope-pill" title="AST Symbol Scope">
            <span>Symbol:</span> <code>{conflict.astContext.scope}</code>
          </div>
        )}
      </div>

      <div className="ai-panel-scrollable">
        {/* 2. AI Explanation Card */}
        <div className="ai-card explanation-card">
          <div className="ai-card-title">
            <span>🔍</span> Collision Analysis
          </div>
          <p className="ai-card-text">{conflict.explanation}</p>
        </div>

        {/* 3. AI Suggested Resolution Card */}
        <div className="ai-card resolution-card">
          <div className="ai-card-title-row">
            <div className="ai-card-title">
              <span>🛠️</span> Suggested Resolution
            </div>
            <button
              type="button"
              className="copy-code-btn"
              onClick={handleCopyCode}
              title="Copy code to clipboard"
            >
              {copied ? '✓ Copied!' : 'Copy Code'}
            </button>
          </div>
          <pre className="suggested-code-block">
            <code>{conflict.suggestedResolution}</code>
          </pre>
        </div>

        {/* 3b. Common Ancestor Snippet (Old Base) */}
        {conflict.ancestorCode && (
          <div className="ai-card ancestor-card">
            <details className="ancestor-details">
              <summary className="ancestor-summary">
                <span>🕰️</span> Common Ancestor Excerpt
              </summary>
              <pre className="ancestor-code-block">
                <code>{conflict.ancestorCode}</code>
              </pre>
            </details>
          </div>
        )}

        {/* 4. Chat History Thread */}
        <div className="ai-chat-thread">
          <div className="chat-thread-title">Follow-up Discussion</div>

          {messages.length === 0 ? (
            <p className="chat-empty-hint">
              Have questions about this clash? Ask how to combine these changes safely.
            </p>
          ) : (
            <div className="chat-bubbles-list">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-bubble ${msg.role === 'user' ? 'user' : 'model'}`}
                >
                  <div className="bubble-sender">
                    {msg.role === 'user' ? 'You' : 'ConflictForge AI'}
                  </div>
                  <div className="bubble-content">{msg.content}</div>
                </div>
              ))}
            </div>
          )}

          {isSending && (
            <div className="chat-bubble model typing">
              <div className="bubble-sender">ConflictForge AI</div>
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}

          {chatError && (
            <div className="chat-error-alert">{chatError}</div>
          )}
        </div>
      </div>

      {/* 5. Input Form */}
      <form onSubmit={handleSendMessage} className="ai-chat-input-form">
        <input
          type="text"
          placeholder="Ask AI about this conflict..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isSending}
          className="ai-chat-input"
        />
        <button
          type="submit"
          disabled={isSending || !inputMessage.trim()}
          className="ai-chat-send-btn"
          aria-label="Send message"
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ConflictChatPanel;
