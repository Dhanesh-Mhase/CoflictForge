import React, { useState } from 'react';
import { CloseIcon, GitForkIcon } from './Icon';
import { Button } from './Button';

/**
 * Single Responsibility: Minimal, elegant login dialog UI.
 */
export const LoginModal = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => {
      onClose();
      setIsSubmitted(false);
    }, 900);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card modal-login-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <GitForkIcon size={20} className="modal-git-icon" />
            <h2 className="modal-title">Sign in to ConflictForge</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email or Username
            </label>
            <input
              id="login-email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="developer@example.com"
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="form-input"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="login-submit-btn"
            disabled={isSubmitted}
          >
            {isSubmitted ? 'Signing in...' : 'Log in'}
          </Button>

          <p className="login-disclaimer">
            UI-only demonstration. Enter any credentials to proceed.
          </p>
        </form>
      </div>
    </div>
  );
};
