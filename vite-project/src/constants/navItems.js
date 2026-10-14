/**
 * Navigation item configuration
 * Follows Open/Closed Principle (OCP): new items can be added without modifying the navbar.
 */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: '#dashboard', isActive: true },
  { id: 'pull-requests', label: 'Pull requests', href: '#pull-requests', isActive: false },
  { id: 'how-it-works', label: 'How it works', href: '#how-it-works', isActive: false },
];

export const SAMPLE_PULL_REQUEST_URL = 'https://github.com/owner/repo/pull/42';
