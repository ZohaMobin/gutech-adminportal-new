import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import PrerequisitesPage from "./PrerequisitesPage";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const bands = [{ grade: "A", gradePoints: 4 }, { grade: "B", gradePoints: 3 }, { grade: "C", gradePoints: 2 }, { grade: "D", gradePoints: 1 }, { grade: "F", gradePoints: 0 }, { grade: "W", gradePoints: null, isSpecialGrade: true }];
const course = (code, semester, over = {}) => ({ id: `id-${code}`, code, name: `${code} name`, semester, prerequisitesDeclared: false, rules: [], unlocks: [], ...over });
const version = (over = {}) => ({
  id: "v1", versionCode: "v1", status: "draft", completion: { declared: 1, total: 3, percent: 33 },
  courses: [
    course("CS101", 1, { prerequisitesDeclared: true, unlocks: [{ code: "CS201" }] }),
    course("CS201", 2, { prerequisitesDeclared: true, rules: [{ id: "r1", type: "PREREQ", requires: { code: "CS101" }, minGradePoints: 1, minCreditsEarned: null, groupKey: "default" }] }),
    course("CS301", 3),
  ], ...over,
});

let container; let root;
const type = async (element, value) => act(async () => {
  const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(element, value);
  element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const click = async (element) => act(async () => { element.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const button = (label, scope = container) => [...scope.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
const setup = async (v = version()) => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/curriculum-versions") ? [{ id: "v1", versionCode: "v1", status: v.status, completion: v.completion }] : url.endsWith("/grading-scale") ? { bands } : v }));
  await act(async () => { root.render(<PrerequisitesPage />); });
};

beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); axios.get.mockReset(); axios.post.mockReset(); axios.post.mockResolvedValue({ data: {} }); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("it shows how complete the version is, and each course's rule in words with the grade as a letter", async () => {
  await setup();
  expect(container.textContent).toContain("1 of 3 courses have their prerequisites entered (33%)");
  expect(container.textContent).toContain("Must have passed CS101 at grade D or better");
  expect(container.textContent).toContain("Not entered yet");
});

test("a version cannot be published while any course is still missing its prerequisites", async () => {
  await setup();
  expect(button("Publish version").disabled).toBe(true);
});

test("once every course is entered the version can be published", async () => {
  await setup(version({ completion: { declared: 3, total: 3, percent: 100 } }));
  expect(button("Publish version").disabled).toBe(false);
  await click(button("Publish version"));
  expect(axios.post.mock.calls[0][0]).toContain("/curriculum-versions/v1/publish");
});

test("adding a rule sends the minimum as a LETTER for the server to turn into points, and needs a course chosen", async () => {
  await setup();
  const row = [...container.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("CS301"));
  await click(button("Add rule", row));
  expect(button("Save rule").disabled).toBe(true);
  const selects = container.querySelectorAll(".pre-form select");
  await type(selects[1], "id-CS201");
  await type(selects[2], "C");
  expect(button("Save rule").disabled).toBe(false);
  await click(button("Save rule"));
  const [url, body] = axios.post.mock.calls[0];
  expect(url).toContain("/curriculum-versions/v1/courses/id-CS301/rules");
  expect(body).toEqual({ type: "PREREQ", groupKey: "default", requiredCourseId: "id-CS201", minGrade: "C" });
});

test("a course cannot be its own prerequisite: it is not offered in the list", async () => {
  await setup();
  const row = [...container.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("CS301"));
  await click(button("Add rule", row));
  const options = [...container.querySelectorAll(".pre-form select")[1].options].map((o) => o.textContent);
  expect(options.some((o) => o.startsWith("CS301"))).toBe(false);
  expect(options.some((o) => o.startsWith("CS201"))).toBe(true);
});

test("closing a rule needs a reason and sends it", async () => {
  await setup();
  await click(button("Close"));
  expect(button("Close rule").disabled).toBe(true);
  await type(container.querySelector(".pre-form textarea"), "Replaced by a stricter rule");
  await click(button("Close rule"));
  expect(axios.post.mock.calls[0][0]).toContain("/rules/r1/close");
  expect(axios.post.mock.calls[0][1]).toEqual({ reason: "Replaced by a stricter rule" });
});

test("a course with nothing entered can be declared to have no prerequisites, out loud", async () => {
  await setup();
  await click(button("No prerequisites"));
  expect(axios.post.mock.calls[0][0]).toContain("/courses/id-CS301/declare-none");
});

test("the server's refusal is shown in words, for example a loop", async () => {
  axios.post.mockRejectedValue({ response: { data: { message: "That would make the courses require each other in a loop" } } });
  await setup();
  await click(button("No prerequisites"));
  expect(container.querySelector('[role="alert"]').textContent).toContain("in a loop");
});

test("with no curriculum versions it says what to do instead of showing an empty page", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/grading-scale") ? { bands } : [] }));
  await act(async () => { root.render(<PrerequisitesPage />); });
  expect(container.textContent).toContain("No curriculum versions exist yet");
});
