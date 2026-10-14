import React from 'react';
import { GitForkIcon } from '../common/Icon';

/**
 * Single Responsibility: Renders the ConflictForge brand identity.
 */
export const BrandLogo = ({ href = '/', className = '' }) => {
  return (
    <a href={href} className={`brand-logo ${className}`.trim()} aria-label="ConflictForge Home">
      <GitForkIcon size={24} className="brand-logo-icon" />
      <span className="brand-logo-text">ConflictForge</span>
    </a>
  );
};
