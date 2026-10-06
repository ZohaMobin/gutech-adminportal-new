import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { PasswordCell, PasswordsBar, REVEAL_MS } from "./PasswordParts";
import * as api from "./passwordApi";

jest.mock("./passwordApi", () => ({
  ...jest.requireActual("./passwordApi"),
  viewPassword: jest.fn(),
  issuePassword: jest.fn(),
  copyText: jest.fn(),
}));
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error", WARNING: "warning" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const render = async (ui) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(ui); });
};
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const byLabel = (label) => document.querySelector(`[aria-label="${label}"]`);
const buttonText = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); jest.useRealTimers(); });

const sara = { _id: "s1", name: "Sara Ali", rollNumber: "2024-CS-001", passwordIssuedAt: "2026-10-01" };

test("a password is hidden until asked for, shown in two groups, then hides itself", async () => {
  jest.useFakeTimers();
  api.viewPassword.mockResolvedValue({ password: "WQ2S2HCA" });
  await render(<PasswordCell student={sara} onIssued={jest.fn()} />);
  expect(container.textContent).not.toMatch(/WQ2S/);
  await click(byLabel("Show password"));
  expect(api.viewPassword).toHaveBeenCalledWith("s1");
  expect(container.querySelector("code").textContent).toBe("WQ2S 2HCA");
  await act(async () => { jest.advanceTimersByTime(REVEAL_MS); });
  expect(container.querySelector("code")).toBeNull();
  expect(byLabel("Show password")).not.toBeNull();
});

test("copy fetches the password and copies it without the gap", async () => {
  api.viewPassword.mockResolvedValue({ password: "WQ2S2HCA" });
  api.copyText.mockResolvedValue(true);
  await render(<PasswordCell student={sara} onIssued={jest.fn()} />);
  await click(byLabel("Copy password"));
  expect(api.copyText).toHaveBeenCalledWith("WQ2S2HCA");
});

test("a new password asks first, then shows the new one and marks the row", async () => {
  api.issuePassword.mockResolvedValue({ password: "NEWP4SS9", issuedAt: "2026-10-06" });
  const onIssued = jest.fn();
  await render(<PasswordCell student={sara} onIssued={onIssued} />);
  await click(byLabel("Generate a new password"));
  const dialog = document.querySelector('[role="dialog"]');
  expect(dialog.textContent).toMatch(/current one stops working/);
  expect(container.contains(dialog)).toBe(false); // portalled out of the table cell
  expect(api.issuePassword).not.toHaveBeenCalled();
  await click(buttonText("Generate new password"));
  expect(api.issuePassword).toHaveBeenCalledWith("s1");
  expect(onIssued).toHaveBeenCalledWith("s1", "2026-10-06");
  expect(container.querySelector("code").textContent).toBe("NEWP 4SS9");
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

test("a student without a password says so and gets one in one click", async () => {
  api.issuePassword.mockResolvedValue({ password: "FIRST234", issuedAt: "2026-10-06" });
  const onIssued = jest.fn();
  await render(<PasswordCell student={{ ...sara, passwordIssuedAt: null }} onIssued={onIssued} />);
  expect(container.textContent).toMatch(/No password/);
  await click(buttonText("Generate"));
  expect(api.issuePassword).toHaveBeenCalledWith("s1");
  expect(onIssued).toHaveBeenCalled();
});

test("the summary bar counts students without a password and offers the right actions", async () => {
  const onGenerate = jest.fn();
  await render(<PasswordsBar total={10} missing={3} scope="the directory" onGenerate={onGenerate} onDownload={jest.fn()} />);
  expect(container.textContent).toMatch(/3 students don't have a password yet/);
  expect(container.textContent).toMatch(/7 of 10 in the directory have one/);
  expect(container.querySelector('[role="progressbar"]').getAttribute("aria-valuenow")).toBe("70");
  await click(buttonText("Generate for 3"));
  expect(onGenerate).toHaveBeenCalled();
});

test("when everyone has a password the bar says so and only offers the download", async () => {
  await render(<PasswordsBar total={4} missing={0} scope="BSCS" onGenerate={jest.fn()} onDownload={jest.fn()} />);
  expect(container.textContent).toMatch(/Every student here has a password/);
  expect(buttonText("Generate for all")).toBeUndefined();
  expect(buttonText("Download CSV")).toBeDefined();
});

test("helpers: grouped display and a tidy file name", () => {
  expect(api.groupPassword("ABCD2345")).toBe("ABCD 2345");
  expect(api.csvFileName(["BS Computer Science", "Semester 3"])).toMatch(/^student-passwords-bs-computer-science-semester-3-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(api.csvFileName([])).toMatch(/^student-passwords-\d{4}-\d{2}-\d{2}\.csv$/);
});
