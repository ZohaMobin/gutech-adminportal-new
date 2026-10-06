import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import StudentPasswordsPage from "./StudentPasswordsPage";
import * as api from "./passwordApi";

jest.mock("axios");
jest.mock("./passwordApi", () => ({ ...jest.requireActual("./passwordApi"), issuePasswords: jest.fn(), downloadPasswordsCsv: jest.fn() }));
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error", WARNING: "warning" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const students = [
  { _id: "s1", rollNumber: "2024-CS-001", name: "Sara Ali", email: "sara@gu.edu", program: { code: "BSCS" }, currentSemester: 3, passwordIssuedAt: "2026-10-01" },
  { _id: "s2", rollNumber: "2024-CS-002", name: "Omar Farooq", email: "omar@gu.edu", program: { code: "BSCS" }, currentSemester: 3, passwordIssuedAt: null },
  { _id: "s3", rollNumber: "2024-CS-003", name: "Hina Shah", email: "hina@gu.edu", program: { code: "BSCS" }, currentSemester: 3, passwordIssuedAt: null },
];

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const buttonText = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const tab = (name) => [...container.querySelectorAll('[role="tab"]')].find((t) => t.textContent.startsWith(name));
const rowNames = () => [...container.querySelectorAll(".spp-name")].map((n) => n.textContent);

const mount = async () => {
  axios.get.mockImplementation(async (url) => (url.endsWith("/api/students") ? { data: { total: students.length, students } } : { data: [] }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<StudentPasswordsPage />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); });

test("it lists students with their password status and counts the ones without one", async () => {
  await mount();
  expect(container.querySelector(".page-head-title").textContent).toBe("Student Passwords");
  expect(rowNames()).toEqual(["Sara Ali", "Omar Farooq", "Hina Shah"]);
  expect(container.textContent).toMatch(/2 students don't have a password yet/);
  expect(tab("Needs a password").textContent).toMatch(/2/);
});

test("the tabs narrow the list without asking the server again", async () => {
  await mount();
  const calls = axios.get.mock.calls.length;
  await click(tab("Needs a password"));
  expect(rowNames()).toEqual(["Omar Farooq", "Hina Shah"]);
  await click(tab("All students"));
  expect(rowNames()).toEqual(["Sara Ali", "Omar Farooq", "Hina Shah"]);
  expect(axios.get.mock.calls.length).toBe(calls);
});

test("once everyone has a password there are no tabs and nothing to generate", async () => {
  const saved = students.map((s) => ({ ...s }));
  students.forEach((s) => { s.passwordIssuedAt = "2026-10-06"; });
  await mount();
  expect(container.querySelector('[role="tablist"]')).toBeNull();
  expect(container.textContent).toMatch(/Every student here has a password/);
  expect(buttonText("Generate for all")).toBeUndefined();
  saved.forEach((s, i) => Object.assign(students[i], s));
});

test("search asks the server for matching students", async () => {
  await mount();
  const input = container.querySelector('input[type="search"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "Omar");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(350);
  expect(axios.get).toHaveBeenLastCalledWith(expect.stringContaining("/api/students"), expect.objectContaining({ params: { search: "Omar" } }));
});

test("Generate asks once, issues the missing passwords, then downloads one CSV of the whole list", async () => {
  await mount();
  api.issuePasswords.mockResolvedValue({ issued: 2, skipped: 1 });
  api.downloadPasswordsCsv.mockResolvedValue();
  await click(buttonText("Generate for 2"));
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/2 students in the directory don't have a password yet.*a CSV of all 3 students/);
  await click(buttonText("Generate and download"));
  const selection = { filters: { department: "", program: "", semester: "", search: "" } };
  expect(api.issuePasswords).toHaveBeenCalledWith(selection, { onlyMissing: true });
  expect(api.downloadPasswordsCsv).toHaveBeenCalledWith(selection, expect.stringMatching(/^student-passwords-\d{4}-\d{2}-\d{2}\.csv$/));
  const done = document.querySelector('[role="dialog"]').textContent;
  expect(done).toMatch(/2 students now have a password/);
  expect(done).toMatch(/Downloaded · all 3 students in the directory/);
});

test("if the CSV fails after issuing, the passwords are still reported and the download can be retried", async () => {
  await mount();
  api.issuePasswords.mockResolvedValue({ issued: 2, skipped: 1 });
  api.downloadPasswordsCsv.mockRejectedValueOnce({ response: { data: { message: "Network hiccup" } } }).mockResolvedValueOnce();
  await click(buttonText("Generate for 2"));
  await click(buttonText("Generate and download"));
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/Network hiccup/);
  await click([...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.includes("Download CSV")));
  expect(api.downloadPasswordsCsv).toHaveBeenCalledTimes(2);
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/Downloaded/);
});
