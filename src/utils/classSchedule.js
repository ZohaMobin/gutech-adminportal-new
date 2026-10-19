// The rules behind the admin Class Schedule page, as pure functions: where a class sits on the week, which classes clash, and what the
// add-class form can suggest. A schedule row is { _id, day, timeSlot: { startTime, endTime, room }, teacherId, sectionId, courseId }.

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const EXTRA_DAYS = ["Saturday", "Sunday"];
const idOf = (value) => String(value?._id ?? value ?? "");
export const minutesOf = (time) => { const [h, m] = String(time || "").split(":").map(Number); return h * 60 + (m || 0); };
export const timeOf = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const to12Hour = (time) => { const [h, m] = String(time).split(":"); const hour = parseInt(h, 10); return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`; };
export const to12Bare = (time) => to12Hour(time).replace(/ (AM|PM)$/, "");
export const isOnline = (room) => String(room || "").trim().toUpperCase() === "ONLINE";

export const visibleDays = (schedules) => [...DAYS, ...EXTRA_DAYS.filter((day) => schedules.some((s) => s.day === day))];

export const sectionOf = (schedule) => idOf(schedule?.sectionId);
export const teacherOf = (schedule) => idOf(schedule?.teacherId);
export const roomOf = (schedule) => String(schedule?.timeSlot?.room || "").trim();
export const startOf = (schedule) => minutesOf(schedule?.timeSlot?.startTime);
export const endOf = (schedule) => minutesOf(schedule?.timeSlot?.endTime);

const overlaps = (a, b) => a.day === b.day && startOf(a) < endOf(b) && endOf(a) > startOf(b);

// What a class (or a draft of one) clashes with: the room, the teacher, or the section being in two places at once. A class online
// has no room to double-book, so two online classes may overlap. Returns [{ kind, other }].
export const clashesFor = (draft, schedules, ignoreId = null) => {
  const clashes = [];
  for (const other of schedules) {
    if (ignoreId && idOf(other._id) === String(ignoreId)) continue;
    if (!overlaps(draft, other)) continue;
    if (teacherOf(draft) && teacherOf(draft) === teacherOf(other)) clashes.push({ kind: "teacher", other });
    if (roomOf(draft) && !isOnline(roomOf(draft)) && roomOf(draft).toLowerCase() === roomOf(other).toLowerCase()) clashes.push({ kind: "room", other });
    if (sectionOf(draft) && sectionOf(draft) === sectionOf(other)) clashes.push({ kind: "section", other });
  }
  return clashes;
};

// The ids of every class that clashes with another, for the red outlines and the count at the top.
export const clashingIds = (schedules) => {
  const ids = new Set();
  schedules.forEach((schedule, index) => {
    for (let i = index + 1; i < schedules.length; i += 1) {
      const other = schedules[i];
      if (!overlaps(schedule, other)) continue;
      const clash = (teacherOf(schedule) && teacherOf(schedule) === teacherOf(other))
        || (roomOf(schedule) && !isOnline(roomOf(schedule)) && roomOf(schedule).toLowerCase() === roomOf(other).toLowerCase())
        || (sectionOf(schedule) && sectionOf(schedule) === sectionOf(other));
      if (clash) { ids.add(idOf(schedule._id)); ids.add(idOf(other._id)); }
    }
  });
  return ids;
};

// One plain sentence per clash, for the form and the details card.
export const clashSentence = ({ kind, other }, label) => {
  const when = `${other.day} ${to12Bare(other.timeSlot.startTime)}–${to12Hour(other.timeSlot.endTime)}`;
  const what = label?.(other) || "another class";
  if (kind === "room") return `Room ${roomOf(other)} is in use on ${when}: ${what}`;
  if (kind === "teacher") return `This teacher is already teaching on ${when}: ${what}`;
  return `This section already has a class on ${when}: ${what}`;
};

// The week's time axis: one range for the whole timetable, so it does not jump when another section is chosen. It starts at the earliest
// class and ends at the latest, each to the half hour; a timetable with nothing in it yet gets a working day.
export const axisOf = (schedules) => {
  const rows = schedules.filter((s) => s?.timeSlot?.startTime && s?.timeSlot?.endTime);
  const start = rows.length ? Math.floor(Math.min(...rows.map(startOf)) / 30) * 30 : 8 * 60 + 30;
  const end = rows.length ? Math.ceil(Math.max(...rows.map(endOf)) / 30) * 30 : 15 * 60 + 30;
  const ticks = [start];
  for (let t = Math.ceil(start / 60) * 60; t <= end; t += 60) if (t > start + 10) ticks.push(t);
  return { start, end, ticks };
};

// A day's classes with their place in the column: minutes from the top, length, and which of `cols` side-by-side lanes they take.
export const layoutDay = (items, axisStart) => {
  const sorted = [...items].sort((a, b) => startOf(a) - startOf(b) || endOf(a) - endOf(b));
  const placed = sorted.map((schedule) => ({ schedule, from: startOf(schedule), to: endOf(schedule), lane: 0, cols: 1 }));
  let group = []; let groupEnd = -1;
  const settle = () => { const cols = Math.max(1, ...group.map((p) => p.lane + 1)); group.forEach((p) => { p.cols = cols; }); group = []; };
  for (const item of placed) {
    if (group.length && item.from >= groupEnd) { settle(); groupEnd = -1; }
    const taken = new Set(group.filter((other) => other.to > item.from).map((other) => other.lane));
    while (taken.has(item.lane)) item.lane += 1;
    group.push(item); groupEnd = Math.max(groupEnd, item.to);
  }
  settle();
  return placed.map((p) => ({ schedule: p.schedule, top: p.from - axisStart, length: p.to - p.from, lane: p.lane, cols: p.cols }));
};

// ---- what to show: by section, by teacher or by room ----
export const MODES = [["all", "All"], ["section", "Section"], ["teacher", "Teacher"], ["room", "Room"], ["cohort", "Semester"]];

export const sectionLabel = (section) => `${section?.courseId?.name || "Section"} · ${section?.section || section?.name || "-"}`;
export const teacherName = (teacher) => teacher?.userId?.name || teacher?.name || teacher?.email || "";

export const entityOptions = (mode, { sections, teachers, schedules, cohorts }) => {
  if (mode === "all") return [];
  if (mode === "cohort") return cohortOptions(cohorts);
  if (mode === "section") return sections.map((s) => ({ value: idOf(s), label: sectionLabel(s) })).sort((a, b) => a.label.localeCompare(b.label));
  if (mode === "teacher") return teachers.map((t) => ({ value: idOf(t), label: teacherName(t) || "Teacher" })).sort((a, b) => a.label.localeCompare(b.label));
  return knownRooms(schedules).map((room) => ({ value: room, label: room }));
};

// Every teacher of each section (its teacher list and its main teacher), so a co-teacher sees the section's classes in their own timetable.
export const teachersBySection = (sections) => new Map(sections.map((section) => [idOf(section), new Set([...(section.teacherIds || []), section.teacherId].filter(Boolean).map(idOf))]));

export const matchesEntity = (mode, entity, cohorts, sectionTeachers) => (schedule) => {
  if (mode === "section") return sectionOf(schedule) === entity;
  if (mode === "teacher") return teacherOf(schedule) === entity || Boolean(sectionTeachers?.get(sectionOf(schedule))?.has(entity));
  if (mode === "cohort") return (cohorts?.get(sectionOf(schedule)) || []).some((cohort) => cohort.key === entity);
  return roomOf(schedule).toLowerCase() === String(entity).toLowerCase();
};

export const knownRooms = (schedules) => {
  const counts = new Map();
  schedules.forEach((s) => { const room = roomOf(s); if (room) counts.set(room, (counts.get(room) || 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([room]) => room);
};

// The class windows in use, most common first, as one-click choices in the form (the standard periods, once they exist in the data).
export const popularPeriods = (schedules, limit = 5) => {
  const counts = new Map();
  schedules.forEach((s) => { const key = `${s?.timeSlot?.startTime}|${s?.timeSlot?.endTime}`; if (s?.timeSlot?.startTime && s?.timeSlot?.endTime) counts.set(key, (counts.get(key) || 0) + 1); });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([key]) => key.split("|")).sort((a, b) => a[0].localeCompare(b[0]));
};

export const sectionsWithoutClasses = (sections, schedules) => {
  const scheduled = new Set(schedules.map(sectionOf));
  return sections.filter((section) => !scheduled.has(idOf(section)));
};

// The teacher to start the form with: the section's first teacher.
export const defaultTeacherId = (section) => idOf(section?.teacherId || section?.teacherIds?.[0] || section?.teachers?.[0]);

// One tone per course from a short palette that sits with the portal's maroon (gold is left out: it means "now"). A lab (CS-301L) shares its
// theory course's tone, a little deeper. Colours go to courses in sorted order, so they do not depend on the order the rows arrive in.
const TONES = [["#991d20", "#6b1416"], ["#0f766e", "#0b4f4a"], ["#4f5bb5", "#2f3880"], ["#5f8f3e", "#37591f"], ["#86447f", "#59295a"], ["#c2562f", "#80351a"], ["#2f6fa3", "#1d4a73"], ["#be3a64", "#7d2144"], ["#64748b", "#334155"]];
const labOf = (code) => { const match = /^(.*\d)L$/i.exec(String(code || "").trim()); return match ? match[1] : null; };
const rgba = (hex, alpha) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; };
export const courseKey = (schedule) => schedule?.courseId?.code || idOf(schedule?.courseId);
export const courseColors = (schedules) => {
  const codes = new Map();
  schedules.forEach((s) => { const key = courseKey(s); if (key) codes.set(key, String(s?.courseId?.code || key)); });
  const groupOf = (code) => labOf(code) || code;
  const groups = [...new Set([...codes.values()].map(groupOf))].sort();
  const result = {};
  codes.forEach((code, key) => {
    const [accent, ink] = TONES[groups.indexOf(groupOf(code)) % TONES.length];
    result[key] = { "--card-accent": accent, "--card-ink": ink, "--card-bg": rgba(accent, labOf(code) ? 0.2 : 0.12) };
  });
  return result;
};

// ---- cohorts: the students of one program in one semester ----
// A course offering says which program and semester a course is offered to. A section belongs to its offering's cohort; with no offering
// recorded on the section, to every offering of its course this term (a course offered to two semesters belongs to both). The student's own
// semester field is deliberately not used: it is not kept up to date. Returns Map sectionId -> [{ key, label }].
export const cohortLabel = (offering) => `${offering?.program?.code || offering?.program?.name || "Program"} · Semester ${offering?.semester ?? "?"}`;
export const cohortsBySection = (sections, offerings) => {
  const byId = new Map(offerings.map((o) => [idOf(o), o]));
  const byCourse = new Map();
  offerings.forEach((o) => { const key = idOf(o.courseId); byCourse.set(key, [...(byCourse.get(key) || []), o]); });
  const result = new Map();
  sections.forEach((section) => {
    const own = section.courseOfferingId && byId.get(idOf(section.courseOfferingId));
    const list = own ? [own] : byCourse.get(idOf(section.courseId)) || [];
    const seen = new Set();
    result.set(idOf(section), list.map((o) => ({ key: `${idOf(o.program)}|${o.semester}`, label: cohortLabel(o) })).filter((c) => (seen.has(c.key) ? false : seen.add(c.key))));
  });
  return result;
};
export const cohortOptions = (cohorts) => {
  const labels = new Map();
  (cohorts ? [...cohorts.values()].flat() : []).forEach((c) => labels.set(c.key, c.label));
  return [...labels.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
};

// Students of one cohort cannot be in two classes at once: a warning (not a block) for a class (or draft) that overlaps another class of the
// same cohort. Two sections of one course are alternatives, so they are not compared with each other. Returns [{ other, cohort }].
export const cohortOverlapsFor = (draft, schedules, cohorts, ignoreId = null) => {
  const mine = cohorts?.get(sectionOf(draft)) || [];
  if (!mine.length) return [];
  const out = [];
  for (const other of schedules) {
    if (ignoreId && idOf(other._id) === String(ignoreId)) continue;
    if (!overlaps(draft, other) || sectionOf(other) === sectionOf(draft)) continue;
    if (idOf(other.courseId) === idOf(draft.courseId) && idOf(draft.courseId)) continue;
    const shared = (cohorts.get(sectionOf(other)) || []).find((c) => mine.some((m) => m.key === c.key));
    if (shared) out.push({ other, cohort: shared });
  }
  return out;
};
export const cohortOverlapIds = (schedules, cohorts) => {
  const ids = new Set();
  schedules.forEach((schedule) => { if (cohortOverlapsFor(schedule, schedules, cohorts, schedule._id).length) ids.add(idOf(schedule._id)); });
  return ids;
};
export const cohortSentence = ({ other, cohort }, label) => `${cohort.label} students also have ${label?.(other) || "another class"} on ${other.day} ${to12Bare(other.timeSlot.startTime)}–${to12Hour(other.timeSlot.endTime)}`;
