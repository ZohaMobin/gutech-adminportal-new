// Errors thrown by browser extensions (wallets, translators, page-savers) are not ours and cannot be fixed here. In development the
// error overlay would cover the whole app for them, so they are dropped before it sees them. Only extension-origin errors are
// filtered: anything from the app itself still shows.
const fromExtension = (event) => {
  const text = `${event.filename || ''} ${event.error?.stack || event.reason?.stack || ''}`;
  return /(chrome|moz|safari-web)-extension:\/\//.test(text);
};

export const installExtensionErrorFilter = () => {
  const drop = (event) => {
    if (!fromExtension(event)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  // Capture phase, so this runs before the development overlay's own listener.
  window.addEventListener('error', drop, true);
  window.addEventListener('unhandledrejection', drop, true);
  return () => {
    window.removeEventListener('error', drop, true);
    window.removeEventListener('unhandledrejection', drop, true);
  };
};
