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
  expect(steps[0]).toMatch(/^1Create the course.*Skip this if it already exists.*1 course$/);
  expect(steps[1]).toMatch(/^2Offer it for a term.*academic term it will be taught in.*offered in Fall 2026$/);
  expect(steps[2]).toMatch(/^3Assign a teacher/);
  expect(container.querySelector('[aria-current="step"]').textContent).toContain("Create the course");
  expect(container.textContent).toMatch(/Check existing courses/);
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
});

test("the offering form explains semester and academic term, and after saving it leads on to assigning a teacher", async () => {
  await click(stepBtn("2Offer it for a term"));
  expect(container.textContent).toMatch(/Which semester of the program the course sits in/);
  expect(container.textContent).toMatch(/When it will be taught/);
  axios.post.mockResolvedValue({ data: { _id: "o1" } });
  const form = container.querySelector(".offering-form");
  await choose(form.querySelector('[name="courseId"]'), "c1");
  await choose(form.querySelector('[name="department"]'), "d1");
  await choose(form.querySelector('[name="program"]'), "p1");
  await choose(form.querySelector('[name="academicYearId"]'), "y1");
  await act(async () => { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  await wait(20);
  expect(container.querySelector(".cintro.is-done").textContent).toMatch(/CS101 Programming is now offered in Fall 2026. Next, give each of its sections a teacher/);
  await click(button("Assign a teacher"));
  expect(container.querySelector('[data-testid="assignments"]')).not.toBeNull();
});

test("step 3 explains where the courses come from and points back to step 2", async () => {
  await click(stepBtn("3Assign a teacher"));
  expect(container.querySelector(".cintro").textContent).toMatch(/offered for the current term/);
  await click(button("Go to step 2"));
  expect(stepBtn("2Offer it for a term").getAttribute("aria-current")).toBe("step");
});
