import axios from 'axios';

// One place for the two things every page used to do on its own:
//   1. send the stored token when a request has no Authorization header yet;
//   2. when the server says 401 (expired, revoked or invalid token), clear the session and
//      return to the login page instead of leaving the user on a page full of generic errors.
// Calls under /api/auth/ are exempt: a 401 there means wrong credentials, not a dead session.
export function installAuthInterceptor({ tokenKey, userKey, loginPath = '/' }) {
  const requestId = axios.interceptors.request.use((config) => {
    const token = sessionStorage.getItem(tokenKey);
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  const responseId = axios.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = error.config?.url || '';
      const hadSession = Boolean(sessionStorage.getItem(tokenKey));
      if (error.response?.status === 401 && hadSession && !url.includes('/api/auth/')) {
        sessionStorage.removeItem(tokenKey);
        sessionStorage.removeItem(userKey);
        delete axios.defaults.headers.common.Authorization;
        if (window.location.pathname !== loginPath) window.location.assign(loginPath);
      }
      return Promise.reject(error);
    }
  );

  // Returned so tests (or a hot reload) can remove exactly what was installed.
  return () => {
    axios.interceptors.request.eject(requestId);
    axios.interceptors.response.eject(responseId);
  };
}
