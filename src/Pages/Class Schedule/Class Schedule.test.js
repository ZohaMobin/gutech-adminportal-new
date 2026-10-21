import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import ClassSchedule from "./Class Schedule";

jest.mock("axios");
jest.mock("react-icons/fi", () => new Proxy({}, { get: () => () => null }));
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error" } }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const { showToast } = require("../../Components/Toast/Toast");
const teacher = (id, name) => ({ _id: id, userId: { name } });
const T = [teacher("t1", "Dr. Khubaib Qureshi"), teacher("t2", "Dr. Twaha Minai"), teacher("t3", "Ms. Zoha Mobin")];
const course = (id, code, name) => ({ _id: id, code, name });
const section = (id, name, c, t) => ({ _id: id, section: name, courseId: c, teacherId: t });
const S = [section("s1", "A26-F", course("c1", "CS-202", "Database Systems"), T[0]), section("s2", "A26-F", course("c2", "CS-201", "Data Structures"), T[1]), section("s3", "A26-F", course("c3", "CL-202", "Database Systems Lab"), T[2]), section("s4", "B26-F", course("c4", "CS-301", "Web Engineering"), T[0])];
let n = 0;
const row = (sectionId, courseObj, teacherObj, day, start, end, room) => ({ _id: `r${++n}`, sectionId, courseId: courseObj, teacherId: teacherObj, day, timeSlot: { startTime: start, endTime: end, room } });
const baseRows = () => ({
  s1: [row("s1", S[0].courseId, T[0], "Monday", "08:30", "09:55", "SF1"), row("s1", S[0].courseId, T[0], "Monday", "11:45", "13:10", "SF1")],
  s2: [row("s2", S[1].courseId, T[1], "Monday", "10:10", "11:35", "SF1")],
  s3: [row("s3", S[2].courseId, T[2], "Thursday", "11:45", "13:10", "SL")],
  s4: [],
});

let container; let root; let rows; let offerings = [];
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(); };
// eslint-disable-next-line testing-library/no-unnecessary-act
const change = async (el, value) => act(async () => {
  const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const text = () => container.textContent;
const button = (label) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === label);

const mount = async ({ rowsOver, fail = false, conflicts = [], offers, landing = false } = {}) => {
  n = 0; rows = rowsOver || baseRows(); offerings = offers || [];
  sessionStorage.setItem("adminToken", "t");
  axios.get.mockImplementation(async (url) => {
    if (fail) throw Object.assign(new Error("Network Error"), { request: {}, code: "ERR_NETWORK" });
    if (url.endsWith("/api/sections")) return { data: S };
    if (url.endsWith("/api/teachers")) return { data: T };
    if (url.includes("/course-offerings")) return { data: offerings };
    if (url.includes("/academic-years/current")) return { data: { _id: "term1", semesterType: "Fall", year: 2026, displayName: "Fall 2026" } };
    const id = url.split("/").pop();
    return { data: rows[id] || [] };
  });
  axios.post.mockImplementation(async (url, body) => (url.includes("check-conflicts") ? { data: { conflicts } } : { data: { ...body, _id: "new" } }));
  axios.put.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => { root.render(<ClassSchedule />); });
  await wait(30);
  if (!landing && !fail) await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "Section"));    // most tests look at one section
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; sessionStorage.clear(); jest.clearAllMocks(); });

test("it opens on a section, in the usual page frame, with the term and its week", async () => {
  await mount();
  expect(container.querySelector(".page-head-title").textContent).toBe("Class Schedule");
  expect(container.querySelector(".cs-term").textContent).toBe("Fall 2026");
  expect(container.querySelector(".cs-entity option:checked").textContent).toBe("Data Structures · A26-F");     // first section, alphabetically
  const names = [...container.querySelectorAll(".cs-blk b")].map((b) => b.textContent);
  expect(names).toEqual(["Data Structures"]);
  expect(text()).toContain("1 class this week");
});

test("the time axis fits the classes being shown, so an evening programme is not squeezed into the morning", async () => {
  await mount();
  expect(container.querySelector(".cs-hours span").textContent).toBe("10a");                  // Data Structures starts at 10:10
  await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "All"));
  expect(container.querySelector(".cs-hours span").textContent).toBe("8:30a");                // the whole week starts at 8:30
});

test("the same timetable can be looked at by teacher or by room", async () => {
  await mount();
  await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "Room"));
  expect([...container.querySelectorAll(".cs-entity option")].map((o) => o.textContent)).toEqual(["SF1", "SL"]);
  expect(container.querySelectorAll(".cs-blk").length).toBe(3);                         // everything held in SF1
  await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "Teacher"));
  await change(container.querySelector(".cs-entity"), "t1");
  expect(container.querySelectorAll(".cs-blk").length).toBe(2);                         // Dr. Khubaib's two Monday classes
});

test("clicking a class shows its details with Edit and Delete, not buttons on every card", async () => {
  await mount();
  expect(container.querySelector(".cs-blk .am-btn, .cs-blk button")).toBeNull();
  await click(container.querySelector(".cs-blk"));
  const details = container.querySelector(".cs-details");
  expect(details.textContent).toContain("Data Structures · Section A26-F");
  expect(details.textContent).toContain("Monday · 10:10 AM – 11:35 AM · SF1 · Dr. Twaha Minai");
  expect(button("Edit")).toBeDefined();
  expect(button("Delete")).toBeDefined();
});

test("clashes are counted at the top, outlined on the board, and described in the details", async () => {
  const clash = baseRows();
  clash.s4 = [row("s4", S[3].courseId, T[1], "Monday", "10:30", "11:30", "SF1")];      // same room and same teacher as Data Structures, overlapping
  await mount({ rowsOver: clash });
  expect(container.querySelector(".cs-health").textContent).toContain("2 classes clash");
  await click(container.querySelector(".cs-health .cs-link"));
  expect(container.querySelector(".cs-blk.is-clash")).not.toBeNull();
  expect(container.querySelector(".cs-details .cs-check.is-bad").textContent).toMatch(/Room SF1 is in use on Monday/);
});

test("sections with no timetable yet are counted", async () => {
  await mount();
  expect(container.querySelector(".cs-health").textContent).toContain("1 section has no timetable yet");
});

test("the add form takes any time, offers the windows in use, and says a clash at once", async () => {
  await mount();
  await click(button("+ Add class"));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog).not.toBeNull();
  expect(dialog.querySelector('input[type="time"]').getAttribute("step")).toBe("300");     // not whole hours only
  expect([...dialog.querySelectorAll('[aria-label="Class windows in use"] button')].map((b) => b.textContent)).toContain("10:10–11:35 AM");
  expect(button("Add class").disabled).toBe(true);                                         // nothing chosen yet
  await change(dialog.querySelector("select"), "s4");                                      // Section: the AI section; its teacher comes along
  const [day] = dialog.querySelectorAll("select");
  expect(day).toBeDefined();
  const selects = dialog.querySelectorAll("select");
  await change(selects[1], "Monday");
  await change(dialog.querySelectorAll('input[type="time"]')[0], "10:30");
  await change(dialog.querySelectorAll('input[type="time"]')[1], "11:30");
  await change(dialog.querySelector('input[list="cs-rooms"]'), "SF1");
  await wait();
  expect(dialog.querySelector(".cs-check.is-bad").textContent).toMatch(/Room SF1 is in use on Monday 10:10–11:35 AM: Data Structures/);
  expect(button("Add class").disabled).toBe(true);
  await change(dialog.querySelector('input[list="cs-rooms"]'), "GF1");
  await wait();
  expect(dialog.querySelector(".cs-check.is-ok")).not.toBeNull();
  expect(button("Add class").disabled).toBe(false);
});

test("saving checks with the server too, then posts the class and refreshes", async () => {
  await mount();
  await click(button("+ Add class"));
  const dialog = document.querySelector('[role="dialog"]');
  const selects = dialog.querySelectorAll("select");
  await change(selects[0], "s4");
  await change(selects[1], "Friday");
  await change(dialog.querySelectorAll('input[type="time"]')[0], "08:30");
  await change(dialog.querySelectorAll('input[type="time"]')[1], "09:55");
  await change(dialog.querySelector('input[list="cs-rooms"]'), "GF1");
  await click(button("Add class"));
  await wait(30);
  expect(axios.post.mock.calls[0][0]).toContain("check-conflicts");
  const [url, body] = axios.post.mock.calls[1];
  expect(url).toMatch(/\/api\/section-schedules$/);
  expect(body).toMatchObject({ day: "Friday", sectionId: "s4", courseId: "c4", teacherId: "t1", timeSlot: { startTime: "08:30", endTime: "09:55", room: "GF1" }, academicYear: "Fall 2026" });
  expect(showToast).toHaveBeenCalledWith("Class added", "success");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test("a clash the server finds is shown in the form, and nothing is saved", async () => {
  await mount({ conflicts: [{ type: "room", message: "Room GF1 is already booked for Machine Learning (Section A)" }] });
  await click(button("+ Add class"));
  const dialog = document.querySelector('[role="dialog"]');
  const selects = dialog.querySelectorAll("select");
  await change(selects[0], "s4");
  await change(selects[1], "Friday");
  await change(dialog.querySelectorAll('input[type="time"]')[0], "08:30");
  await change(dialog.querySelectorAll('input[type="time"]')[1], "09:55");
  await change(dialog.querySelector('input[list="cs-rooms"]'), "GF1");
  await click(button("Add class"));
  await wait(30);
  expect(dialog.textContent).toContain("Room GF1 is already booked for Machine Learning (Section A)");
  expect(axios.post.mock.calls.length).toBe(1);                                            // only the check, no save
});

test("editing keeps the section and does not clash with the class itself; the server is told to ignore it", async () => {
  await mount();
  await click(container.querySelector(".cs-blk"));
  await click(button("Edit"));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.querySelector("input[disabled]").value).toBe("Data Structures · A26-F");   // the section cannot be changed
  await change(dialog.querySelector('input[list="cs-rooms"]'), "SF2");
  await wait();
  expect(dialog.querySelector(".cs-check.is-ok")).not.toBeNull();
  await click(button("Save changes"));
  await wait(30);
  expect(axios.post.mock.calls[0][1].excludeScheduleId).toBeDefined();
  expect(axios.put.mock.calls[0][0]).toMatch(/\/api\/section-schedules\/r\d+$/);
});

test("deleting asks first, naming the class", async () => {
  await mount();
  await click(container.querySelector(".cs-blk"));
  await click(button("Delete"));
  expect(document.body.textContent).toMatch(/Delete the Monday 10:10–11:35 AM class of Data Structures/);
  expect(axios.delete).not.toHaveBeenCalled();
  await click(button("Delete class"));
  await wait(30);
  expect(axios.delete.mock.calls[0][0]).toMatch(/\/api\/section-schedules\/r\d+$/);
});

test("with no internet it says so plainly and offers to try again", async () => {
  await mount({ fail: true });
  expect(container.querySelector('[role="alert"]').textContent).toContain("Couldn't reach the server. Check your internet connection and try again.");
  expect(container.querySelector(".es-btn")).not.toBeNull();
});

const prog = { _id: "p1", code: "BSCS" };
const dept = { _id: "d1", name: "Computer Science" };
const msProg = { _id: "p2", code: "MS DSAI" };
const msDept = { _id: "d2", name: "Data Science" };
const offer = (id, courseObj, semester, p = prog, d = dept) => ({ _id: id, courseId: courseObj, program: p, department: d, semester, academicYearId: "term1" });

test("classes of one semester that overlap are a warning, not a clash; the details name the semester", async () => {
  const rowsOver = baseRows();
  rowsOver.s2 = [row("s2", S[1].courseId, T[1], "Monday", "08:30", "09:55", "SF2")];          // overlaps Database Systems (SF1) in time only
  await mount({ rowsOver, offers: [offer("o1", S[0].courseId, 5), offer("o2", S[1].courseId, 5), offer("o3", S[2].courseId, 3)] });
  expect(text()).toContain("2 classes overlap for a semester");
  expect(text()).not.toMatch(/\d classes? clash/);
  await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "Section"));
  await click([...container.querySelectorAll(".cs-blk")][0]);
  expect(text()).toContain("BSCS · Semester 5 students also have");
});

test("no offerings simply means no semester warnings", async () => {
  await mount();
  expect(text()).not.toContain("overlap for a semester");
});

test("All shows every class on one week board, and can be limited by department, degree and semester", async () => {
  await mount({ landing: true, offers: [offer("o1", S[0].courseId, 5), offer("o2", S[1].courseId, 5), offer("o3", S[2].courseId, 3), offer("o4", S[3].courseId, 1, msProg, msDept)] });
  const selects = () => [...container.querySelectorAll(".cs-filterbar select")];
  expect(container.querySelector(".cs-seg button.is-on").textContent).toBe("All");
  expect(container.querySelectorAll(".cs-blk").length).toBe(4);
  expect([...selects()[0].options].map((o) => o.textContent)).toEqual(["All departments", "Computer Science", "Data Science"]);
  await change(selects()[0], "d1");
  expect([...selects()[1].options].map((o) => o.textContent)).toEqual(["All degrees", "BSCS"]);        // only that department's degrees
  expect([...selects()[2].options].map((o) => o.textContent)).toEqual(["All semesters", "Semester 3", "Semester 5"]);
  await change(selects()[2], "3");
  expect(container.querySelectorAll(".cs-blk").length).toBe(1);                                        // Database Systems Lab only
  await click(button("Clear all"));
  expect(container.querySelectorAll(".cs-blk").length).toBe(4);
  await change(selects()[1], "p2");
  expect(container.querySelectorAll(".cs-blk").length).toBe(0);                                        // MS DSAI has no classes yet
  expect(text()).toContain("0 classes this week");
});

test("evening and weekend classes can be added: every day is offered, and the weekend can be shown", async () => {
  const rowsOver = baseRows();
  rowsOver.s4 = [row("s4", S[3].courseId, T[0], "Saturday", "18:00", "21:00", "SF1")];
  await mount({ rowsOver, landing: true });
  expect([...container.querySelectorAll(".cs-wkhead > div")].slice(1).map((d) => d.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);   // a Saturday class brings its column
  await click(button("+ Add class"));
  const days = [...document.querySelectorAll("form select")[1].options].map((o) => o.textContent);
  expect(days).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  expect(container.querySelector(".cs-hours span:last-child").textContent).toBe("9p");               // the board runs into the evening
});

test("with no weekend classes the board stays Monday to Friday", async () => {
  await mount({ landing: true });
  expect([...container.querySelectorAll(".cs-wkhead > div")].slice(1).map((d) => d.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
});

test("All by room puts every room of one day side by side, and an empty slot adds a class in that room", async () => {
  await mount({ landing: true });
  await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "By room"));
  await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "Mon"));
  expect([...container.querySelectorAll(".cs-wkhead > div")].slice(1).map((d) => d.textContent)).toEqual(["SF1", "SL · free"]);
  expect(container.querySelectorAll(".cs-blk").length).toBe(3);                         // Monday: Database Systems twice, Data Structures once
  await click(container.querySelector(".cs-col"));
  expect(document.querySelector("[role=dialog], .am-modal, form")).not.toBeNull();
});

test("only the active term's courses are shown; an older term's section is left out", async () => {
  S.push({ ...section("s9", "A25-F", course("c9", "CS-900", "Old Course"), T[0]), academicTermId: "term0" });
  S.push({ ...section("s8", "A26-F", course("c8", "CS-800", "This Term Course"), T[0]), academicTermId: "term1" });
  try {
    await mount();
    const names = [...container.querySelectorAll(".cs-entity option")].map((o) => o.textContent);
    expect(names).toContain("This Term Course · A26-F");
    expect(names).not.toContain("Old Course · A25-F");
  } finally { S.splice(4, 2); }
});

test("with only overlaps the top button says overlap, not clash", async () => {
  const rowsOver = baseRows();
  rowsOver.s2 = [row("s2", S[1].courseId, T[1], "Monday", "08:30", "09:55", "SF2")];
  await mount({ rowsOver, offers: [offer("o1", S[0].courseId, 5), offer("o2", S[1].courseId, 5)] });
  expect(button("Show the overlap")).toBeTruthy();
});

test("it opens on All, the whole week, so nothing is hidden by default", async () => {
  await mount({ landing: true });
  expect(container.querySelector(".cs-seg button.is-on").textContent).toBe("All");
  expect(container.querySelectorAll(".cs-blk").length).toBe(4);
  expect(text()).toContain("4 classes this week");
});

test("the sections without a timetable can be listed, and a class added for one straight from the list", async () => {
  await mount({ landing: true });
  expect(text()).toContain("1 section has no timetable yet");
  await click(button("See which sections"));
  const panel = container.querySelector(".cs-missing");
  expect(panel.textContent).toContain("Web Engineering · B26-F");
  await click([...panel.querySelectorAll("button")].find((b) => b.textContent === "Add class"));
  expect(document.querySelector("form select").selectedOptions[0].textContent).toBe("Web Engineering · B26-F");
  await click(button("Hide sections without a timetable"));
});

test("a co-teacher sees the section's classes in their own timetable", async () => {
  S[1].teacherIds = [T[1], T[2]];                                  // Data Structures is taught by Dr. Twaha, with Ms. Zoha as co-teacher
  try {
    await mount();
    await click([...container.querySelectorAll(".cs-seg button")].find((b) => b.textContent === "Teacher"));
    await change(container.querySelector(".cs-entity"), "t3");
    const names = [...container.querySelectorAll(".cs-blk b")].map((b) => b.textContent).sort();
    expect(names).toEqual(["Data Structures", "Database Systems Lab"]);
  } finally { delete S[1].teacherIds; }
});
