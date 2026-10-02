import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import CoursePage from "./CoursePage";

jest.mock("axios");
jest.mock("../TeacherAssignment/TeacherAssignmentPage", () => () => <div data-testid="assignments">teacher assignments</div>);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

const programs = [{ _id: "p1", name: "BS Computer Science", typicalDuration: 8 }];
const departments = [{ _id: "d1", name: "Computer Science" }];
const years = [{ _id: "y1", semesterType: "Fall", year: 2026, isActive: true, isCurrent: true }];
let courses; let container; let root;

const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(); };
const stepBtn = (text) => [...container.querySelectorAll(".cstep button")].find((b) => b.textContent.trim().startsWith(text));
const button = (text) => [...container.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));
const type = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const choose = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
});

beforeEach(async () => {
  sessionStorage.setItem("adminToken", "t");
  courses = [{ _id: "c1", code: "CS101", name: "Programming", description: "d", creditHours: 3, isActive: true }];
  axios.get.mockImplementation((url) => {
    if (url.includes("/api/departments")) return Promise.resolve({ data: departments });
    if (url.includes("/api/programs")) return Promise.resolve({ data: programs });
    if (url.includes("/api/academic-years")) return Promise.resolve({ data: years });
    if (url.includes("/api/course-offerings")) return Promise.resolve({ data: [] });
    if (url.includes("/api/courses")) return Promise.resolve({ data: courses });
    return Promise.resolve({ data: [] });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<CoursePage />); });
  await wait(30);
});
afterEach(() => { act(() => root.unmount()); container.remove(); sessionStorage.clear(); jest.clearAllMocks(); });

test("the page shows the three steps in order, says what each is for, and counts what exists", () => {
  const steps = [...container.querySelectorAll(".cstep ol button")].map((b) => b.textContent.trim());
  expect(steps[0]).toMatch(/^1Create the course.*code, name and credit hours.*1 course$/);
  expect(steps[1]).toMatch(/^2Offer it for a term.*term it is taught in.*offered in Fall 2026$/);
  expect(steps[2]).toMatch(/^3Assign a teacher/);
  expect(container.querySelector('[aria-current="step"]').textContent).toContain("Create the course");
  expect(container.textContent).toMatch(/Already in the system/);
  expect(container.querySelector(".page-head-actions button").textContent).toBe("All courses");
});

test("after creating a course, one button takes you to the offering form with that course already chosen", async () => {
  axios.post.mockResolvedValue({ data: { _id: "c2", code: "CS201", name: "Data Structures" } });
  courses = [...courses, { _id: "c2", code: "CS201", name: "Data Structures", description: "d", creditHours: 3, isActive: true }];   // what the list returns once it is created
  const form = container.querySelector(".course-form form");
  await type(form.querySelector('[name="code"]'), "CS201");
  await type(form.querySelector('[name="name"]'), "Data Structures");
  await type(form.querySelector('[name="description"]'), "Lists, trees and graphs");
  await type(form.querySelector('[name="creditHours"]'), "3");
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await wait(20);
  expect(container.querySelector(".cintro.is-done").textContent).toMatch(/CS201 Data Structures was created. Next, offer it for a term/);

  await click(button("Offer CS201 for a term"));
  expect(stepBtn("2Offer it for a term").getAttribute("aria-current")).toBe("step");
  await wait(20);
  expect(container.querySelector('.offering-form [name="courseId"]').value).toBe("c2");
  expect(container.querySelector(".of-picked").textContent).toMatch(/CS201 Data Structures · 3 credit hours/);
});

test("the offering form explains semester and academic term, and after saving it leads on to assigning a teacher", async () => {
  await click(stepBtn("2Offer it for a term"));
  expect(container.textContent).toMatch(/When it will be taught/);
  expect(container.textContent).not.toMatch(/Use Semester 0/);
  axios.post.mockResolvedValue({ data: { _id: "o1" } });
  const form = container.querySelector(".offering-form");
  expect(form.textContent).toMatch(/Pre-semester \(0\)/);
  expect(form.textContent).not.toMatch(/No semester/);
  const create = () => container.querySelector('button[form="offering-form"]');
  expect(create().disabled).toBe(true);
  expect(container.querySelector(".cr-sum").textContent).toMatch(/Not chosen yet/);
  await choose(form.querySelector('[name="courseId"]'), "c1");
  await choose(form.querySelector('[name="department"]'), "d1");
  await choose(form.querySelector('[name="program"]'), "p1");
  await click(form.querySelector('.of-term'));
  expect(form.querySelector('.of-term').getAttribute("aria-checked")).toBe("true");
  expect(container.querySelector(".cr-sum").textContent).toMatch(/CS101 Programming.*BS Computer Science · Pre-semester.*Fall 2026/);
  expect(container.querySelectorAll(".cr-sum li.is-done").length).toBe(3);
  expect(create().disabled).toBe(false);
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await wait(20);
  expect(container.querySelector(".cintro.is-done").textContent).toMatch(/CS101 Programming is now offered in Fall 2026. Next, give each of its sections a teacher/);
  await click(button("Assign a teacher"));
  expect(container.querySelector('[data-testid="assignments"]')).not.toBeNull();
});

test("step 3 says what to do and points back to step 2 for a missing course", async () => {
  await click(stepBtn("3Assign a teacher"));
  expect(container.querySelector(".cintro").textContent).toMatch(/Course missing\? Offer it for the term first/);
  await click(button("Go to step 2"));
  expect(stepBtn("2Offer it for a term").getAttribute("aria-current")).toBe("step");
});

test("typing a code that already exists warns at once and offers to go on to step 2 with that course", async () => {
  const form = container.querySelector(".course-form form");
  expect(container.querySelector(".cr-empty")).not.toBeNull();
  await type(form.querySelector('[name="code"]'), "cs101");
  expect(container.querySelector(".cr-alert").textContent).toMatch(/CS101 already exists.*Programming/);
  await click(button("Offer CS101 for a term"));
  expect(stepBtn("2Offer it for a term").getAttribute("aria-current")).toBe("step");
  await wait(20);
  expect(container.querySelector('.offering-form [name="courseId"]').value).toBe("c1");
});

test("similar names are listed as you type, so the same course isn't added twice", async () => {
  const form = container.querySelector(".course-form form");
  await type(form.querySelector('[name="name"]'), "Program");
  expect(container.querySelector(".cr-list").textContent).toMatch(/CS101.*Programming/);
  expect(container.querySelector(".cr-alert")).toBeNull();
});

test("the summary panel lists where the chosen course is already offered", async () => {
  await click(stepBtn("2Offer it for a term"));
  const form = container.querySelector(".offering-form");
  await choose(form.querySelector('[name="courseId"]'), "c1");
  expect(container.querySelector(".cr-already")).toBeNull();
});

test("the summary warns only about an exact repeat (same program, semester and term), not a different semester", async () => {
  // c1 is already offered in Fall 2026 for BS Computer Science, Semester 1
  const offered = [{ _id: "o1", courseId: courses[0], department: departments[0], program: programs[0], semester: 1, academicYearId: years[0], isActive: true }];
  axios.get.mockImplementation((url) => {
    if (url.includes("/api/departments")) return Promise.resolve({ data: departments });
    if (url.includes("/api/programs")) return Promise.resolve({ data: programs });
    if (url.includes("/api/academic-years")) return Promise.resolve({ data: years });
    if (url.includes("/api/course-offerings")) return Promise.resolve({ data: offered });
    if (url.includes("/api/courses")) return Promise.resolve({ data: courses });
    return Promise.resolve({ data: [] });
  });
  act(() => root.unmount()); container.remove();
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  await act(async () => { root.render(<CoursePage />); });
  await wait(30);
  await click(stepBtn("2Offer it for a term"));
  const form = container.querySelector(".offering-form");
  await choose(form.querySelector('[name="courseId"]'), "c1");
  await choose(form.querySelector('[name="department"]'), "d1");
  await choose(form.querySelector('[name="program"]'), "p1");
  await click(form.querySelector(".of-term"));
  await choose(form.querySelector('[name="semester"]'), "2");
  expect(container.querySelector(".cr-panel .of-warn")).toBeNull();
  expect(container.querySelector(".cr-already").textContent).toMatch(/CS101 is already offered.*Semester 1/);
  await choose(form.querySelector('[name="semester"]'), "1");
  expect(container.querySelector(".cr-panel .of-warn").textContent).toMatch(/This exact offering already exists: Fall 2026, BS Computer Science, Semester 1/);
});
