import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { LoginModal } from './components/common/LoginModal';
import { HomePage } from './pages/home/HomePage';
import { RepositoriesPage } from './pages/repositories/RepositoriesPage';
import { PullRequestOverviewPage } from './pages/pull-requests/PullRequestOverviewPage';
import { AnalysisWorkspacePage } from './pages/workspace/AnalysisWorkspacePage';

/**
 * Root Application Component
 * Sets up global theme, auth, React Router routes, navbar, and login modal.
 */
export const App = () => {
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <div className="app-layout">
            <Navbar onLoginClick={() => setIsLoginOpen(true)} />
            <Routes>
              <Route
                path="/"
                element={<HomePage onLoginClick={() => setIsLoginOpen(true)} />}
              />
              <Route
                path="/repositories"
                element={<RepositoriesPage onLoginClick={() => setIsLoginOpen(true)} />}
              />
              <Route
                path="/repositories/:repositoryId"
                element={<PullRequestOverviewPage />}
              />
              <Route
                path="/repositories/:repositoryId/pull-requests/:prNumber/analysis"
                element={<AnalysisWorkspacePage />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <LoginModal
              isOpen={isLoginOpen}
              onClose={() => setIsLoginOpen(false)}
            />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
