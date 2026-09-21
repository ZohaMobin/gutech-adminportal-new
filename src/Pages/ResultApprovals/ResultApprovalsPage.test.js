import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { __setSearch } from "react-router-dom";
import axios from "axios";
import ResultApprovalsPage from "./ResultApprovalsPage";

jest.mock("axios");
// This app's Jest cannot load React Router 7, and the page only needs useSearchParams, so a small stand-in is used.
jest.mock("react-router-dom", () => {
  const React = require("react");
  let current = new URLSearchParams();
  const listeners = new Set();
  return {
    __setSearch: (query) => { current = new URLSearchParams(query); },
    useSearchParams: () => {
      const [, force] = React.useState(0);
      React.useEffect(() => { const l = () => force((n) => n + 1); listeners.add(l); return () => listeners.delete(l); }, []);
      return [current, (next) => { current = new URLSearchParams(next); listeners.forEach((l) => l()); }];
    },
  };
}, { virtual: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const item = (over = {}) => ({ sectionId: "s1", state: "SUBMITTED", submittedAt: "2026-09-20T10:00:00Z", course: { code: "CS101", name: "Programming" }, section: "A", teachers: ["Dr. Ada Lovelace"], term: "Fall 2026", studentCount: 3, description: "Add 2 marks to every student", upgraded: true, classAverageBefore: 69, classAverageAfter: 71, passingBefore: 2, passingAfter: 3, studentsMovedUp: 1, ...over });
const summary = { studentCount: 3, gradedCount: 2, classAverageBefore: 69, classAverageAfter: 71, passingBefore: 2, passingAfter: 3, studentsUpgraded: 2, studentsMovedUp: 1, studentsAtCeiling: 0, studentsLimited: 0, distribution: { grades: ["A", "F"], before: { A: 1, F: 1 }, after: { A: 1, F: 0 } } };
const rows = [
  { registrationId: "r1", name: "Ayesha Khan", rollNumber: "R-1", raw: 48, upgrade: 2, final: 50 },
  { registrationId: "r2", name: "Bilal Ahmed", rollNumber: "R-2", raw: 90, upgrade: 2, final: 92 },
  { registrationId: "r3", name: "Sana Butt", rollNumber: "R-3", raw: null, upgrade: 0, final: null },
];
const batch = (over = {}) => ({ sectionId: "s1", course: { code: "CS101", name: "Programming" }, sectionName: "A", state: "SUBMITTED", submittedAt: "2026-09-20T10:00:00Z", returnedReason: null, stale: false, ledger: null,
  readiness: { weights: { ready: true, regularWeight: 100 } }, history: [{ state: "SUBMITTED", at: "2026-09-20T10:00:00Z", note: "Submitted for approval" }],
  generation: { scheme: { type: "ADD_MARKS", marks: 2 }, description: "Add 2 marks to every student", reason: "The final was harder than planned", summary, rows }, ...over });
const preview = { rows: [{ registrationId: "r1", rawGrade: { grade: "F" }, finalGrade: { grade: "D" } }, { registrationId: "r2", rawGrade: { grade: "A" }, finalGrade: { grade: "A" } }, { registrationId: "r3", rawGrade: null, finalGrade: null }] };

let container; let root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await flush(); };
const type = async (el, value) => act(async () => {
  const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const button = (label, scope = container) => [...scope.querySelectorAll("button")].find((b) => b.textContent.trim() === label);
const posts = () => axios.post.mock.calls.map(([url, body]) => ({ url, body }));

const setup = async ({ list = [item()], counts = { SUBMITTED: 1, UNDER_REVIEW: 0, APPROVED: 0, PUBLISHED: 0, AMENDED: 0 }, detail = batch(), start = "" } = {}) => {
  __setSearch(start);
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes("/section/") ? detail : { items: list, counts } }));
  axios.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/preview") ? preview : {} }));
  await act(async () => { root.render(<ResultApprovalsPage />); });
  await flush();
};
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); axios.get.mockReset(); axios.post.mockReset(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("the list shows what is waiting: course, section, teacher, the teacher's choice and its effect", async () => {
  await setup();
  const text = container.textContent;
  expect(text).toContain("CS101"); expect(text).toContain("Section A · Fall 2026 · Dr. Ada Lovelace");
  expect(text).toContain("Add 2 marks to every student");
  expect(text).toContain("Average 69 → 71"); expect(text).toContain("Passing 2 → 3");
  expect(container.querySelector(".ra-state").textContent).toBe("Submitted");
  expect(button("Review")).toBeTruthy();
});

test("tabs count and filter by where each section stands", async () => {
  await setup({ list: [item(), item({ sectionId: "s2", state: "APPROVED", course: { code: "MT202", name: "Algebra" } }), item({ sectionId: "s3", state: "PUBLISHED", course: { code: "GE104", name: "Writing" } })],
    counts: { SUBMITTED: 1, UNDER_REVIEW: 0, APPROVED: 1, PUBLISHED: 1, AMENDED: 0 } });
  expect([...container.querySelectorAll(".ra-tab")].map((t) => t.textContent)).toEqual(["To review1", "Ready to publish1", "Published1", "All3"]);
  expect(container.textContent).toContain("CS101"); expect(container.textContent).not.toContain("MT202");
  await click([...container.querySelectorAll(".ra-tab")][1]);
  expect(container.textContent).toContain("MT202"); expect(button("Publish")).toBeTruthy();
  await click([...container.querySelectorAll(".ra-tab")][3]);
  expect(container.querySelectorAll(".ra-card")).toHaveLength(3);
});

test("an empty tab says what to expect, and a search with no match says so", async () => {
  await setup({ list: [], counts: {} });
  expect(container.textContent).toContain("Nothing is waiting for review.");
  await setup();
  await type(container.querySelector('input[type="search"]'), "zzz");
  expect(container.textContent).toContain("No submitted section matches that search.");
});

test("a section that was submitted without an upgrade says 'As entered'", async () => {
  await setup({ list: [item({ upgraded: false, description: "As entered (no upgrade)" })] });
  expect(container.querySelector(".ra-chip").textContent).toBe("As entered");
});

test("opening a section shows the teacher's choice and reason, the effect, and every student with letters", async () => {
  await setup();
  await click(button("Review"));
  const text = container.textContent;
  expect(text).toContain("CS101 Programming"); expect(text).toContain("Section A");
  expect(text).toContain("The final was harder than planned");
  expect(text).toContain("Moved up a grade");
  expect(text).toContain("Ayesha Khan");
  expect(container.querySelector(".ra-move s").textContent).toBe("F");
  expect(container.querySelector(".ra-move .ra-letter").textContent).toBe("D");
  expect(axios.post.mock.calls[0][0]).toContain("/section/s1/preview");
});

test("a student with no marks needs a reason before the section can be approved, and the decision is sent", async () => {
  await setup();
  await click(button("Review"));
  expect(container.textContent).toContain("1 student has no marks at all");
  expect(button("Approve").disabled).toBe(true);
  expect(container.querySelector(".ra-actions-hint").textContent).toContain("Give a reason for each student with no marks");
  await type(container.querySelector(".ra-decisions select"), "W");
  await type(container.querySelector(".ra-decisions input"), "Absent all term, medical leave on file");
  expect(button("Approve").disabled).toBe(false);
  await click(button("Approve"));
  expect(container.textContent).toContain("Approve these results?");
  expect(container.textContent).toContain("Students still see nothing until you publish.");
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Approve"));
  const approve = posts().find((p) => p.url.endsWith("/approve"));
  expect(approve.body).toEqual({ nonNumeric: [{ registrationId: "r3", grade: "W", reason: "Absent all term, medical leave on file" }] });
});

test("a section where everyone has marks can be approved straight away", async () => {
  const everyone = rows.slice(0, 2);
  await setup({ detail: batch({ generation: { ...batch().generation, rows: everyone } }) });
  await click(button("Review"));
  expect(container.querySelector(".ra-decisions")).toBeNull();
  expect(button("Approve").disabled).toBe(false);
  await click(button("Approve"));
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Approve"));
  expect(posts().find((p) => p.url.endsWith("/approve")).body).toEqual({ nonNumeric: [] });
});

test("returning to the teacher needs a reason and sends it", async () => {
  await setup();
  await click(button("Review"));
  await click(button("Return to teacher"));
  const send = [...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Return");
  expect(send.disabled).toBe(true);
  await type(container.querySelector(".ra-modal textarea"), "Please re-check the Midterm marks");
  await click(send);
  expect(posts().find((p) => p.url.endsWith("/return")).body).toEqual({ reason: "Please re-check the Midterm marks" });
});

test("'Start review' moves a submitted section into review", async () => {
  await setup();
  await click(button("Review"));
  await click(button("Start review"));
  expect(posts().some((p) => p.url.endsWith("/review"))).toBe(true);
});

test("approval is blocked with an explanation when the weightage is not 100, and when the marks changed", async () => {
  await setup({ detail: batch({ generation: { ...batch().generation, rows: rows.slice(0, 2) }, readiness: { weights: { ready: false, regularWeight: 95 } } }) });
  await click(button("Review"));
  expect(container.textContent).toContain("The regular weightage is 95%, not 100%");
  expect(button("Approve").disabled).toBe(true);
  await setup({ detail: batch({ generation: { ...batch().generation, rows: rows.slice(0, 2) }, stale: true }) });
  await click(button("Review"));
  expect(container.textContent).toContain("The marks no longer match what the teacher submitted");
  expect(button("Approve").disabled).toBe(true);
});

test("an approved section shows the recorded letters and can be published after a confirmation", async () => {
  await setup({ list: [item({ state: "APPROVED" })], detail: batch({ state: "APPROVED", ledger: [{ registrationId: "r1", letterGrade: "D" }, { registrationId: "r2", letterGrade: "A" }, { registrationId: "r3", letterGrade: "I" }] }) });
  await click([...container.querySelectorAll(".ra-tab")][1]);
  await click(button("Publish"));
  expect([...container.querySelectorAll(".ra-letter")].map((e) => e.textContent)).toEqual(["D", "A", "I"]);
  expect(button("Approve")).toBeUndefined();
  await click(button("Publish to students"));
  expect(container.textContent).toContain("They will not see any upgrade, only the final grade.");
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Publish"));
  expect(posts().some((p) => p.url.endsWith("/publish"))).toBe(true);
});

test("a published section is read-only: no actions, and the history is shown", async () => {
  await setup({ list: [item({ state: "PUBLISHED" })], detail: batch({ state: "PUBLISHED", ledger: [], history: [{ state: "SUBMITTED", at: "2026-09-20T10:00:00Z", note: "Submitted for approval" }, { state: "PUBLISHED", at: "2026-09-21T10:00:00Z", note: "Published to students" }] }) });
  await click([...container.querySelectorAll(".ra-tab")][2]);
  await click(button("View"));
  expect(container.querySelector(".ra-actions")).toBeNull();
  expect(container.textContent).toContain("Published. Students can see their grades on their transcript.");
  expect([...container.querySelectorAll(".ra-history li")].map((li) => li.textContent)[0]).toContain("Published to students");
});

test("the server's refusal is shown in the dialog in plain words", async () => {
  await setup({ detail: batch({ generation: { ...batch().generation, rows: rows.slice(0, 2) } }) });
  await click(button("Review"));
  axios.post.mockImplementation((url) => (url.endsWith("/approve") ? Promise.reject({ response: { data: { message: "These results were changed by someone else while you were approving." } } }) : Promise.resolve({ data: preview })));
  await click(button("Approve"));
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Approve"));
  expect(container.querySelector(".ra-modal [role=alert]").textContent).toContain("changed by someone else");
});

test("opening a section by its link goes straight to the detail", async () => {
  await setup({ start: "section=s1" });
  expect(container.textContent).toContain("CS101 Programming");
});
