global.IS_REACT_ACT_ENVIRONMENT = true;
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import axios from "axios";
import EnrollmentHistory, { resultText } from "./EnrollmentHistory";

jest.mock("axios");

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

const item = (over = {}) => ({
  jobId: "j1", status: "done", createdAt: "2026-09-20T10:00:00Z", by: { name: "Registrar Office" }, course: { code: "CS101", name: "Programming" },
  term: "Fall 2026", semester: 1, fileName: "cs101.xlsx", rowsInFile: 40, leftOut: 3, total: 37, processed: 37, registered: 35, alreadyRegistered: 0, failed: 2, ...over,
});
const mount = async (items) => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/bulk-enroll") ? { items } : { rows: [{ rollNumber: "R-1", section: "A", status: "registered" }, { rollNumber: "R-2", section: "A", status: "failed", message: "Section A is full" }] } }));
  await act(async () => { root.render(<EnrollmentHistory apiUrl="http://x" headers={() => ({})} refreshKey={0} />); });
  await wait(10);
};

beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); jest.clearAllMocks(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("each upload shows who, when, the course and file, and what came of it", async () => {
  await mount([item()]);
  const row = container.querySelector(".enh-row").textContent;
  expect(row).toContain("CS101 Programming");
  expect(row).toContain("Fall 2026 · Semester 1 · cs101.xlsx");
  expect(row).toContain("Registrar Office");
  expect(row).toContain("35 enrolled · 2 not enrolled");
  expect(row).toContain("3 rows of the file left out");
});

test("opening an upload loads its full report once, with each student's result and reason", async () => {
  await mount([item()]);
  await click(container.querySelector(".enh-row"));
  await wait(10);
  expect([...container.querySelectorAll(".enh-table tbody tr")].map((r) => r.textContent)).toEqual(["R-1AEnrolled", "R-2ANot enrolledSection A is full"]);
  await click(container.querySelector(".enh-row")); await click(container.querySelector(".enh-row")); await wait(10);
  expect(axios.get.mock.calls.filter(([u]) => u.includes("/bulk-enroll/j1")).length).toBe(1);
});

test("says so when nothing has been uploaded, and shows the server's reason when the history cannot load", async () => {
  await mount([]);
  expect(container.textContent).toContain("Nothing has been uploaded yet");
  act(() => root.unmount()); root = createRoot(container);
  axios.get.mockRejectedValue({ response: { status: 500, data: {} } });
  await act(async () => { root.render(<EnrollmentHistory apiUrl="http://x" headers={() => ({})} refreshKey={0} />); });
  await wait(10);
  expect(container.querySelector(".enh-error").textContent).toContain("Something went wrong on our side");
});

test("a running upload shows how far it has got", () => {
  expect(resultText(item({ status: "running", processed: 12, total: 37 }))).toBe("12 of 37 done so far");
});

test("the totals, the filters and the search narrow the list to what needs looking at", async () => {
  await mount([item({ jobId: "a", fileName: "ok.xlsx", failed: 0, registered: 10 }), item({ jobId: "b", fileName: "bad.xlsx", failed: 4, registered: 1 }), item({ jobId: "c", fileName: "live.xlsx", status: "running", processed: 5, total: 20, registered: 0, failed: 0 })]);
  const stat = (label) => [...container.querySelectorAll(".enh-stats > div")].find((d) => d.textContent.startsWith(label)).querySelector("strong").textContent;
  expect([stat("Recent uploads"), stat("Students enrolled"), stat("Need attention"), stat("Running now")]).toEqual(["3", "11", "1", "1"]);
  expect(container.querySelector(".enh-bar")).not.toBeNull();                         // the running upload shows how far it has got
  const names = () => [...container.querySelectorAll(".enh-main small")].map((s) => s.textContent.split(" · ").pop());
  await click([...container.querySelectorAll(".enh-filters button")].find((b) => b.textContent === "Need attention"));
  expect(names()).toEqual(["bad.xlsx"]);
  await click([...container.querySelectorAll(".enh-filters button")].find((b) => b.textContent === "All"));
  await act(async () => {
    const input = container.querySelector("#enh-search");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "live");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(names()).toEqual(["live.xlsx"]);
});

const mountAs = async (items, isSuperAdmin) => {
  sessionStorage.setItem("adminToken", "t");
  axios.get.mockImplementation((url) => Promise.resolve({ data:
    url.endsWith("/api/users/me") ? { isSuperAdmin }
      : url.endsWith("/bulk-enroll") ? { items }
      : url.endsWith("/undo") ? { removable: 35, locked: 1, attendanceRecords: 12, marks: 0 }
      : { rows: [{ rollNumber: "R-1", section: "A", status: "registered" }] } }));
  axios.post.mockResolvedValue({ data: { removed: 35, message: "35 enrollments from this upload were removed" } });
  await act(async () => { root.render(<EnrollmentHistory apiUrl="http://x" headers={() => ({})} refreshKey={0} />); });
  await wait(10);
  await click(container.querySelector(".enh-row"));
  await wait(10);
  sessionStorage.clear();
};
const buttonText = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));

test("only the super admin can undo an upload, and it asks for a reason first", async () => {
  await mountAs([item()], true);
  await click(buttonText("Undo this upload"));
  await wait(10);
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toMatch(/removes the 35 students this upload enrolled in CS101 Programming/);
  expect(dialog.textContent).toMatch(/1 student with a locked result will stay enrolled/);
  const confirm = buttonText("Remove 35 enrollments");
  expect(confirm.disabled).toBe(true);
  const reason = dialog.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(reason, "Wrong section list");
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(buttonText("Remove 35 enrollments"));
  await wait(10);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/enrollment/uploads/j1/undo"), { reason: "Wrong section list" }, expect.anything());
});

test("an ordinary admin doesn't see Undo, and an undone upload says so and stops counting", async () => {
  await mountAs([item(), item({ jobId: "j2", undoneAt: "2026-10-02T08:00:00Z", undoneCount: 35 })], false);
  expect(buttonText("Undo this upload")).toBeUndefined();
  expect(container.textContent).toMatch(/Undone/);
  expect(container.textContent).toMatch(/35 enrolled, then removed/);
  expect(container.querySelector(".enh-stats").textContent).toMatch(/Students enrolled35/);
});
