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
  id: "v1", versionCode: "v1", status: "draft", program: { name: "BSCS", code: "BSCS" }, completion: { declared: 1, total: 3, percent: 33 },
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
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/curriculum-versions") ? [{ id: "v1", versionCode: "v1", status: v.status, program: v.program, completion: v.completion }] : url.endsWith("/grading-scale") ? { bands } : v }));
  await act(async () => { root.render(<PrerequisitesPage />); });
};

beforeEach(() => { try { window.localStorage.clear(); } catch { /* none */ } container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); axios.get.mockReset(); axios.post.mockReset(); axios.post.mockResolvedValue({ data: {} }); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const card = (code) => [...container.querySelectorAll(".pre-course-card")].find((r) => r.textContent.includes(code));

test("it says how many courses are answered, and each rule in words with the grade as a letter", async () => {
  await setup();
  expect(container.textContent).toContain("2 of 3 courses answered (67%)");
  expect(container.textContent).toContain("Must have passed CS101 at grade D or better");
  expect(container.textContent).toContain("Not answered yet");
  expect(container.textContent).toContain("No prerequisite. Anyone can take this course.");
});

test("the numbers come from the courses shown, so they cannot disagree with the list", async () => {
  await setup(version({ completion: { declared: 0, total: 1, percent: 0 } }));       // a stale server figure
  expect(container.textContent).toContain("2 of 3 courses answered");
  const filters = [...container.querySelectorAll(".pre-filter")].map((b) => b.textContent);
  expect(filters).toEqual(["All 3", "To do 1", "Done 2"]);
});

test("two programs with the same version code can be told apart by the program name", async () => {
  await setup();
  expect(container.querySelector(".pre-picker option").textContent).toBe("BSCS · v1 (draft)");
  expect(container.querySelector(".pre-program").textContent).toBe("BSCS");
});

test("courses are grouped under their semester", async () => {
  await setup();
  const heads = [...container.querySelectorAll(".pre-semester-head")].map((h) => h.textContent);
  expect(heads).toEqual(["Semester 11 course · all done", "Semester 21 course · all done", "Semester 31 course · 1 to do"]);
});

test("a version cannot be published while any course is still unanswered, and it says how many are left", async () => {
  await setup();
  expect(button("Publish version").disabled).toBe(true);
  expect(container.textContent).toContain("1 course still needs an answer before you can publish.");
});

test("once every course is answered the version can be published", async () => {
  await setup(version({ courses: version().courses.map((c) => ({ ...c, prerequisitesDeclared: true })) }));
  expect(container.textContent).toContain("You can publish this version.");
  expect(button("Publish version").disabled).toBe(false);
  await click(button("Publish version"));
  expect(axios.post.mock.calls[0][0]).toContain("/curriculum-versions/v1/publish");
});

const pick = async (code) => { const row = [...container.querySelectorAll(".pre-pick-row")].find((r) => r.textContent.startsWith(code)); await click(row.querySelector("input")); };
const posts = () => axios.post.mock.calls.map(([url, body]) => ({ url, body }));

test("adding a prerequisite sends the minimum as a LETTER for the server to turn into points, and needs a course chosen", async () => {
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  expect(button("Save rule").disabled).toBe(true);
  await type(container.querySelectorAll(".pre-form select")[1], "C");
  await pick("CS201");
  expect(button("Save rule").disabled).toBe(false);
  await click(button("Save rule"));
  expect(posts()).toHaveLength(1);
  expect(posts()[0].url).toContain("/curriculum-versions/v1/courses/id-CS301/rules");
  expect(posts()[0].body).toEqual({ type: "PREREQ", groupKey: "g1", requiredCourseId: "id-CS201", minGrade: "C" });
});

test("several courses chosen as 'needs all' are saved as separate requirements, each in a group of its own", async () => {
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  await pick("CS101"); await pick("CS201");
  expect(container.textContent).toContain("You chose 2 courses. How should they combine?");
  expect(container.querySelector('input[name="pre-mode"]').checked).toBe(true);           // "needs all" is the default
  await click(button("Save 2 rules"));
  expect(posts().map((c) => [c.body.requiredCourseId, c.body.groupKey])).toEqual([["id-CS101", "g1"], ["id-CS201", "g2"]]);
});

test("several courses chosen as 'needs any one' share one group, so passing either is enough", async () => {
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  await pick("CS101"); await pick("CS201");
  await click(container.querySelectorAll('input[name="pre-mode"]')[1]);
  await click(button("Save 2 rules"));
  const groups = posts().map((c) => c.body.groupKey);
  expect(groups[0]).toBe(groups[1]);
});

test("a new requirement never lands in a group that already exists on the course", async () => {
  await setup(version({ courses: [course("CS101", 1, { prerequisitesDeclared: true }), course("CS201", 2, { prerequisitesDeclared: true }),
    course("CS301", 3, { prerequisitesDeclared: true, rules: [{ id: "r9", type: "PREREQ", requires: { code: "CS101" }, minGradePoints: 1, minCreditsEarned: null, groupKey: "g1" }] })] }));
  await click(button("Add another requirement", card("CS301")));
  await pick("CS201");
  await click(button("Save rule"));
  expect(posts()[0].body.groupKey).toBe("g2");
});

test("existing rules read as 'and' between requirements and 'any one of these' for alternatives", async () => {
  const rule = (id, code, groupKey) => ({ id, type: "PREREQ", requires: { code }, minGradePoints: 1, minCreditsEarned: null, groupKey });
  await setup(version({ courses: [course("CS101", 1, { prerequisitesDeclared: true }), course("CS102", 1, { prerequisitesDeclared: true }), course("MT101", 1, { prerequisitesDeclared: true }),
    course("CS301", 3, { prerequisitesDeclared: true, rules: [rule("a", "CS101", "g1"), rule("b", "CS102", "g1"), rule("c", "MT101", "g2")] })] }));
  const text = card("CS301").textContent;
  expect(text).toContain("Any one of these");
  expect(text).toContain("or Must have passed CS102");
  expect(card("CS301").querySelector(".pre-and").textContent).toBe("and");
});

test("'Add another way to meet this' adds an alternative to that block, in the same group", async () => {
  const rule = (id, code, groupKey) => ({ id, type: "PREREQ", requires: { code }, minGradePoints: 1, minCreditsEarned: null, groupKey });
  await setup(version({ courses: [course("CS101", 1, { prerequisitesDeclared: true }), course("CS102", 1, { prerequisitesDeclared: true }),
    course("CS301", 3, { prerequisitesDeclared: true, rules: [rule("a", "CS101", "g1")] })] }));
  await click(button("+ Add another way to meet this", card("CS301")));
  expect(container.textContent).toContain("Another way to meet CS101");
  await pick("CS102");
  await click(button("Save rule"));
  expect(posts()[0].body.groupKey).toBe("g1");
});

test("if a save fails part-way, the ones already saved are dropped from the form so a retry cannot add them twice", async () => {
  axios.post.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({ response: { data: { message: "That would make the courses require each other in a loop" } } });
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  await pick("CS101"); await pick("CS201");
  await click(button("Save 2 rules"));
  expect(container.querySelector('[role="alert"]').textContent).toContain("in a loop");
  const still = [...container.querySelectorAll(".pre-pick-row input")].filter((i) => i.checked).map((i) => i.closest("label").textContent);
  expect(still).toHaveLength(1);
  expect(still[0]).toContain("CS201");
});

test("optional credits are sent with the rule when given", async () => {
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  await pick("CS201");
  await type(container.querySelector(".pre-more input"), "30");
  await click(button("Save rule"));
  expect(posts()[0].body).toEqual({ type: "PREREQ", groupKey: "g1", requiredCourseId: "id-CS201", minGrade: "D", minCreditsEarned: 30 });
});

test("a course cannot be its own prerequisite: it is not offered in the list", async () => {
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  const options = [...container.querySelectorAll(".pre-pick-row")].map((o) => o.textContent);
  expect(options.some((o) => o.startsWith("CS301"))).toBe(false);
  expect(options.some((o) => o.startsWith("CS201"))).toBe(true);
});

test("the course list can be filtered by code or name", async () => {
  await setup();
  await click(button("Add prerequisite", card("CS301")));
  await type(container.querySelector(".pre-pick-search"), "CS10");
  expect([...container.querySelectorAll(".pre-pick-row")].map((o) => o.querySelector("strong").textContent)).toEqual(["CS101"]);
});

test("removing a rule needs a reason and sends it", async () => {
  await setup();
  await click(button("Remove"));
  expect(button("Remove rule").disabled).toBe(true);
  await type(container.querySelector(".pre-form textarea"), "Replaced by a stricter rule");
  await click(button("Remove rule"));
  expect(axios.post.mock.calls[0][0]).toContain("/rules/r1/close");
  expect(axios.post.mock.calls[0][1]).toEqual({ reason: "Replaced by a stricter rule" });
});

test("a course nobody has answered can be marked as having no prerequisite", async () => {
  await setup();
  await click(button("No prerequisite", card("CS301")));
  expect(axios.post.mock.calls[0][0]).toContain("/courses/id-CS301/declare-none");
});

test("the server's refusal is shown in words, for example a loop", async () => {
  axios.post.mockRejectedValue({ response: { data: { message: "That would make the courses require each other in a loop" } } });
  await setup();
  await click(button("No prerequisite", card("CS301")));
  expect(container.querySelector('[role="alert"]').textContent).toContain("in a loop");
});

test("with no curriculum versions it says what to do, in words an administrator can act on", async () => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/grading-scale") ? { bands } : [] }));
  await act(async () => { root.render(<PrerequisitesPage />); });
  expect(container.textContent).toContain("Curriculum versions have not been set up yet.");
  expect(container.textContent).toContain("Ask your system administrator");
});

test("'To do' shows only the courses still unanswered, 'Done' only the answered ones", async () => {
  await setup();
  const shown = () => [...container.querySelectorAll(".pre-course-card")].map((r) => r.querySelector(".pre-course strong").textContent);
  expect(shown()).toEqual(["CS101", "CS201", "CS301"]);
  await click([...container.querySelectorAll(".pre-filter")].find((b) => b.textContent.startsWith("To do")));
  expect(shown()).toEqual(["CS301"]);
  await click([...container.querySelectorAll(".pre-filter")].find((b) => b.textContent.startsWith("Done")));
  expect(shown()).toEqual(["CS101", "CS201"]);
});

test("when nothing is left to do the To do view says so instead of showing an empty list", async () => {
  await setup(version({ courses: version().courses.map((c) => ({ ...c, prerequisitesDeclared: true })) }));
  await click([...container.querySelectorAll(".pre-filter")].find((b) => b.textContent.startsWith("To do")));
  expect(container.textContent).toContain("Nothing left to do. Every course has an answer.");
});

test("searching by code or name narrows the list, and says when nothing matches", async () => {
  await setup();
  const search = container.querySelector('input[type="search"]');
  await type(search, "cs2");
  expect([...container.querySelectorAll(".pre-course-card")]).toHaveLength(1);
  await type(search, "zzz");
  expect(container.textContent).toContain("No course matches that search.");
});

test("the 'how this works' guide can be hidden, and stays hidden next time", async () => {
  await setup();
  expect(container.textContent).toContain("How this works");
  await click(button("Got it, hide"));
  expect(container.textContent).not.toContain("How this works");
  act(() => root.unmount()); root = createRoot(container);
  await setup();
  expect(container.textContent).not.toContain("How this works");
});

test("a course that is not placed in any semester is not called 'Semester 0'", async () => {
  await setup(version({ courses: [...version().courses, course("T101", 0)] }));
  const heads = [...container.querySelectorAll(".pre-semester-head")].map((h) => h.textContent);
  expect(heads[0]).toBe("Not placed in a semester1 course · 1 to do");
  expect(container.textContent).not.toContain("Semester 0");
});
