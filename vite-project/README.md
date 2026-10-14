# ConflictForge UI

A clean, responsive, and accessible home landing page for **ConflictForge** built in **React** with Vanilla CSS.

## Features

- **Pixel-Accurate Visual Design**: Recreates the dark mode and warm ivory light mode layouts matching the provided designs.
- **Theme Switcher**: Smooth toggle between Dark Mode (default) and Light Mode (persisted in `localStorage`).
- **Pill Navigation**: Interactive pill navigation with active state styling.
- **Login Action**: "Login" button pill in the header replacing "Connect GitHub" with an interactive mock login dialog.
- **Repository / Pull Request Input Capsule**:
  - Full pill wrapper with link icon prefix.
  - "Try it out" action button.
  - Interactive "Use the sample pull request" link that auto-populates the input.
  - Simulated in-browser conflict analysis preview modal.
- **Zero Heavy External Icon Dependencies**: Handcrafted, ultra-lightweight inline SVG icons for instant render speed.

---

## Clean Architecture (KISS + Pragmatic SOLID)

```text
src/
├── main.jsx                     # React entry point
├── App.jsx                      # App root (Theme provider, Navbar, HomePage, LoginModal)
├── index.css                    # Design system & theme tokens (Dark & Light)
│
├── pages/
│   └── home/
│       ├── HomePage.jsx         # Consolidated home landing page view (KISS)
│       └── index.js             # Re-export
│
├── components/
│   ├── common/
│   │   ├── Button.jsx           # Reusable button with variants
│   │   ├── Icon.jsx             # SVG icons (Git fork, Sun, Moon, Link, Check, Close)
│   │   └── LoginModal.jsx       # Interactive Login dialog
│   └── layout/
│       ├── Navbar.jsx           # Top navigation bar
│       ├── BrandLogo.jsx        # ConflictForge logo
│       └── ThemeToggle.jsx      # Dark/Light mode toggle
│
├── context/
│   └── ThemeContext.jsx         # Theme state & localStorage persistence
│
├── hooks/
│   └── useRepoForm.js           # Form handling & sample PR injection logic
│
└── constants/
    └── navItems.js              # Navigation configuration
```

---

## Getting Started

To run locally in development mode:

```bash
cd vite-project
npm run dev
```
