import axios from 'axios';
import { installAuthInterceptor } from './authInterceptor';

const respond = (status, capture = {}) => async (config) => {
  capture.config = config;
  if (status >= 400) {
    const error = new Error(`status ${status}`);
    error.config = config;
    error.response = { status, data: {}, config };
    throw error;
  }
  return { status, data: {}, headers: {}, config };
};

let eject;
let assign;
const originalAdapter = axios.defaults.adapter;

beforeEach(() => {
  sessionStorage.clear();
  assign = jest.fn();
  delete window.location;
  window.location = { pathname: '/attendance', assign };
  eject = installAuthInterceptor({ tokenKey: 'adminToken', userKey: 'adminUser' });
});

afterEach(() => {
  eject();
  axios.defaults.adapter = originalAdapter;
});

test('adds the stored token when a request has no Authorization header', async () => {
  sessionStorage.setItem('adminToken', 'abc');
  const seen = {};
  axios.defaults.adapter = respond(200, seen);
  await axios.get('/api/courses');
  expect(seen.config.headers.Authorization).toBe('Bearer abc');
});

test('keeps an Authorization header the page set itself', async () => {
  sessionStorage.setItem('adminToken', 'abc');
  const seen = {};
  axios.defaults.adapter = respond(200, seen);
  await axios.get('/api/courses', { headers: { Authorization: 'Bearer page-token' } });
  expect(seen.config.headers.Authorization).toBe('Bearer page-token');
});

test('a 401 on a normal call ends the session and returns to login', async () => {
  sessionStorage.setItem('adminToken', 'abc');
  sessionStorage.setItem('adminUser', '{}');
  axios.defaults.adapter = respond(401);
  await expect(axios.get('/api/courses')).rejects.toThrow();
  expect(sessionStorage.getItem('adminToken')).toBeNull();
  expect(sessionStorage.getItem('adminUser')).toBeNull();
  expect(assign).toHaveBeenCalledWith('/');
});

test('a 401 from the auth endpoints (wrong password) does not log anyone out', async () => {
  sessionStorage.setItem('adminToken', 'abc');
  axios.defaults.adapter = respond(401);
  await expect(axios.post('/api/auth/change-password', {})).rejects.toThrow();
  expect(sessionStorage.getItem('adminToken')).toBe('abc');
  expect(assign).not.toHaveBeenCalled();
});

test('a 401 with no session (public page) does nothing', async () => {
  axios.defaults.adapter = respond(401);
  await expect(axios.get('/api/departments')).rejects.toThrow();
  expect(assign).not.toHaveBeenCalled();
});

test('other errors are passed through untouched', async () => {
  sessionStorage.setItem('adminToken', 'abc');
  axios.defaults.adapter = respond(500);
  await expect(axios.get('/api/courses')).rejects.toThrow();
  expect(sessionStorage.getItem('adminToken')).toBe('abc');
  expect(assign).not.toHaveBeenCalled();
});

test('does not redirect again when already on the login page', async () => {
  window.location.pathname = '/';
  sessionStorage.setItem('adminToken', 'abc');
  axios.defaults.adapter = respond(401);
  await expect(axios.get('/api/courses')).rejects.toThrow();
  expect(assign).not.toHaveBeenCalled();
});
