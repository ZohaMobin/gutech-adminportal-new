import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { installAuthInterceptor } from './api/authInterceptor';

// Central token header + 401 handling for every axios call in the portal.
installAuthInterceptor({ tokenKey: 'adminToken', userKey: 'adminUser' });

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

