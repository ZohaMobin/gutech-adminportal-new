import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { assertEnv } from './config/env';
import { installAuthInterceptor } from './api/authInterceptor';
import { installNoWheelNumbers } from './utils/noWheelNumber';
import { installExtensionErrorFilter } from './utils/ignoreExtensionErrors';

const container = document.getElementById('root');

try {
  assertEnv();
  // Central token header + 401 handling for every axios call in the portal.
  installExtensionErrorFilter();
installNoWheelNumbers();
  installAuthInterceptor({ tokenKey: 'adminToken', userKey: 'adminUser' });
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
