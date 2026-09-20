import { initialsOf, countByStatus, visibleAdmins } from './adminListUtils';

const admins = [
  { _id: '1', name: 'Zed Last', email: 'zed@gu.edu', employeeId: 'E-9', status: 'active', isSuperAdmin: false },
  { _id: '2', name: 'Boss Person', email: 'boss@gu.edu', employeeId: 'E-1', status: 'active', isSuperAdmin: true },
  { _id: '3', name: 'Ann Lee', email: 'ann@gu.edu', employeeId: 'E-2', status: 'active', isSuperAdmin: false },
  { _id: '4', name: 'Old Timer', email: 'old@gu.edu', employeeId: 'E-3', status: 'deactivated', isSuperAdmin: false },
];

test('initials use the first two words and never crash', () => {
  expect(initialsOf('Zoha Mobin Khan')).toBe('ZM');
  expect(initialsOf('admin')).toBe('A');
  expect(initialsOf('')).toBe('?');
  expect(initialsOf(undefined)).toBe('?');
});

test('counts split active and deactivated', () => {
  expect(countByStatus(admins)).toEqual({ active: 3, deactivated: 1 });
});

test('the active tab lists active admins with the super admin first, then by name', () => {
  expect(visibleAdmins(admins, { status: 'active', query: '' }).map((a) => a.name)).toEqual(['Boss Person', 'Ann Lee', 'Zed Last']);
});

test('the deactivated tab lists only deactivated admins', () => {
  expect(visibleAdmins(admins, { status: 'deactivated', query: '' }).map((a) => a._id)).toEqual(['4']);
});

test('search matches name, email or employee ID, ignoring case and spaces', () => {
  expect(visibleAdmins(admins, { status: 'active', query: '  ANN ' }).map((a) => a._id)).toEqual(['3']);
  expect(visibleAdmins(admins, { status: 'active', query: 'boss@gu' }).map((a) => a._id)).toEqual(['2']);
  expect(visibleAdmins(admins, { status: 'active', query: 'e-9' }).map((a) => a._id)).toEqual(['1']);
  expect(visibleAdmins(admins, { status: 'active', query: 'nobody' })).toEqual([]);
});

test('search does not cross tabs', () => {
  expect(visibleAdmins(admins, { status: 'active', query: 'old' })).toEqual([]);
});
