import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { HomePage } from './pages/home/HomePage';
import { LoginModal } from './components/common/LoginModal';

/**
 * Root Application Component
 * Sets up global theme provider, navbar, home page view, and login modal.
 */
export const App = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="app-layout">
        <Navbar onLoginClick={() => setIsLoginOpen(true)} />
        <HomePage />
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
        />
      </div>
    </ThemeProvider>
  );
};

export default App;
