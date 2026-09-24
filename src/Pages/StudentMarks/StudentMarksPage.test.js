import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import StudentMarksPage from "./StudentMarksPage";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const term = { _id: "t1", semesterType: "Fall", year: 2026, displayName: "Fall 2026", status: "active" };
let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const mount = async ({ pending = false } = {}) => {
  axios.get.mockImplementation((url) => {
    if (pending) return new Promise(() => {});
    return Promise.resolve({ data: url.includes("academic-years") ? [term] : [] });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<StudentMarksPage />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllMocks(); });

test("uses the shared header and page shell, with no hero card", async () => {
  await mount();
  expect(container.firstElementChild.classList.contains("page-shell")).toBe(true);
  expect(container.querySelector(".page-head-title").textContent).toBe("Student Marks");
  expect(container.querySelector(".term-selector-card")).toBeNull();
});

test("keeps its title on screen while the terms load", async () => {
  await mount({ pending: true });
  expect(container.querySelector(".page-head-title").textContent).toBe("Student Marks");
});

test("term and the five section filters share one filter row, with the current term chosen", async () => {
  await mount();
  const selects = [...container.querySelectorAll(".marks-filters select")];
  expect(selects.map((s) => s.id)).toEqual(["marks-academic-term", "department", "program", "semester", "course", "section"]);
  expect(selects[0].value).toBe("t1");
  expect(selects[0].selectedOptions[0].textContent).toBe("Fall 2026 (Active)");
  expect(container.querySelector(".clear-filters-btn").textContent).toBe("Clear");
});

test("before a section is chosen it says what to pick", async () => {
  await mount();
  expect(container.querySelector(".no-data-container").textContent).toMatch(/Pick a section to see its gradebook/);
});

const dept = { _id: "d1", name: "Computer Science" };
const prog = { _id: "p1", name: "BSCS" };
const setSelect = (id, value) => act(async () => {
  const el = container.querySelector(`#${id}`);
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
});
const openSection = async (marksResponse) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("academic-years")) return Promise.resolve({ data: [term] });
    if (url.endsWith("/api/departments")) return Promise.resolve({ data: [dept] });
    if (url.endsWith("/api/programs")) return Promise.resolve({ data: [prog] });
    if (url.includes("course-offerings")) return Promise.resolve({ data: [{ _id: "o1", department: dept, program: prog, semester: 0, courseId: { _id: "c1", code: "CS107", name: "Business Process" } }] });
    if (url.includes("course-enrollment")) return Promise.resolve({ data: { sections: [{ id: "69df1c993e8bd527470f4f14", section: "A26-S", teachers: [] }] } });
    if (url.includes("student-marks")) return marksResponse();
    return Promise.resolve({ data: [] });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<StudentMarksPage />); });
  await wait(20);
  await setSelect("department", "d1"); await wait(5);
  await setSelect("program", "p1"); await wait(5);
  await setSelect("semester", "0"); await wait(20);
  await setSelect("course", "c1"); await wait(20);
  await setSelect("section", "69df1c993e8bd527470f4f14"); await wait(20);
};
const notFound = (error, message) => () => Promise.reject({ response: { status: 404, data: { error, message } } });

test("a section with no students is an empty state: no error banner, no raw section id", async () => {
  await openSection(notFound("NO_STUDENTS_IN_SECTION", "No students found in section 69df1c993e8bd527470f4f14"));
  expect(container.querySelector(".error-message")).toBeNull();
  expect(container.querySelector(".no-data-container").textContent).toMatch(/No students are enrolled in this section yet/);
  expect(container.textContent).not.toMatch(/69df1c993e8bd527470f4f14No students|found in section/);
  expect(container.querySelector(".workspace-search")).toBeNull();
});

test("a section with nothing published says so", async () => {
  await openSection(notFound("NO_ASSESSMENTS_IN_SECTION", "No published assessments found for section x"));
  expect(container.querySelector(".error-message")).toBeNull();
  expect(container.querySelector(".no-data-container").textContent).toMatch(/No assessments have been published for this section/);
});

test("a real failure shows its reason once, in the banner, with a neutral note in the table area", async () => {
  await openSection(() => Promise.reject({ response: { status: 500, data: { message: "Database unavailable" } } }));
  const banners = container.querySelectorAll(".error-message");
  expect(banners.length).toBe(1);
  expect(banners[0].textContent).toMatch(/Database unavailable/);
  expect(container.querySelector(".no-data-container").textContent).toMatch(/could not be loaded/);
  expect(container.querySelectorAll(".error-container").length).toBe(0);
});
