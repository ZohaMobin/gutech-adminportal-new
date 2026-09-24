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

const ada = { _id: "t1", userId: { name: "Dr. Ada" }, employeeId: "E1" };
const mount = async ({ sections = [{ _id: "s1", section: "A", teachers: [] }] } = {}) => {
  axios.get.mockImplementation((url) => {
    if (url.includes("/academic-years/current")) return Promise.resolve({ data: term });
    if (url.includes("/course-offerings")) return Promise.resolve({ data: offerings });
    if (url.includes("/api/teachers")) return Promise.resolve({ data: [ada] });
    if (url.includes("/sections/assignment-overview")) return Promise.resolve({ data: { items: [] } });
    if (url.includes("/sections/course/")) return Promise.resolve({ data: sections });
    return Promise.resolve({ data: [] });
  });
  axios.put.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
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

// --- editing a section: rename, and delete ---
const assignedA = [{ _id: "s1", section: "A", teachers: [{ id: "t1" }] }];
const button = (text) => [...container.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));
const typeInto = async (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const openEditor = async (sections = assignedA) => {
  await mount({ sections });
  await click(container.querySelector(".ta-course"));
  await click(button("Edit"));
};

test("editing a section shows its name, and saving a new name sends it", async () => {
  await openEditor();
  const input = container.querySelector('.ta-field input[type="text"]');
  expect(input.value).toBe("A");
  await typeInto(input, "  B  ");
  await click(button("Save"));
  expect(axios.put).toHaveBeenCalledTimes(1);
  const [url, body] = axios.put.mock.calls[0];
  expect(url).toContain("/api/sections/s1");
  expect(body).toMatchObject({ section: "B", teacherIds: ["t1"] });
});

test("Save stays off until something changed, and off again for a blank name", async () => {
  await openEditor();
  expect(button("Save").disabled).toBe(true);
  const input = container.querySelector('.ta-field input[type="text"]');
  await typeInto(input, "B");
  expect(button("Save").disabled).toBe(false);
  await typeInto(input, "   ");
  expect(button("Save").disabled).toBe(true);
});

test("deleting a section asks first, and 'Keep it' backs out without deleting", async () => {
  await openEditor();
  await click(button("Delete section"));
  expect(container.querySelector(".ta-confirm").textContent).toContain("Delete Section A?");
  await click(button("Keep it"));
  expect(container.querySelector(".ta-confirm")).toBeNull();
  expect(axios.delete).not.toHaveBeenCalled();
});

test("confirming the delete removes that section", async () => {
  await openEditor();
  await click(button("Delete section"));
  await click(container.querySelector(".ta-confirm .ta-danger-solid"));
  expect(axios.delete).toHaveBeenCalledTimes(1);
  expect(axios.delete.mock.calls[0][0]).toContain("/api/sections/s1");
  expect(container.querySelector(".ta-banner.ok").textContent).toContain("Section A deleted.");
});

test("when the server refuses (students are enrolled) its reason is shown and the section stays", async () => {
  await openEditor();
  axios.delete.mockRejectedValue({ response: { data: { message: "Cannot delete section with enrolled students. Please reassign students first." } } });
  await click(button("Delete section"));
  await click(container.querySelector(".ta-confirm .ta-danger-solid"));
  expect(container.querySelector(".ta-banner.bad").textContent).toContain("Cannot delete section with enrolled students");
  expect(container.querySelector(".ta-section")).not.toBeNull();
});
