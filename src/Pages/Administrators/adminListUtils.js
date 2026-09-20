// Pure helpers for the Administrators screen (kept separate so they can be unit-tested).

export const initialsOf = (name = '') =>
  (name || '?').split(' ').filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('') || '?';

export const countByStatus = (admins) => ({
  active: admins.filter((a) => a.status === 'active').length,
  deactivated: admins.filter((a) => a.status === 'deactivated').length,
});

// Filter by tab (active/deactivated) and a free-text query over name, email and employee ID.
// The super admin always sorts first, then by name.
export const visibleAdmins = (admins, { status, query }) => {
  const q = (query || '').trim().toLowerCase();
  return admins
    .filter((a) => a.status === status)
    .filter((a) => !q || [a.name, a.email, a.employeeId].some((field) => String(field || '').toLowerCase().includes(q)))
    .sort((a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin) || a.name.localeCompare(b.name));
};

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
