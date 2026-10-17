import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { CloseIcon, GitForkIcon } from './Icon';
import { useAuth } from '../../context/AuthContext';

/**
 * Modern Google Sign-In Dialog UI
 */
export const LoginModal = ({ isOpen, onClose }) => {
  const { loginWithGoogle, isLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSuccess = async (credentialResponse) => {
    setErrorMessage('');
    if (!credentialResponse.credential) {
      setErrorMessage('Failed to receive Google credentials.');
      return;
    }

    const result = await loginWithGoogle(credentialResponse.credential);
    if (result.success) {
      onClose();
    } else {
      setErrorMessage(result.error || 'Authentication failed. Please try again.');
    }
  };

  const handleError = () => {
    setErrorMessage('Google Sign-in failed or was closed. Please try again.');
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

        <div className="login-modal-body" style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary, #94a3b8)', marginBottom: '20px', fontSize: '14px' }}>
            Sign in with your Google account to access your repositories and analysis.
          </p>

          {errorMessage && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {errorMessage}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              margin: '12px 0 20px',
              minHeight: '44px',
            }}
          >
            {isLoading ? (
              <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '14px' }}>
                Signing in...
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleSuccess}
                onError={handleError}
                useOneTap={false}
                theme="filled_black"
                shape="pill"
                text="continue_with"
                size="large"
              />
            )}
          </div>

          <p className="login-disclaimer" style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};
