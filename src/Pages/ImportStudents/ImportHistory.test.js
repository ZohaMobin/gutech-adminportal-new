global.IS_REACT_ACT_ENVIRONMENT = true;
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react-dom/test-utils";
import axios from "axios";
import ImportHistory, { outcomeOf, resultText } from "./ImportHistory";
import { downloadCsv } from "../../utils/csv";

jest.mock("axios");
jest.mock("../../utils/csv", () => ({ downloadCsv: jest.fn() }));

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });

const item = (over = {}) => ({ importId: "i1", createdAt: "2026-09-30T10:00:00Z", by: { name: "Mehwish Khan" }, fileName: "fall26-intake.xlsx", rowsInFile: 40, created: 38, failed: 2, ...over });
const rows = [
  { rollNumber: "R-1", name: "Ali", email: "ali@gu.edu", status: "created", message: null },
  { rollNumber: "R-2", name: "Sara", email: "sara@gu.edu", status: "failed", message: "Roll number R-2 already exists" },
  { rollNumber: "R-3", name: "Omar", email: "omar@gu.edu", status: "failed", message: "Invalid department: Physics (not found by ID or name)" },
];
const mount = async (items) => {
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith("/bulk/history") ? { items } : { rows } }));
  await act(async () => { root.render(<ImportHistory apiUrl="http://x" headers={() => ({})} refreshKey={0} />); });
  await wait(10);
};

beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); jest.clearAllMocks(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("each import shows the file, who ran it, and how it came out", async () => {
  await mount([item()]);
  const row = container.querySelector(".enh-row").textContent;
  expect(row).toContain("fall26-intake.xlsx");
  expect(row).toContain("40 rows in the file");
  expect(row).toContain("Mehwish Khan");
  expect(row).toContain("Partly added");
  expect(row).toContain("38 added · 2 not added");
});

test("the outcome is plain: all added, partly added, or none added", () => {
  expect(outcomeOf({ created: 5, failed: 0 })).toEqual({ label: "All added", tone: "ok" });
  expect(outcomeOf({ created: 0, failed: 5 })).toEqual({ label: "None added", tone: "bad" });
  expect(outcomeOf({ created: 3, failed: 2 }).label).toBe("Partly added");
  expect(resultText({ created: 5, failed: 0 })).toBe("5 added");
});

test("opening an import with problems shows only the rows that were not added, with the reasons; one switch shows everything", async () => {
  await mount([item()]);
  await click(container.querySelector(".enh-row"));
  await wait(10);
  expect(axios.get).toHaveBeenCalledWith("http://x/api/students/bulk/history/i1", expect.anything());
  let body = container.querySelector(".imh-table tbody").textContent;
  expect(body).toContain("Roll number R-2 already exists");
  expect(body).toContain("Invalid department: Physics");
  expect(body).not.toContain("Ali");
  await click(container.querySelector(".imh-check input"));
  expect(container.querySelector(".imh-table tbody").textContent).toContain("Ali");
});

test("the not-added rows can be downloaded as a CSV named after the file, with the reasons", async () => {
  await mount([item()]);
  await click(container.querySelector(".enh-row"));
  await wait(10);
  await click([...container.querySelectorAll("button")].find((b) => /Download not-added rows/.test(b.textContent)));
  expect(downloadCsv).toHaveBeenCalledWith("fall26-intake-not-added.csv", [
    ["Roll number", "Name", "Email", "Reason"],
    ["R-2", "Sara", "sara@gu.edu", "Roll number R-2 already exists"],
    ["R-3", "Omar", "omar@gu.edu", "Invalid department: Physics (not found by ID or name)"],
  ]);
});

test("a clean import has no problem switch or download", async () => {
  await mount([item({ created: 40, failed: 0 })]);
  await click(container.querySelector(".enh-row"));
  await wait(10);
  expect(container.querySelector(".imh-check")).toBeNull();
  expect(container.textContent).toContain("All added");
});

test("filters and search narrow the list; nothing imported yet says so", async () => {
  await mount([item(), item({ importId: "i2", fileName: "late.xlsx", created: 10, failed: 0, by: { name: "Zoha" } })]);
  expect(container.querySelectorAll(".enh-item").length).toBe(2);
  await click([...container.querySelectorAll(".enh-filters button")].find((b) => b.textContent === "Had problems"));
  expect(container.querySelectorAll(".enh-item").length).toBe(1);
  await act(async () => { root.unmount(); });
  root = createRoot(container);
  await mount([]);
  expect(container.textContent).toContain("Nothing has been imported yet");
});
