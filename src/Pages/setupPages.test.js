import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import DepartmentsPage from "./Departments/DepartmentsPage";
import AcademicYearsPage from "./AcademicYears/AcademicYearsPage";
import AccountApprovalsPage from "./AccountApprovals/AccountApprovalsPage";

jest.mock("axios");
jest.mock("../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { showToast } = require("../Components/Toast/Toast");
const depts = [{ _id: "d1", code: "CS", name: "Computer Science", description: "", isActive: true }, { _id: "d2", code: "EE", name: "Electrical", description: "", isActive: false }];
const years = [
  { _id: "y1", semesterType: "Fall", year: 2026, startDate: "2026-09-01", endDate: "2026-12-20", status: "active", isCurrent: true, isActive: true },
  { _id: "y2", semesterType: "Spring", year: 2026, startDate: "2026-02-01", endDate: "2026-06-20", status: "closed", isCurrent: false, isActive: true },
];
const accounts = [{ _id: "u1", name: "Ayesha", email: "a@x.io", role: "teacher", createdAt: "2026-09-20" }];

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const mount = async (Page, data) => {
  axios.get.mockResolvedValue({ data });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Page />); });
  await wait(20);
};
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const byLabel = (label) => container.querySelector(`[aria-label="${label}"]`);
const dialog = () => document.querySelector('[role="dialog"]');
const dialogButton = (text) => [...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === text);

beforeEach(() => { window.confirm = jest.fn(); window.prompt = jest.fn(); });
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); });

describe("Departments", () => {
  test("Deactivate asks in a dialog (never window.confirm), then deactivates, toasts and refreshes without blanking the table", async () => {
    await mount(DepartmentsPage, depts);
    axios.delete.mockResolvedValue({ data: {} });
    await click(byLabel("Deactivate Computer Science"));
    expect(dialog().textContent).toMatch(/Deactivate Computer Science \(CS\)\?/);
    expect(axios.delete).not.toHaveBeenCalled();

    let release;
    axios.get.mockImplementation(() => new Promise((r) => { release = () => r({ data: depts }); }));
    await click(dialogButton("Deactivate"));
    expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/api/departments/d1"), expect.anything());
    expect(showToast).toHaveBeenCalledWith("Computer Science deactivated", "success");
    expect(dialog()).toBeNull();
    // the reload is in flight: the rows are still on screen, dimmed, not replaced by placeholders
    expect(container.querySelectorAll("tbody tr").length).toBe(2);
    expect(container.querySelector(".ld-refresh.is-active")).not.toBeNull();
    await act(async () => release());
    expect(container.querySelector(".ld-refresh.is-active")).toBeNull();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  test("only active rows offer Deactivate", async () => {
    await mount(DepartmentsPage, depts);
    expect(byLabel("Deactivate Computer Science")).not.toBeNull();
    expect(byLabel("Deactivate Electrical")).toBeNull();
  });

  test("a failed save shows the reason inside the dialog, where the user is looking", async () => {
    await mount(DepartmentsPage, depts);
    axios.put.mockRejectedValue({ response: { data: { error: "A department with this name already exists" } } });
    await click(byLabel("Edit Computer Science"));
    await act(async () => { dialog().querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(dialog().querySelector(".am-error").textContent).toBe("A department with this name already exists");
    expect(showToast).not.toHaveBeenCalled();
  });
});

describe("Academic Years", () => {
  test("Set current confirms in a dialog that names the term", async () => {
    await mount(AcademicYearsPage, years);
    axios.put.mockResolvedValue({ data: {} });
    await click(byLabel("Make Spring 2026 the current academic year"));
    expect(dialog().textContent).toMatch(/Make Spring 2026 the current academic year\?/);
    await click(dialogButton("Set as current"));
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining("/api/academic-years/y2/set-current"), {}, expect.anything());
    expect(showToast).toHaveBeenCalledWith("Spring 2026 is now the current academic year", "success");
  });

  test("an end date before the start date is explained inside the dialog", async () => {
    await mount(AcademicYearsPage, years);
    await click(byLabel("Edit Fall 2026"));
    const set = (name, value) => { const input = dialog().querySelector(`[name="${name}"]`); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; setter.call(input, value); return act(async () => input.dispatchEvent(new Event("input", { bubbles: true }))); };
    await set("endDate", "2026-08-01");
    await act(async () => { dialog().querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(dialog().querySelector(".am-error").textContent).toBe("End date must be after start date");
    expect(axios.put).not.toHaveBeenCalled();
  });
});

describe("Account Approvals", () => {
  test("Reject takes an optional reason in a dialog and sends it", async () => {
    await mount(AccountApprovalsPage, accounts);
    axios.post.mockResolvedValue({ data: {} });
    await click(byLabel("Reject Ayesha"));
    const box = dialog().querySelector("textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(box, "Not a staff member");
    await act(async () => box.dispatchEvent(new Event("input", { bubbles: true })));
    await click(dialogButton("Reject"));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/u1/reject"), { reason: "Not a staff member" }, expect.anything());
    expect(showToast).toHaveBeenCalledWith("Ayesha rejected", "success");
    expect(container.querySelector("tbody")).toBeNull();
    expect(window.prompt).not.toHaveBeenCalled();
  });

  test("Approve asks first and sends no reason", async () => {
    await mount(AccountApprovalsPage, accounts);
    axios.post.mockResolvedValue({ data: {} });
    await click(byLabel("Approve Ayesha"));
    expect(dialog().textContent).toMatch(/Approve Ayesha as teacher\?/);
    expect(dialog().querySelector("textarea")).toBeNull();
    await click(dialogButton("Approve"));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/u1/approve"), {}, expect.anything());
  });
});
