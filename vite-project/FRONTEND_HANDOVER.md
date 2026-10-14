# ConflictForge — Frontend Architecture & Developer Handover Guide

Welcome to the **ConflictForge** frontend repository! This document provides a comprehensive walkthrough of the project’s structure, design philosophy, reusable primitives, and step-by-step instructions for extending the application with new pages and backend integrations.

---

## 1. Project Overview & Design Philosophy

The frontend is built with **React 19 + Vite** and styled with **Vanilla CSS (CSS Custom Properties)**.

### Architectural Balance: SOLID + KISS
- **KISS (Keep It Simple, Stupid):** Pages (like `HomePage.jsx`) are kept cohesive and self-contained rather than fragmented into dozens of single-use 10-line micro-files.
- **SOLID Design Principles:**
  - **Single Responsibility (SRP):** Global theming, form state logic, navigation layout, and UI primitives each live in dedicated, isolated files.
  - **Open / Closed (OCP):** UI primitives (e.g., `Button`) and navigation items are open for extension (via props or configuration) without modifying their core internals.
  - **Liskov Substitution (LSP):** Custom components forward native HTML props (`type`, `disabled`, `aria-*`, `onClick`) and can transparently substitute standard elements.
  - **Interface Segregation (ISP):** Components only ask for the specific props they consume.
  - **Dependency Inversion (DIP):** View components rely on hooks (`useTheme`, `useRepoForm`) rather than hardcoded global states or rigid network logic.

---

## 2. Complete Folder & File Directory Breakdown

```text
vite-project/
├── index.html                   # HTML entry point (loads 'Inter' font & mounts #root)
├── vite.config.js               # Vite configuration (React SWC/Babel plugin)
├── package.json                 # Project scripts and dependencies
│
└── src/
    ├── main.jsx                 # Bootstraps React DOM mounting App.jsx
    ├── App.jsx                  # Root layout orchestrator (ThemeProvider + Navbar + View)
    ├── index.css                # Global design system & theme tokens (Dark & Light)
    │
    ├── constants/
    │   └── navItems.js          # Navigation link data configuration
    │
    ├── context/
    │   └── ThemeContext.jsx      # Global Theme state provider & localStorage persistence
    │
    ├── hooks/
    │   └── useRepoForm.js        # Form business logic, validation & sample PR injection
    │
    ├── components/
    │   ├── common/              # Reusable UI primitives (used across multiple pages)
    │   │   ├── Button.jsx       # Standardized button with variants (primary, outline, sizes)
    │   │   ├── Icon.jsx         # Zero-dependency, lightweight SVG icon library
    │   │   └── LoginModal.jsx   # Interactive modal dialog for user authentication
    │   │
    │   └── layout/              # Structural chrome (header, navigation, branding)
    │       ├── Navbar.jsx       # Global header container
    │       ├── BrandLogo.jsx    # ConflictForge brand mark & typography
    │       └── ThemeToggle.jsx  # Dark/Light mode toggle button
    │
    └── pages/                   # Full-screen page views
        └── home/
            ├── HomePage.jsx     # Landing page view (headline, search pill, preview modal)
            └── index.js         # Barrel export for clean importing
```

### Detailed File Descriptions

| File Path | Description & Purpose |
| :--- | :--- |
| `src/main.jsx` | React root mounting point. Renders `<App />` inside `<React.StrictMode>`. |
| `src/App.jsx` | Master layout component. Wraps the app in `ThemeProvider`, renders `Navbar`, current page view, and global modals. |
| `src/index.css` | Design system tokens. Defines colors for `[data-theme='dark']` and `[data-theme='light']`, typography resets, layout styles, and animations. |
| `src/constants/navItems.js` | Single source of truth for the navbar links (`Dashboard`, `Pull requests`, `How it works`). |
| `src/context/ThemeContext.jsx` | Exposes `useTheme()` hook (`theme`, `toggleTheme`, `isDark`). Automatically syncs the `data-theme` attribute on the `<html>` root and persists to `localStorage`. |
| `src/hooks/useRepoForm.js` | Separates form logic from UI. Manages URL state, validation regex, "Use the sample pull request" injection, and simulated analysis status. |
| `src/components/common/Button.jsx` | Polymorphic button accepting `variant` (`primary`, `outline`), `size` (`sm`, `md`, `lg`), `icon`, and custom `className`. |
| `src/components/common/Icon.jsx` | Inline SVG icons (`GitForkIcon`, `SunIcon`, `MoonIcon`, `LinkIcon`, `CheckIcon`, `CloseIcon`). Handcrafted, fast rendering, zero external dependencies. |
| `src/components/common/LoginModal.jsx` | Self-contained, accessible authentication dialog triggered by the "Login" button in the header. |
| `src/components/layout/Navbar.jsx` | Sticky-ready header component containing logo, navigation pills, theme toggle, and login button. |
| `src/components/layout/BrandLogo.jsx` | Brand identity combining the git-fork SVG mark with "ConflictForge" typography. |
| `src/components/layout/ThemeToggle.jsx` | Icon button showing `SunIcon` in dark mode and `MoonIcon` in light mode. |
| `src/pages/home/HomePage.jsx` | The landing page view matching the designs. Contains hero typography, capsule URL input, and the conflict analysis breakdown modal. |

---

## 3. Reusable Components & Primitives (Available for Immediate Use)

Your team does not need to reinvent common UI blocks. The following components are ready to be used anywhere:

### 1. `<Button />` (`src/components/common/Button.jsx`)
Standardized button component adhering to the ConflictForge design system.

```jsx
import { Button } from '../components/common/Button';
import { GitForkIcon } from '../components/common/Icon';

// Primary button (high-contrast pill)
<Button variant="primary" size="md" onClick={handleAction}>
  Submit Conflict
</Button>

// Outline button with an icon
<Button variant="outline" size="sm" icon={GitForkIcon} onClick={handleInspect}>
  Inspect Merge
</Button>

// Custom styling override (you are never locked in!)
<Button variant="outline" className="danger-button" onClick={handleDelete}>
  Delete Branch
</Button>
```

### 2. `<Icon />` (`src/components/common/Icon.jsx`)
Centralized library of SVG icons. All icons accept `size`, `className`, and standard SVG props:
- `<GitForkIcon size={22} />`
- `<SunIcon size={18} />`
- `<MoonIcon size={18} />`
- `<LinkIcon size={18} />`
- `<CheckIcon size={16} />`
- `<CloseIcon size={18} />`

### 3. `<Navbar />` (`src/components/layout/Navbar.jsx`)
Drop this at the top of any new page. It automatically reads the navigation configuration, tracks the active page, and houses the theme switcher and login button.

### 4. `useTheme()` Hook (`src/context/ThemeContext.jsx`)
Access the current theme state anywhere in your code:
```jsx
import { useTheme } from '../context/ThemeContext';

const MyComponent = () => {
  const { theme, isDark, toggleTheme } = useTheme();
  return <p>Current mode is: {theme}</p>;
};
```

### 5. Global CSS Variables (`src/index.css`)
When creating styles for new pages, use the existing CSS variables so themes switch automatically:
- Backgrounds: `var(--bg-primary)`, `var(--bg-surface)`, `var(--bg-pill-active)`
- Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
- Borders: `var(--border-subtle)`, `var(--border-input)`, `var(--border-focus)`
- Status: `var(--status-clash)`, `var(--status-ready)`

---

## 4. How to Continue Development & Add New Pages

### Step 1: Create the Page Component in `src/pages/`
For example, to create a **Dashboard** page:

1. Create a folder `src/pages/dashboard/`:
2. Create `src/pages/dashboard/DashboardPage.jsx`:

```jsx
import React from 'react';
import { Button } from '../../components/common/Button';
import { GitForkIcon } from '../../components/common/Icon';

export const DashboardPage = () => {
  return (
    <div className="dashboard-page">
      <div className="dashboard-container" style={{ maxWidth: '1240px', margin: '0 auto', padding: '3rem 2rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Active Merge Clashes
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Monitor and resolve incoming pull request conflicts in real-time.
          </p>
        </header>

        {/* Action Bar */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <Button variant="primary" icon={GitForkIcon}>Scan Repository</Button>
          <Button variant="outline">Filter Conflicts</Button>
        </div>

        {/* PR List / Cards */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '1rem', padding: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>No pending merge conflicts detected.</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
```

---

### Step 2: Switch Views or Set Up Routing

#### Option A: Quick State-Based View Switching (No Extra Packages Needed)
In `src/App.jsx`, track the active view:

```jsx
import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { HomePage } from './pages/home/HomePage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { LoginModal } from './components/common/LoginModal';

export const App = () => {
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'dashboard'
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="app-layout">
        <Navbar 
          onNavigate={(viewId) => setCurrentView(viewId)}
          onLoginClick={() => setIsLoginOpen(true)} 
        />
        
        {currentView === 'home' && <HomePage />}
        {currentView === 'dashboard' && <DashboardPage />}

        <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      </div>
    </ThemeProvider>
  );
};
```

#### Option B: React Router (Standard for Multi-Page Production Apps)
Install `react-router-dom`:
```bash
npm install react-router-dom
```
Wrap routes in `src/App.jsx` with `<Routes>` and `<Route path="/dashboard" element={<DashboardPage />} />`.

---

### Step 3: Connecting to the Backend Service

Notice there is already a `backend/` folder in the project root.

To connect your UI to real API endpoints, **you only touch the custom hook**:
- Open `src/hooks/useRepoForm.js`.
- Replace the mock `setTimeout` inside `handleSubmit` with your real endpoint:

```javascript
// Replace lines 45-56 in src/hooks/useRepoForm.js:
try {
  setIsLoading(true);
  const response = await fetch('http://localhost:5000/api/analyze-pr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prUrl: trimmed }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to analyze pull request');
  }

  const data = await response.json();
  setAnalysisResult(data);
} catch (err) {
  setError(err.message || 'Something went wrong while scanning the PR.');
} finally {
  setIsLoading(false);
}
```
**Why this is great for your team:** The visual page (`HomePage.jsx`) remains 100% untouched while you upgrade the backend logic.

---

## 5. Development Commands

Run the Vite development server locally:
```bash
cd vite-project
npm run dev
```

Build for production:
```bash
cd vite-project
npm run build
```

Preview production build:
```bash
cd vite-project
npm run preview
```
