import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { SunIcon, MoonIcon } from '../common/Icon';

/**
 * Single Responsibility: Interactive theme toggle switcher.
 * Uses ThemeContext (DIP).
 */
export const ThemeToggle = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${className}`.trim()}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <SunIcon size={18} className="theme-icon theme-sun" />
      ) : (
        <MoonIcon size={18} className="theme-icon theme-moon" />
      )}
    </button>
  );
};
