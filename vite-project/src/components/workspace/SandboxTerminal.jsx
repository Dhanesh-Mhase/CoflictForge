import React, { useEffect, useRef } from 'react';

const STATUS_LABELS = {
  PROVISIONING: { label: 'Provisioning container…', color: '#7c83fd', icon: '⚙️' },
  CLONING:      { label: 'Cloning repository…',     color: '#7c83fd', icon: '📦' },
  RUNNING_TESTS:{ label: 'Running tests…',           color: '#f0c040', icon: '🧪' },
  PASSED:       { label: 'All tests passed!',         color: '#4ade80', icon: '✅' },
  FAILED:       { label: 'Tests failed',              color: '#f87171', icon: '❌' },
  TIMED_OUT:    { label: 'Timed out (5 min limit)',   color: '#fb923c', icon: '⏱️' },
  ERROR:        { label: 'Sandbox error',             color: '#f87171', icon: '🔥' },
  TORN_DOWN:    { label: 'Container torn down',       color: '#94a3b8', icon: '🗑️' },
};

/**
 * SandboxTerminal — displays real-time Docker container logs in a terminal-style pane.
 *
 * Props:
 *   logs     {string}   — accumulated log text
 *   status   {string}   — current sandbox status key
 *   onClose  {function} — called when user dismisses the panel
 */
export const SandboxTerminal = ({ logs, status, onClose }) => {
  const bottomRef = useRef(null);

  // Auto-scroll to bottom on new log lines
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const statusMeta = STATUS_LABELS[status] || { label: status, color: '#94a3b8', icon: '⚙️' };
  const isRunning = ['PROVISIONING', 'CLONING', 'RUNNING_TESTS'].includes(status);

  return (
    <div className="sandbox-terminal-overlay">
      <div className="sandbox-terminal-card">
        {/* Terminal Title Bar */}
        <div className="sandbox-terminal-titlebar">
          <div className="sandbox-terminal-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="sandbox-terminal-title">
            ConflictForge — Docker Sandbox
          </span>
          <button
            type="button"
            className="sandbox-terminal-close"
            onClick={onClose}
            aria-label="Close terminal"
          >
            ✕
          </button>
        </div>

        {/* Status Badge */}
        <div className="sandbox-status-bar" style={{ borderColor: statusMeta.color }}>
          {isRunning && <span className="sandbox-spinner" />}
          <span className="sandbox-status-icon">{statusMeta.icon}</span>
          <span className="sandbox-status-label" style={{ color: statusMeta.color }}>
            {statusMeta.label}
          </span>
        </div>

        {/* Log Output */}
        <div className="sandbox-log-output">
          <pre className="sandbox-log-pre">
            {logs || 'Waiting for container output…\n'}
          </pre>
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
};

export default SandboxTerminal;
