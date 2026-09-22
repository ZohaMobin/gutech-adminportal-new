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

const bscs = { id: "p1", name: "BS Computer Science", code: "BSCS" };
const bba = { id: "p2", name: "BBA", code: "BBA" };
const item = (over = {}) => ({ sectionId: "s1", state: "SUBMITTED", submittedAt: "2026-09-20T10:00:00Z", course: { code: "CS101", name: "Programming" }, section: "A", teachers: ["Dr. Ada Lovelace"], term: "Fall 2026", program: bscs, otherPrograms: [], studentCount: 3, gradedCount: 2, description: "Add 2 marks to every student", upgraded: true, classAverageBefore: 69, classAverageAfter: 71, passingBefore: 2, passingAfter: 2, studentsMovedUp: 1, ...over });
const columns = [{ key: "sessionals", label: "Sessionals", weight: 20 }, { key: "midterm", label: "Midterm", weight: 30 }, { key: "final", label: "Final Term", weight: 50 }];
const sheetRows = [
  { registrationId: "r1", rollNumber: "R-1", name: "Ayesha Khan", parts: { sessionals: 12, midterm: 16, final: 20 }, entered: 48, upgrade: 2, total: 50, grade: "D", gradePoints: 1, noMarks: false },
  { registrationId: "r2", rollNumber: "R-2", name: "Bilal Ahmed", parts: { sessionals: 18, midterm: 27, final: 45 }, entered: 90, upgrade: 2, total: 92, grade: "A", gradePoints: 4, noMarks: false },
  { registrationId: "r4", rollNumber: "R-4", name: "Zara Noor", parts: { sessionals: 6, midterm: 9, final: 10 }, entered: 25, upgrade: 2, total: 27, grade: "F", gradePoints: 0, noMarks: false },
  { registrationId: "r3", rollNumber: "R-3", name: "Sana Butt", parts: { sessionals: 0, midterm: 0, final: 0 }, entered: null, upgrade: 0, total: null, grade: null, gradePoints: null, noMarks: true },
];
const stats = { students: 4, graded: 3, noMarks: 1, average: 56.33, highest: 92, lowest: 27, passing: 2, passRate: 67, upgraded: 3, distribution: { grades: ["A", "C", "D", "F"], counts: { A: 1, C: 0, D: 1, F: 1 } } };
const batch = (over = {}) => ({ sectionId: "s1", course: { code: "CS101", name: "Programming" }, sectionName: "A", program: bscs, term: "Fall 2026", teachers: ["Dr. Ada Lovelace"], state: "SUBMITTED", submittedAt: "2026-09-20T10:00:00Z", returnedReason: null, stale: false, ledger: null,
  readiness: { weights: { ready: true, regularWeight: 100 } }, history: [{ state: "SUBMITTED", at: "2026-09-20T10:00:00Z", note: "Submitted for approval" }],
  generation: { scheme: { type: "ADD_MARKS", marks: 2 }, description: "Add 2 marks to every student", reason: "The final was harder than planned", rows: [] },
  sheet: { columns, passingGradePoints: 1, bands: [{ grade: "A", minPercentage: 86 }, { grade: "C", minPercentage: 62 }, { grade: "D", minPercentage: 50 }, { grade: "F", minPercentage: 0 }], hasUpgrade: true, rows: sheetRows, stats }, ...over });
const noUpgradeSheet = () => ({ columns, passingGradePoints: 1, hasUpgrade: false, rows: sheetRows.map((r) => ({ ...r, upgrade: 0, total: r.entered })), stats: { ...stats, upgraded: 0 } });

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
const names = () => [...container.querySelectorAll('.ra-table [role="row"]:not(.ra-thead) .name strong')].map((n) => n.textContent);
const open = () => click(container.querySelector(".ra-card .ra-btn"));

const setup = async ({ list = [item()], counts = { SUBMITTED: 1, UNDER_REVIEW: 0, APPROVED: 0, PUBLISHED: 0, AMENDED: 0 }, detail = batch(), detailFor = null, start = "" } = {}) => {
  __setSearch(start);
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes("/section/") ? (detailFor ? detailFor(url) : detail) : { items: list, counts } }));
  axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
  await act(async () => { root.render(<ResultApprovalsPage />); });
  await flush();
};
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); axios.get.mockReset(); axios.post.mockReset(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

// ---------- the list ----------

test("the list shows what is waiting: course, section, teacher, and the section's own results", async () => {
  await setup();
  const text = container.textContent;
  expect(text).toContain("CS101"); expect(text).toContain("Section A · Fall 2026 · Dr. Ada Lovelace");
  expect(text).toContain("3 students"); expect(text).toContain("Average 71"); expect(text).toContain("Pass rate 100%");
  expect(text).toContain("Upgrade applied");
  expect(container.querySelector(".ra-state").textContent).toBe("Submitted");
});

test("sections are divided by program, then course and section, with a count of what is waiting", async () => {
  await setup({ list: [item({ sectionId: "s1" }), item({ sectionId: "s2", section: "B" }), item({ sectionId: "s3", program: bba, course: { code: "BA100", name: "Management" } }), item({ sectionId: "s4", program: null, course: { code: "XX1", name: "Orphan" } })],
    counts: { SUBMITTED: 4 } });
  const heads = [...container.querySelectorAll(".ra-group-head")].map((h) => h.textContent);
  expect(heads).toEqual(["BBABBA1 section · 1 to review", "BS Computer ScienceBSCS2 sections · 2 to review", "Program not set1 section · 1 to review"]);
  const bscsCards = [...container.querySelectorAll(".ra-group")][1].querySelectorAll(".ra-card");
  expect([...bscsCards].map((c) => c.querySelector(".ra-card-course small").textContent.slice(0, 9))).toEqual(["Section A", "Section B"]);
});

test("the list can be narrowed to one program", async () => {
  await setup({ list: [item({ sectionId: "s1" }), item({ sectionId: "s3", program: bba, course: { code: "BA100", name: "Management" } })] });
  await type(container.querySelector('select[aria-label="Filter by program"]'), "p2");
  expect(container.textContent).toContain("BA100"); expect(container.textContent).not.toContain("CS101");
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

// ---------- the class result sheet ----------

test("opening a section shows the whole class result: a column for each part, the upgrade, the total and the grade", async () => {
  await setup();
  await open();
  const head = [...container.querySelectorAll(".ra-thead [role=columnheader]")].map((h) => h.textContent);
  expect(head).toEqual(["#", "Roll no ↑", "Name", "Sessionals/20", "Midterm/30", "Final Term/50", "Upgrade", "Total/100", "Grade"]);
  const first = container.querySelector('.ra-table [role="row"]:not(.ra-thead)');
  expect([...first.querySelectorAll("[role=cell]")].map((c) => c.textContent)).toEqual(["1", "R-1", "Ayesha KhanR-1", "12", "16", "20", "+2", "50", "D"]);
  expect(container.textContent).toContain("CS101 Programming");
  expect(container.textContent).toContain("BS Computer Science · Fall 2026 · Dr. Ada Lovelace");
});

test("the header holds the actions, and one line says where this stands; there is no progress bar or banner", async () => {
  await setup();
  await open();
  const bar = container.querySelector(".ra-bar");
  expect(bar.textContent).toContain("CS101 Programming"); expect(bar.textContent).toContain("Section A");
  expect([...bar.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Return to teacher", "Start review", "Approve"]);
  expect(container.querySelector(".ra-status-line").textContent).toContain("waiting for your review");
  expect(container.querySelector(".ra-steps")).toBeNull();
  expect(container.querySelector(".ra-actions")).toBeNull();
});

test("one summary line shows the section's overall result; the teacher's reason is one click away, not a card", async () => {
  await setup();
  await open();
  const strip = container.querySelector(".ra-strip-row").textContent;
  expect(strip).toContain("Students4"); expect(strip).toContain("Average56.33"); expect(strip).toContain("Highest92"); expect(strip).toContain("Lowest27"); expect(strip).toContain("Pass rate67%");
  expect(container.querySelector(".ra-spreadline").textContent).toBe("A 1 · D 1 · F 1");
  expect(container.textContent).not.toContain("The final was harder than planned");
  await click(button("Upgrade +2 marks ▾"));
  expect(container.textContent).toContain("The final was harder than planned");
  expect(container.textContent).toContain("Add 2 marks to every student");
  expect(container.textContent).not.toContain("Effect on the class");
});

test("with no upgrade there is no Upgrade column, and the screen says so", async () => {
  await setup({ detail: batch({ sheet: noUpgradeSheet() }) });
  await open();
  expect([...container.querySelectorAll(".ra-thead [role=columnheader]")].map((h) => h.textContent)).not.toContain("Upgrade");
  expect(container.querySelector(".ra-strip").textContent).toContain("No upgrade");
});

test("a student with no marks is shown as such, and a failing total is marked", async () => {
  await setup();
  await open();
  expect(container.textContent).toContain("No marks. Record as");
  expect(container.querySelector(".ra-row.failing .name strong").textContent).toBe("Zara Noor");
});

test("a large class stays easy to work: search, filters with counts, and sorting", async () => {
  await setup();
  await open();
  expect([...container.querySelectorAll(".ra-chipbtn")].map((b) => b.textContent)).toEqual(["All4", "Upgraded3", "Not passing1", "No marks1"]);
  await type(container.querySelector('input[aria-label="Find a student by name or roll number"]'), "bilal");
  expect(names()).toEqual(["Bilal Ahmed"]);
  await type(container.querySelector('input[aria-label="Find a student by name or roll number"]'), "");
  await click([...container.querySelectorAll(".ra-chipbtn")].find((b) => b.textContent.startsWith("Not passing")));
  expect(names()).toEqual(["Zara Noor"]);
  await click([...container.querySelectorAll(".ra-chipbtn")].find((b) => b.textContent.startsWith("All")));
  await click([...container.querySelectorAll(".ra-thead .sortable")].find((b) => b.textContent.startsWith("Total")));
  expect(names()[0]).toBe("Bilal Ahmed");                                   // highest total first
  await click([...container.querySelectorAll(".ra-thead .sortable")].find((b) => b.textContent.startsWith("Name")));
  expect(names()[0]).toBe("Ayesha Khan");
});

test("the sheet can be downloaded as a spreadsheet file", async () => {
  let text = "";
  global.URL.createObjectURL = jest.fn((blob) => { const reader = new FileReader(); reader.onload = () => { text = reader.result; }; reader.readAsText(blob); return "blob:x"; });
  global.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});     // jsdom cannot navigate to a download
  await setup();
  await open();
  await click(button("Download CSV"));
  expect(global.URL.createObjectURL).toHaveBeenCalled();
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  expect(text.split("\n")[0]).toBe("Roll no,Name,Sessionals (/20),Midterm (/30),Final Term (/50),Entered total,Upgrade,Total,Grade");
  expect(text).toContain("R-1,Ayesha Khan,12,16,20,48,2,50,D");
});

test("Previous and Next move between the sections in the list, so a long queue is quick to work through", async () => {
  await setup({ list: [item({ sectionId: "s1" }), item({ sectionId: "s2", section: "B" }), item({ sectionId: "s3", section: "C" })], detailFor: (url) => batch({ sectionId: url.split("/section/")[1], sectionName: url.endsWith("s2") ? "B" : url.endsWith("s3") ? "C" : "A" }) });
  await click(container.querySelectorAll(".ra-card .ra-btn")[1]);
  expect(container.querySelector(".ra-pager").textContent).toContain("2 of 3");
  await click(button("Next ›"));
  expect(container.querySelector(".ra-bar h1").textContent).toContain("Section C");
  expect(button("Next ›").disabled).toBe(true);
  await click(button("‹ Previous")); await click(button("‹ Previous"));
  expect(container.querySelector(".ra-bar h1").textContent).toContain("Section A");
});

// ---------- the workflow ----------

test("a student with no marks needs a reason before the section can be approved, and the decision is sent", async () => {
  await setup();
  await open();
  expect(container.querySelector(".ra-notice").textContent).toContain("1 student has no marks. Choose how to record each one");
  expect(button("Approve").disabled).toBe(true);
  await type(container.querySelector(".ra-inline-decision select"), "W");
  await type(container.querySelector(".ra-inline-decision input"), "Absent all term, medical leave on file");
  expect(container.querySelector(".ra-notice").textContent).toContain("will be recorded as chosen");
  expect(button("Approve").disabled).toBe(false);
  await click(button("Approve"));
  expect(container.textContent).toContain("Approve this class result?");
  expect(container.textContent).toContain("Students still see nothing until you publish.");
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Approve"));
  expect(posts().find((p) => p.url.endsWith("/approve")).body).toEqual({ nonNumeric: [{ registrationId: "r3", grade: "W", reason: "Absent all term, medical leave on file" }] });
});

test("a section where everyone has marks can be approved straight away", async () => {
  const everyone = { ...batch().sheet, rows: sheetRows.filter((r) => !r.noMarks) };
  await setup({ detail: batch({ sheet: everyone }) });
  await open();
  expect(container.querySelector(".ra-inline-decision")).toBeNull();
  expect(button("Approve").disabled).toBe(false);
  await click(button("Approve"));
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Approve"));
  expect(posts().find((p) => p.url.endsWith("/approve")).body).toEqual({ nonNumeric: [] });
});

test("returning to the teacher needs a reason and sends it", async () => {
  await setup();
  await open();
  await click(button("Return to teacher"));
  const send = [...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Return");
  expect(send.disabled).toBe(true);
  await type(container.querySelector(".ra-modal textarea"), "Please re-check the Midterm marks");
  await click(send);
  expect(posts().find((p) => p.url.endsWith("/return")).body).toEqual({ reason: "Please re-check the Midterm marks" });
});

test("'Start review' moves a submitted section into review", async () => {
  await setup();
  await open();
  await click(button("Start review"));
  expect(posts().some((p) => p.url.endsWith("/review"))).toBe(true);
});

test("approval is blocked with an explanation when the weightage is not 100, and when the marks changed", async () => {
  const ready = { ...batch().sheet, rows: sheetRows.filter((r) => !r.noMarks) };
  await setup({ detail: batch({ sheet: ready, readiness: { weights: { ready: false, regularWeight: 95 } } }) });
  await open();
  expect(container.textContent).toContain("The regular weightage is 95%, not 100%");
  expect(button("Approve").disabled).toBe(true);
  await setup({ detail: batch({ sheet: ready, stale: true }) });
  await open();
  expect(container.textContent).toContain("The marks no longer match what the teacher submitted");
  expect(button("Approve").disabled).toBe(true);
});

test("an approved section shows the recorded grades and can be published after a confirmation", async () => {
  const recorded = { ...batch().sheet, rows: sheetRows.map((r) => (r.noMarks ? { ...r, grade: "I" } : r)) };
  await setup({ list: [item({ state: "APPROVED" })], detail: batch({ state: "APPROVED", sheet: recorded }) });
  await click([...container.querySelectorAll(".ra-tab")][1]);
  await click(button("Publish"));
  expect([...container.querySelectorAll(".ra-table .ra-letter")].map((e) => e.textContent)).toEqual(["D", "A", "I", "F"]);
  expect(container.querySelector(".ra-inline-decision")).toBeNull();
  expect(button("Approve")).toBeUndefined();
  await click(button("Publish to students"));
  expect(container.textContent).toContain("They will not see any upgrade, only the final grade.");
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Publish"));
  expect(posts().some((p) => p.url.endsWith("/publish"))).toBe(true);
});

test("a published section is read-only: no actions, and the history is shown", async () => {
  await setup({ list: [item({ state: "PUBLISHED" })], detail: batch({ state: "PUBLISHED", history: [{ state: "SUBMITTED", at: "2026-09-20T10:00:00Z", note: "Submitted for approval" }, { state: "PUBLISHED", at: "2026-09-21T10:00:00Z", note: "Published to students" }] }) });
  await click([...container.querySelectorAll(".ra-tab")][2]);
  await click(button("View"));
  expect(container.querySelector(".ra-head-actions")).toBeNull();
  expect(container.querySelector(".ra-status-line").textContent).toContain("students can see their grades on the transcript");
  expect([...container.querySelectorAll(".ra-history li")].map((li) => li.textContent)[0]).toContain("Published to students");
});

test("the server's refusal is shown in the dialog in plain words", async () => {
  const ready = { ...batch().sheet, rows: sheetRows.filter((r) => !r.noMarks) };
  await setup({ detail: batch({ sheet: ready }) });
  await open();
  axios.post.mockImplementation((url) => (url.endsWith("/approve") ? Promise.reject({ response: { data: { message: "These results were changed by someone else while you were approving." } } }) : Promise.resolve({ data: {} })));
  await click(button("Approve"));
  await click([...container.querySelectorAll(".ra-modal button")].find((b) => b.textContent === "Approve"));
  expect(container.querySelector(".ra-modal [role=alert]").textContent).toContain("changed by someone else");
});

test("opening a section by its link goes straight to the detail", async () => {
  await setup({ start: "section=s1" });
  expect(container.textContent).toContain("CS101 Programming");
});

// ---------- messages a person can act on ----------

test("when results processing is switched off the administrator is told up front and cannot return, approve or publish", async () => {
  await setup({ detail: batch({ workflowEnabled: false, sheet: { ...batch().sheet, rows: sheetRows.filter((r) => !r.noMarks) } }) });
  await open();
  expect(container.textContent).toContain("Results processing isn't switched on yet.");
  expect(container.textContent).toContain("system administrator turns it on");
  expect(container.textContent).not.toMatch(/workflow|flag|resultBatches/i);
  for (const label of ["Return to teacher", "Start review", "Approve"]) expect(button(label).disabled).toBe(true);
});

test("with processing switched on there is no such notice", async () => {
  await setup();
  await open();
  expect(container.textContent).not.toContain("isn't switched on yet");
});

test("a failed load is explained in plain words: no connection, a server fault, or a signed-out session", async () => {
  let n = 0;
  const failWith = async (error) => {
    axios.get.mockImplementation((url) => (url.includes("/section/") ? Promise.reject(error) : Promise.resolve({ data: { items: [item({ sectionId: `s${++n}` })], counts: { SUBMITTED: 1 } } })));
    axios.post.mockImplementation(() => Promise.resolve({ data: {} }));
    __setSearch("");
    await act(async () => { root.render(<ResultApprovalsPage />); });
    await flush();
    await click(container.querySelector(".ra-card .ra-btn"));
    const text = container.querySelector(".ra-error").textContent;
    act(() => root.unmount()); root = createRoot(container);
    return text;
  };
  expect(await failWith({ request: {} })).toContain("Couldn't reach the server. Check your internet connection and try again.");
  expect(await failWith({ response: { status: 500, data: {} } })).toContain("Something went wrong on our side. Please try again in a moment.");
  expect(await failWith({ response: { status: 401, data: {} } })).toContain("Your session has ended. Please sign in again.");
});


// ---------- amending a published result ----------

const publishedBatch = (over = {}) => batch({ state: "PUBLISHED", history: [{ state: "PUBLISHED", at: "2026-09-21T10:00:00Z", note: "Published to students" }], ...over,
  sheet: { ...batch().sheet, rows: sheetRows.map((r) => (r.noMarks ? { ...r, grade: "I" } : r)), ...(over.sheet || {}) } });
const openPublished = async (detail) => { await setup({ list: [item({ state: "PUBLISHED" })], detail }); await click([...container.querySelectorAll(".ra-tab")][2]); await click(button("View")); };
const dialog = () => container.querySelector(".ra-amend");
const amendButton = (name) => container.querySelector(`button[aria-label="Amend the result of ${name}"]`);

test("every row of a published section has an Amend button; a section that is not yet published has none", async () => {
  await openPublished(publishedBatch());
  expect(container.querySelectorAll(".ra-amend-btn")).toHaveLength(4);
  await setup();
  await click(container.querySelector(".ra-card .ra-btn"));
  expect(container.querySelector(".ra-amend-btn")).toBeNull();
});

test("the dialog shows the current result, works out the new grade as the total is typed, and needs a reason", async () => {
  await openPublished(publishedBatch());
  await click(amendButton("Ayesha Khan"));
  expect(dialog().textContent).toContain("Ayesha Khan");
  expect(dialog().querySelector(".ra-amend-now").textContent).toContain("Total 50");
  expect(button("Amend result").disabled).toBe(true);
  await type(dialog().querySelector('input[type="number"]'), "64");
  expect(dialog().querySelector(".ra-amend-result").textContent).toContain("The new grade will be C");
  expect(button("Amend result").disabled).toBe(true);                       // still no reason
  await type(dialog().querySelector("textarea"), "The midterm was added up wrongly");
  expect(button("Amend result").disabled).toBe(false);
});

test("amending sends the corrected total and the reason, and tells the administrator what the transcript now shows", async () => {
  await openPublished(publishedBatch());
  await click(amendButton("Ayesha Khan"));
  await type(dialog().querySelector('input[type="number"]'), "64");
  await type(dialog().querySelector("textarea"), "The midterm was added up wrongly");
  await click(button("Amend result"));
  const call = posts().find((p) => p.url.endsWith("/amend"));
  expect(call.body).toEqual({ registrationId: "r1", reason: "The midterm was added up wrongly", finalPercentage: 64 });
  expect(container.querySelector(".ra-banner.ok").textContent).toContain("Result amended for Ayesha Khan. The transcript now shows C.");
  expect(dialog()).toBeNull();
});

test("a student can be changed to Incomplete or Withdrawn instead, with no total", async () => {
  await openPublished(publishedBatch());
  await click(amendButton("Bilal Ahmed"));
  await click(dialog().querySelectorAll('input[name="amend-mode"]')[2]);
  expect(dialog().querySelector('input[type="number"]')).toBeNull();
  expect(dialog().querySelector(".ra-amend-result").textContent).toContain("The new grade will be W");
  await type(dialog().querySelector("textarea"), "The student withdrew before the deadline");
  await click(button("Amend result"));
  expect(posts().find((p) => p.url.endsWith("/amend")).body).toEqual({ registrationId: "r2", reason: "The student withdrew before the deadline", grade: "W" });
});

test("a result that would not change is refused with an explanation, and so is a total outside 0 to 100", async () => {
  await openPublished(publishedBatch());
  await click(amendButton("Ayesha Khan"));
  await type(dialog().querySelector("textarea"), "Checking the result again");
  expect(dialog().textContent).toContain("That is the same as the current result");
  expect(button("Amend result").disabled).toBe(true);
  await type(dialog().querySelector('input[type="number"]'), "150");
  expect(dialog().textContent).toContain("The total must be a number from 0 to 100.");
  expect(button("Amend result").disabled).toBe(true);
});

test("an Incomplete can be resolved with a total", async () => {
  await openPublished(publishedBatch());
  await click(amendButton("Sana Butt"));
  expect(dialog().querySelector(".ra-amend-now").textContent).toContain("No total");
  await type(dialog().querySelector('input[type="number"]'), "64");
  await type(dialog().querySelector("textarea"), "Completed the missing exam");
  await click(button("Amend result"));
  expect(posts().find((p) => p.url.endsWith("/amend")).body).toEqual({ registrationId: "r3", reason: "Completed the missing exam", finalPercentage: 64 });
});

test("a corrected row carries an 'amended' tag saying what it was and why, and the status line counts the corrections", async () => {
  const rows2 = sheetRows.map((r) => (r.registrationId === "r1" ? { ...r, total: 64, grade: "C", gradePoints: 2, amended: { fromGrade: "D", fromTotal: 50, reason: "The midterm was added up wrongly", at: "2026-09-21T11:00:00Z" } } : r.noMarks ? { ...r, grade: "I" } : r));
  await openPublished(batch({ state: "AMENDED", sheet: { ...batch().sheet, rows: rows2 } }));
  const tag = container.querySelector(".ra-amended-tag");
  expect(tag.title).toBe("Was D (50). The midterm was added up wrongly");
  expect(tag.textContent).toBe("Amended · was D (50)");
  expect(tag.closest(".name")).not.toBeNull();                                  // in the name cell, so it never crowds the grade column
  expect(container.querySelectorAll(".ra-amended-tag")).toHaveLength(1);
  expect(container.querySelector(".ra-row.amended .name strong").textContent).toBe("Ayesha Khan");
  expect(container.querySelector(".ra-status-line").textContent).toContain("1 result amended since");
  expect(container.querySelector(".ra-head-actions")).toBeNull();
});

test("the server's refusal is shown inside the dialog, which stays open", async () => {
  await openPublished(publishedBatch());
  await click(amendButton("Ayesha Khan"));
  await type(dialog().querySelector('input[type="number"]'), "64");
  await type(dialog().querySelector("textarea"), "The midterm was added up wrongly");
  axios.post.mockImplementation(() => Promise.reject({ response: { data: { message: "This result was just changed by someone else. Refresh and try again." } } }));
  await click(button("Amend result"));
  expect(dialog().querySelector("[role=alert]").textContent).toContain("just changed by someone else");
});

test("with results processing switched off there is no Amend button", async () => {
  await openPublished(publishedBatch({ workflowEnabled: false }));
  expect(container.querySelector(".ra-amend-btn")).toBeNull();
});
