import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { assertEnv } from './config/env';

const container = document.getElementById('root');

try {
  assertEnv();
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  // Show the configuration problem instead of a blank page.
  container.textContent = error.message;
  container.style.cssText = 'padding:24px;font-family:sans-serif;color:#8b1538';
  throw error;
}
