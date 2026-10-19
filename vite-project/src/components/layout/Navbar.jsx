import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../common/Button';
import { NAV_ITEMS } from '../../constants/navItems';
import { useAuth } from '../../context/AuthContext';

/**
 * Single Responsibility: Organizes top header layout and navigation using React Router.
 */
export const Navbar = ({ items = NAV_ITEMS, onLoginClick }) => {
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Left: Brand Logo & Main Navigation */}
        <div className="navbar-left">
          <Link to="/" style={{ textDecoration: 'none' }}>
            <BrandLogo />
          </Link>

          <nav className="navbar-links" aria-label="Main Navigation">
            {items.map((item) => {
              const isActive =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Theme Toggle & User Auth Action */}
        <div className="navbar-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle />

          {isAuthenticated ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'User'}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1.5px solid var(--border-subtle)',
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--border-strong)',
                    color: 'var(--text-inverse)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
              )}
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                {user?.name?.split(' ')[0] || user?.email?.split('@')[0]}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="navbar-logout-btn"
                onClick={logout}
                aria-label="Sign out"
              >
                Sign out
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="navbar-login-btn"
              onClick={onLoginClick}
              aria-label="Log in"
            >
              Login
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
