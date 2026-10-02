import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import CoursePage from "./CoursePage";

jest.mock("axios");
jest.mock("../TeacherAssignment/TeacherAssignmentPage", () => () => <div />);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

const dept = { _id: "d1", name: "Computer Science" };
const prog = { _id: "p1", name: "BS Computer Science", typicalDuration: 8 };
const term = { _id: "y1", semesterType: "Fall", year: 2026, isActive: true, isCurrent: true, displayName: "Fall 2026" };
const course = (id, code, name, creditHours = 3) => ({ _id: id, code, name, creditHours, description: "d", isActive: true });
const offering = (id, c, semester, isActive = true) => ({ _id: id, courseId: c, department: dept, program: prog, semester, academicYearId: term, isActive });
let container; let root;

const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(); };
const chip = (text) => [...container.querySelectorAll(".ol-chip")].find((b) => b.textContent === text);

beforeEach(async () => {
  sessionStorage.setItem("adminToken", "t");
  const cs101 = course("c1", "CS101", "Programming", 3);
  const cl101 = course("c2", "CL101", "Programming Lab", 1);
  const ge201 = course("c3", "GE201", "Applied Physics", 2);
  const offerings = [offering("o1", cs101, 1), offering("o2", cl101, 1), offering("o3", ge201, 0, false)];
  axios.get.mockImplementation((url) => {
    if (url.includes("/api/departments")) return Promise.resolve({ data: [dept] });
    if (url.includes("/api/programs")) return Promise.resolve({ data: [prog] });
    if (url.includes("/api/academic-years")) return Promise.resolve({ data: [term] });
    if (url.includes("/api/course-offerings")) return Promise.resolve({ data: offerings });
    if (url.includes("/api/courses")) return Promise.resolve({ data: [cs101, cl101, ge201] });
    return Promise.resolve({ data: [] });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<CoursePage />); });
  await wait(30);
  await click([...container.querySelectorAll(".cstep ol button")][1]);
});
afterEach(() => { act(() => root.unmount()); container.remove(); sessionStorage.clear(); jest.clearAllMocks(); });

test("the term reads as a plan: a column per semester, Pre-semester first, with the semester's credit total", () => {
  const heads = [...container.querySelectorAll(".sp-col-head")].map((h) => h.textContent);
  expect(heads).toEqual(["Pre-semester0 credits", "Semester 14 credits"]);
  expect(container.querySelector(".ol-count").textContent).toBe("3");
  expect(container.querySelector(".sp-head").textContent).toMatch(/BS Computer Science.*Computer Science.*3 courses · 4 credits/);
});

test("each course is one line: code, name and credit hours, with no status column", () => {
  const lines = [...container.querySelectorAll(".sp-course")].map((b) => b.textContent);
  expect(lines).toEqual(["GE201Applied Physics2", "CL101Programming Lab1", "CS101Programming3"]);
  expect(container.textContent).not.toMatch(/Active|Status/);
});

test("an inactive offering stays visible but muted, and its credits are not counted", () => {
  const off = container.querySelector(".sp-course.is-off");
  expect(off.textContent).toMatch(/GE201/);
  expect(off.getAttribute("aria-label")).toMatch(/inactive/);
  expect(container.querySelector(".sp-col-head").textContent).toBe("Pre-semester0 credits");
});

test("choosing a course opens it for editing", async () => {
  await click(container.querySelector(".sp-course"));
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});

test("search narrows the plan and says how many of the total are shown", async () => {
  const box = container.querySelector(".ol-search");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(box, "lab");
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(container.querySelectorAll(".sp-course").length).toBe(1);
  expect(container.querySelectorAll(".sp-col").length).toBe(1);
  expect(container.querySelector(".ol-count").textContent).toBe("1 of 3");
});

test("with a single program there is no program filter to clutter the bar", () => {
  expect(container.querySelector('.ol-filters select[aria-label="Program"]')).toBeNull();
  expect(container.querySelector(".ol-chip")).toBeNull();
});

test("the risky 'deactivate the whole term' action lives in the ⋯ menu, not on the page", async () => {
  expect(container.textContent).not.toMatch(/Deactivate every offering/);
  await click(container.querySelector(".ol-more-btn"));
  expect(container.querySelector(".ol-more-list").textContent).toMatch(/Deactivate every offering in this term/);
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  expect(container.querySelector(".ol-more-list")).toBeNull();
});
