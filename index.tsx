
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { validateEnv } from './utils/envCheck';

// Validação de Ambiente (Segurança)
validateEnv();

if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return;
    }

    // Ctrl+Shift+I / J / C
    if (e.ctrlKey && e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
      e.preventDefault();
      return;
    }

    // Ctrl+U (view source)
    if (e.ctrlKey && key === 'u') {
      e.preventDefault();
      return;
    }
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
