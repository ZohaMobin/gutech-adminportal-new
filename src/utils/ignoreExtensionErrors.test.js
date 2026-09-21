import { installExtensionErrorFilter } from './ignoreExtensionErrors';

let remove; let overlaySaw;
const overlay = (event) => { overlaySaw.push(event.message); };
beforeEach(() => { overlaySaw = []; window.addEventListener('error', overlay); remove = installExtensionErrorFilter(); });
afterEach(() => { remove(); window.removeEventListener('error', overlay); });

const raise = (init) => window.dispatchEvent(new ErrorEvent('error', { cancelable: true, ...init }));

test('an error from a browser extension never reaches the overlay', () => {
  raise({ message: "Cannot read properties of undefined (reading 'M_ID')", filename: 'chrome-extension://abc/executors/200.js' });
  expect(overlaySaw).toEqual([]);
});

test('an error from the app itself still does', () => {
  raise({ message: 'Our own bug', filename: 'http://localhost:3000/static/js/main.js' });
  expect(overlaySaw).toEqual(['Our own bug']);
});
