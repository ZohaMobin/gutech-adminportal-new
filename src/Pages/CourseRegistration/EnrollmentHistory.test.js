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
