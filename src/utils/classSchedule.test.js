import { axisOf, clashesFor, clashingIds, clashSentence, courseColors, defaultTeacherId, entityOptions, knownRooms, layoutDay, matchesEntity, popularPeriods, sectionsWithoutClasses, visibleDays } from "./classSchedule";

let n = 0;
const row = (day, start, end, room, teacher, section, course = "CS-101") => ({ _id: `r${++n}`, day, timeSlot: { startTime: start, endTime: end, room }, teacherId: { _id: teacher, userId: { name: `T-${teacher}` } }, sectionId: section, courseId: { _id: course, code: course, name: course } });

test("Monday to Friday always; a weekend day only when it has a class", () => {
  expect(visibleDays([])).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  expect(visibleDays([row("Saturday", "09:00", "10:00", "SF1", "t", "s")])).toContain("Saturday");
});

test("a clash is the room, the teacher or the section in two places at once, only when the times really overlap", () => {
  const existing = [row("Monday", "11:45", "13:10", "SL", "t1", "s1")];
  const at = (start, end, room, teacher, section) => ({ day: "Monday", timeSlot: { startTime: start, endTime: end, room }, teacherId: teacher, sectionId: section });
  expect(clashesFor(at("12:00", "13:00", "SL", "t2", "s2"), existing).map((c) => c.kind)).toEqual(["room"]);
  expect(clashesFor(at("12:00", "13:00", "SF1", "t1", "s2"), existing).map((c) => c.kind)).toEqual(["teacher"]);
  expect(clashesFor(at("12:00", "13:00", "SF1", "t2", "s1"), existing).map((c) => c.kind)).toEqual(["section"]);
  expect(clashesFor(at("12:00", "13:00", "SL", "t1", "s1"), existing).map((c) => c.kind)).toEqual(["teacher", "room", "section"]);
  expect(clashesFor(at("13:10", "14:00", "SL", "t1", "s1"), existing)).toEqual([]);         // back to back is not a clash
  expect(clashesFor({ ...at("12:00", "13:00", "SL", "t1", "s1"), day: "Tuesday" }, existing)).toEqual([]);
});

test("editing a class does not clash with itself", () => {
  const existing = [row("Monday", "11:45", "13:10", "SL", "t1", "s1")];
  const draft = { day: "Monday", timeSlot: { startTime: "12:00", endTime: "13:00", room: "SL" }, teacherId: "t1", sectionId: "s1" };
  expect(clashesFor(draft, existing).length).toBeGreaterThan(0);
  expect(clashesFor(draft, existing, existing[0]._id)).toEqual([]);
});

test("two online classes may overlap, because there is no room to double-book", () => {
  const existing = [row("Monday", "12:00", "13:10", "ONLINE", "t1", "s1")];
  const draft = { day: "Monday", timeSlot: { startTime: "12:00", endTime: "13:10", room: "online" }, teacherId: "t2", sectionId: "s2" };
  expect(clashesFor(draft, existing)).toEqual([]);
  expect(clashesFor({ ...draft, teacherId: "t1" }, existing).map((c) => c.kind)).toEqual(["teacher"]);   // but one teacher still cannot be in two classes
});

test("every clashing class is listed once, on both sides", () => {
  const a = row("Wednesday", "11:45", "13:10", "SF1", "t1", "s1"); const b = row("Wednesday", "12:00", "13:00", "SF1", "t2", "s2"); const c = row("Wednesday", "14:00", "15:25", "SF1", "t1", "s1");
  expect([...clashingIds([a, b, c])].sort()).toEqual([a._id, b._id].sort());
});

test("a clash is described in plain words", () => {
  const other = row("Wednesday", "11:45", "13:10", "SL", "t1", "s1");
  expect(clashSentence({ kind: "room", other }, () => "Data Structures Lab")).toBe("Room SL is in use on Wednesday 11:45–1:10 PM: Data Structures Lab");
  expect(clashSentence({ kind: "teacher", other })).toMatch(/already teaching on Wednesday/);
  expect(clashSentence({ kind: "section", other })).toMatch(/This section already has a class/);
});

test("the axis fits the whole timetable to the half hour, and an empty timetable gets a working day", () => {
  expect(axisOf([row("Monday", "08:30", "09:55", "SF1", "t", "s"), row("Friday", "14:00", "15:25", "SF1", "t", "s")])).toEqual({ start: 510, end: 930, ticks: [510, 540, 600, 660, 720, 780, 840, 900] });
  expect(axisOf([])).toMatchObject({ start: 510, end: 930 });
  expect(axisOf([row("Monday", "09:30", "11:30", "SL", "t", "s"), row("Monday", "16:00", "17:10", "SL", "t", "s")])).toMatchObject({ start: 570, end: 1050 });
});

test("classes keep their own times, and overlapping ones share the width", () => {
  const layout = layoutDay([row("Monday", "09:30", "11:30", "SL", "t1", "s1"), row("Monday", "11:00", "12:00", "SF1", "t2", "s2"), row("Monday", "14:00", "15:25", "SF1", "t1", "s1")], 510);
  expect(layout.map((l) => [l.top, l.length, l.lane, l.cols])).toEqual([[60, 120, 0, 2], [150, 60, 1, 2], [330, 85, 0, 1]]);
});

test("views: options and matching for a section, a teacher and a room", () => {
  const sections = [{ _id: "s2", section: "A", courseId: { name: "Zoology" } }, { _id: "s1", section: "B26-F", courseId: { name: "Databases" } }];
  const teachers = [{ _id: "t1", userId: { name: "Dr. A" } }];
  const schedules = [row("Monday", "08:30", "09:55", "SF1", "t1", "s1"), row("Tuesday", "08:30", "09:55", "SF1", "t1", "s1"), row("Tuesday", "10:10", "11:35", "SL", "t1", "s2")];
  expect(entityOptions("section", { sections, teachers, schedules }).map((o) => o.label)).toEqual(["Databases · B26-F", "Zoology · A"]);
  expect(entityOptions("teacher", { sections, teachers, schedules })).toEqual([{ value: "t1", label: "Dr. A" }]);
  expect(entityOptions("room", { sections, teachers, schedules }).map((o) => o.value)).toEqual(["SF1", "SL"]);       // the busiest room first
  expect(schedules.filter(matchesEntity("section", "s1")).length).toBe(2);
  expect(schedules.filter(matchesEntity("teacher", "t1")).length).toBe(3);
  expect(schedules.filter(matchesEntity("room", "sl")).length).toBe(1);
  expect(knownRooms(schedules)).toEqual(["SF1", "SL"]);
});

test("the form offers the class windows already in use, and the sections still without a timetable", () => {
  const schedules = [row("Monday", "08:30", "09:55", "SF1", "t", "s1"), row("Tuesday", "08:30", "09:55", "SF1", "t", "s1"), row("Monday", "10:10", "11:35", "SF1", "t", "s1")];
  expect(popularPeriods(schedules)).toEqual([["08:30", "09:55"], ["10:10", "11:35"]]);
  expect(sectionsWithoutClasses([{ _id: "s1" }, { _id: "s9" }], schedules).map((s) => s._id)).toEqual(["s9"]);
  expect(defaultTeacherId({ teacherIds: [{ _id: "t5" }] })).toBe("t5");
  expect(defaultTeacherId({ teacherId: { _id: "t3" }, teacherIds: [{ _id: "t5" }] })).toBe("t3");
});

test("each course has one tone; a lab shares its theory course's tone, deeper; never gold", () => {
  const colors = courseColors([row("Monday", "08:30", "09:55", "SF1", "t", "s", "CS-301"), row("Monday", "10:10", "11:35", "SF1", "t", "s", "CS-301L"), row("Monday", "11:45", "13:10", "SF1", "t", "s", "CS-202")]);
  expect(colors["CS-301"]["--card-accent"]).toBe(colors["CS-301L"]["--card-accent"]);
  expect(colors["CS-301"]["--card-bg"]).toMatch(/, 0\.12\)$/);
  expect(colors["CS-301L"]["--card-bg"]).toMatch(/, 0\.2\)$/);
  expect(colors["CS-202"]["--card-accent"]).not.toBe(colors["CS-301"]["--card-accent"]);
  expect(Object.values(colors).some((c) => ["#f5c32c", "#ecd07a"].includes(c["--card-accent"]))).toBe(false);
});
