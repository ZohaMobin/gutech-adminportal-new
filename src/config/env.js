// Required build-time configuration. Checked once at startup so a missing value fails loudly
// with a clear message instead of silently calling localhost or "undefined/api/...".
export const API_URL = process.env.REACT_APP_BACKEND_URL;

export function assertEnv() {
  if (!API_URL || !/^https?:\/\//.test(API_URL)) {
    throw new Error(
      'REACT_APP_BACKEND_URL is not set (or is not an http(s) URL). ' +
        'Set it in the environment or .env before starting or building the portal.'
    );
  }
}
