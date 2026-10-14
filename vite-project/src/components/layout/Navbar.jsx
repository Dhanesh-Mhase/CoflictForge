import React, { useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../common/Button';
import { NAV_ITEMS } from '../../constants/navItems';

/**
 * Single Responsibility: Organizes top header layout and navigation.
 * Open/Closed: Receives navItems, allows customizing active navigation state.
 */
export const Navbar = ({ items = NAV_ITEMS, onLoginClick }) => {
  const [activeId, setActiveId] = useState('dashboard');

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Left: Brand Logo & Main Navigation */}
        <div className="navbar-left">
          <BrandLogo />
          
          <nav className="navbar-links" aria-label="Main Navigation">
            {items.map((item) => {
              const isActive = activeId === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveId(item.id);
                  }}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Right: Theme Toggle & Login Action */}
        <div className="navbar-right">
          <ThemeToggle />
          <Button
            variant="outline"
            size="sm"
            className="navbar-login-btn"
            onClick={onLoginClick}
            aria-label="Log in"
          >
            Login
          </Button>
        </div>
      </div>
    </header>
  );
};
