import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { initTheme } from './ui/theme';
import { salvageSettings } from './core/services/settingsMigration';
import App from './App';

// Repair drifted preference keys before anything reads them (Handy-style
// recover-instead-of-crash), then restore skin + mode before first paint.
salvageSettings();
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: offline app shell (production only — keeps HMR clean in dev).
// BASE_URL keeps the worker inside a GitHub Pages project subpath.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
