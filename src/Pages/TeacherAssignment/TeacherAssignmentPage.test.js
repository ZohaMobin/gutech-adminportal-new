import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import TeacherAssignmentPage from "./TeacherAssignmentPage";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const term = { _id: "t1", semesterType: "Fall", year: 2026, displayName: "Fall 2026" };
// One course, GE-202, offered to two program semesters this term - this is what the bug report showed:
// it must appear as ONE course in the list, not two, and its sections (shared by course, not by offering)
// must load the same way from either semester's filter.
const course = { _id: "c-GE202", code: "GE-202", name: "Fehm-e-Quran", creditHours: 3 };
const offerings = [
  { _id: "o1", department: "d1", program: "p1", semester: 3, courseId: course },
  { _id: "o2", department: "d1", program: "p1", semester: 5, courseId: course },
];

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(); };

const mount = async () => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/academic-years/current")) return Promise.resolve({ data: term });
    if (url.includes("/course-offerings")) return Promise.resolve({ data: offerings });
    if (url.includes("/api/teachers")) return Promise.resolve({ data: [] });
    if (url.includes("/sections/assignment-overview")) return Promise.resolve({ data: { items: [] } });
    if (url.includes("/sections/course/")) return Promise.resolve({ data: [{ _id: "s1", section: "A", teachers: [] }] });
    return Promise.resolve({ data: [] });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<TeacherAssignmentPage />); });
  await wait();
};

afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllMocks(); });

test("a course offered to two semesters this term is listed once, not twice", async () => {
  await mount();
  const cards = container.querySelectorAll(".ta-course");
  expect(cards.length).toBe(1);
  expect(cards[0].querySelector(".ta-course-code").textContent).toBe("GE-202");
});

test("its combined meta shows both semesters under the one program", async () => {
  await mount();
  const meta = container.querySelector(".ta-course-meta").textContent;
  expect(meta).toContain("Sem 3");
  expect(meta).toContain("5");
});

test("choosing the course loads sections by its shared courseId, regardless of which offering matched", async () => {
  await mount();
  await click(container.querySelector(".ta-course"));
  const sectionCalls = axios.get.mock.calls.filter(([url]) => url.includes("/sections/course/"));
  expect(sectionCalls.length).toBeGreaterThan(0);
  expect(sectionCalls[0][0]).toContain("/sections/course/c-GE202");
});

test("filtering to Semester 5 still finds the course (it must not disappear because Semester 3 also matches it)", async () => {
  await mount();
  const semesterSelect = [...container.querySelectorAll("label")].find((l) => l.textContent.startsWith("Semester")).querySelector("select");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(semesterSelect, "5");
    semesterSelect.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait();
  expect(container.querySelectorAll(".ta-course").length).toBe(1);
});
