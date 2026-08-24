/**
 * Format teacher names for a section from course-enrollment / section APIs.
 * Prefers `teachers[]`, falls back to legacy single `teacher` / `teacherId`.
 */
export function getSectionTeacherNames(section) {
  if (!section) return [];

  if (Array.isArray(section.teachers) && section.teachers.length > 0) {
    return section.teachers
      .map((teacher) => teacher?.name || teacher?.userId?.name || teacher?.email)
      .filter(Boolean);
  }

  if (Array.isArray(section.teacherIds) && section.teacherIds.length > 0) {
    return section.teacherIds
      .map((teacher) => {
        if (typeof teacher === "string") return null;
        return teacher?.userId?.name || teacher?.name || teacher?.email;
      })
      .filter(Boolean);
  }

  const single = section.teacher || section.teacherId;
  if (single) {
    const name =
      single.name ||
      single.userId?.name ||
      (single.firstName && single.lastName ? `${single.firstName} ${single.lastName}` : null) ||
      single.email;
    if (name) return [name];
  }

  return [];
}

export function formatSectionTeachers(section, fallback = "No teacher assigned") {
  const names = getSectionTeacherNames(section);
  return names.length > 0 ? names.join(", ") : fallback;
}

export function formatSectionOptionLabel(section) {
  const sectionName = section?.section || section?.name || "—";
  const teachers = formatSectionTeachers(section);
  return `Section ${sectionName} - ${teachers}`;
}
