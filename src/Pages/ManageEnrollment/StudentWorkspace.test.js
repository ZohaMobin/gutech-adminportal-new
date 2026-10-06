import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import StudentWorkspace from "./StudentWorkspace";
import * as api from "./enrollmentApi";

jest.mock("./enrollmentApi", () => ({
  ...jest.requireActual("./enrollmentApi"),
  getEnrollment: jest.fn(),
  getCourseOptions: jest.fn(),
  previewChanges: jest.fn(),
  saveChanges: jest.fn(),
}));
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error", WARNING: "warning" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const section = (id, name, capacity = 40, taken = 10) => ({ id, name, teachers: ["Dr. T"], capacity, taken });
const enrollment = (over = {}) => ({
  student: { id: "s1", rollNumber: "2622-6DSAI-023", name: "Muhammad Akif", program: { code: "BSDSAI", name: "BS Data Science and AI" }, currentSemester: 2 },
  term: { id: "t", label: "Fall 2026" },
  courses: [
    { registrationId: "r1", status: "registered", course: { id: "ml", code: "AI301", name: "Machine Learning", creditHours: 3 }, section: { id: "mlA", name: "A", teachers: ["Dr. T"] }, sections: [section("mlA", "A"), section("mlB", "B", 40, 40)], attendanceRecords: 4, marks: 1, locked: false },
    { registrationId: "r2", status: "registered", course: { id: "la", code: "MTH202", name: "Linear Algebra", creditHours: 3 }, section: { id: "laA", name: "A", teachers: [] }, sections: [section("laA", "A")], attendanceRecords: 0, marks: 0, locked: true },
  ],
  dropped: [],
  credits: 6,
  addDrop: null,
  history: [],
  ...over,
});
const okPreview = (changes) => ({ items: changes.map((c, index) => ({ index, type: c.type, label: `${c.type} change`, ok: true, blocking: [], warnings: [] })), creditsBefore: 6, creditsAfter: 6, canSave: true });

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const button = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const rowOf = (name) => [...container.querySelectorAll(".me-row")].find((r) => r.textContent.includes(name));
const type = async (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const mount = async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<StudentWorkspace studentId="s1" onClose={jest.fn()} />); });
  await wait(10);
};
beforeEach(() => {
  api.getEnrollment.mockResolvedValue(enrollment());
  api.previewChanges.mockImplementation(async (_id, changes) => okPreview(changes));
  api.getCourseOptions.mockResolvedValue({ term: { label: "Fall 2026" }, options: [
    { courseOfferingId: "o-paids", ownProgram: true, course: { id: "paids", code: "AI201", name: "Programming for AI and DS", creditHours: 3 }, sections: [section("paA", "A", 30, 30), section("paB", "B", 30, 22)] },
  ] });
});
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); });

test("it shows the student, the semester, courses with sections and credits, and locked results", async () => {
  await mount();
  expect(container.textContent).toMatch(/Muhammad Akif/);
  expect(container.textContent).toMatch(/2622-6DSAI-023 · BS Data Science and AI · Semester 2/);
  expect(container.querySelector(".me-student-stats").textContent).toMatch(/Fall 2026.*2.*6/);
  expect(rowOf("Linear Algebra").textContent).toMatch(/Result locked/);
  expect(rowOf("Linear Algebra").querySelector("button")).toBeNull();
});

test("the email's request: drop one course and add another, reviewed and saved together with a reason", async () => {
  api.saveChanges.mockResolvedValue({ message: "Saved 2 changes for Muhammad Akif", enrollment: enrollment() });
  await mount();
  await click(rowOf("Machine Learning").querySelector(".me-remove"));
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/Why is Muhammad Akif leaving AI301 · Machine Learning/);
  await click(button("Mark for removal"));
  expect(rowOf("Machine Learning").textContent).toMatch(/Will be dropped/);

  await click(button("Add course"));
  await wait(10);
  await click([...document.querySelectorAll(".me-pick-row")].find((b) => b.textContent.includes("Programming for AI and DS")));
  const sections = [...document.querySelectorAll('input[name="me-add-section"]')];
  expect(sections[0].disabled).toBe(true);                       // section A is full
  await click(sections[1]);
  await click(button("Add to changes"));
  expect(rowOf("Programming for AI and DS").textContent).toMatch(/Will be added/);

  await wait(400);                                               // the live check runs after a short pause
  expect(container.querySelector(".me-savebar").textContent).toMatch(/2 unsaved changes.*all checks passed/);
  await click(button("Review and save"));
  const save = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes("Save 2 changes"));
  expect(save.disabled).toBe(true);                              // a reason is required
  await type(document.querySelector('[role="dialog"] textarea'), "Academic Dept email, 6 Oct");
  await click(save);
  await wait(10);
  expect(api.saveChanges).toHaveBeenCalledWith("s1", [
    { type: "remove", registrationId: "r1", kind: "dropped" },
    { type: "add", courseOfferingId: "o-paids", sectionId: "paB" },
  ], "Academic Dept email, 6 Oct");
  expect(container.querySelector(".me-savebar")).toBeNull();
});

test("enrolled by mistake is a choice when removing", async () => {
  await mount();
  await click(rowOf("Machine Learning").querySelector(".me-remove"));
  await click(document.querySelectorAll('[role="dialog"] input[type="radio"]')[1]);
  await click(button("Mark for removal"));
  expect(rowOf("Machine Learning").textContent).toMatch(/Remove · enrolled by mistake/);
  await click(button("Undo"));
  expect(rowOf("Machine Learning").textContent).not.toMatch(/enrolled by mistake/);
  expect(container.querySelector(".me-savebar")).toBeNull();
});

test("problems found by the check show on the row and saving is blocked until they're fixed", async () => {
  api.previewChanges.mockResolvedValue({ items: [{ index: 0, type: "remove", label: "Drop", ok: false, blocking: ["Its result is locked or final."], warnings: [] }], creditsBefore: 6, creditsAfter: 3, canSave: false });
  await mount();
  await click(rowOf("Machine Learning").querySelector(".me-remove"));
  await click(button("Mark for removal"));
  await wait(400);
  expect(rowOf("Machine Learning").textContent).toMatch(/Its result is locked or final/);
  await click(button("Review and save"));
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/Fix or undo the changes marked in red/);
  expect(document.querySelector('[role="dialog"] textarea')).toBeNull();
});
