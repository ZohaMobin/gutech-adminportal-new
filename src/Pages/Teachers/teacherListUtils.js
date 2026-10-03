// Pure helpers for the Teachers screen (kept separate so they can be unit-tested).

export const countByStatus = (teachers) => ({
  active: teachers.filter((t) => t.status === 'active').length,
  deactivated: teachers.filter((t) => t.status === 'deactivated').length,
});

// Filter by tab and a free-text query over name, email, employee ID and department, sorted by name.
export const visibleTeachers = (teachers, { status, query }) => {
  const q = (query || '').trim().toLowerCase();
  return teachers
    .filter((t) => t.status === status)
    .filter((t) => !q || [t.name, t.email, t.employeeId, t.department].some((field) => String(field || '').toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const sectionsText = (count) => (count ? `${count} section${count === 1 ? '' : 's'}` : 'No sections');
