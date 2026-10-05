import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import AccountApprovalsPanel from "./AccountApprovalsPage";
import { showToast } from "../../Components/Toast/Toast";

jest.mock("axios");
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WAITING = [
  { _id: "p1", name: "Sara Ahmed", email: "sara@gu.edu", employeeId: "E-11", createdAt: "2026-09-28T09:00:00Z", applicationCount: 1 },
  { _id: "p2", name: "Omar Farooq", email: "omar@gu.edu", employeeId: "E-12", createdAt: "2026-09-29T09:00:00Z", applicationCount: 3 },
];
const HISTORY = {
  items: [
    { _id: "h1", decision: "rejected", applicantName: "Hina Raza", applicantEmail: "hina@gu.edu", employeeId: "E-7", reviewerName: "Super Admin", reason: "Not on the staff list", createdAt: "2026-10-01T10:30:00Z", attempt: 2 },
    { _id: "h2", decision: "approved", applicantName: "Bilal Shah", applicantEmail: "bilal@gu.edu", employeeId: "E-3", reviewerName: "Super Admin", createdAt: "2026-09-30T10:30:00Z", attempt: 1 },
    { _id: "h3", decision: "rejected", applicantName: "No Reason", applicantEmail: "nr@gu.edu", reviewerName: "Super Admin", createdAt: "2026-09-29T10:30:00Z" },
  ],
  total: 3, page: 1, pages: 1, counts: { approved: 1, rejected: 2 },
};

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const button = (label) => [...container.querySelectorAll("button")].find((b) => b.textContent.replace(/\s+/g, " ").trim().startsWith(label));
// The dialog is the last thing in the page, so its button is the last one with that label.
const bodyButton = (label) => [...document.body.querySelectorAll("button")].filter((b) => b.textContent.trim() === label).pop();

const mount = async () => {
  sessionStorage.setItem("adminToken", "t");
  axios.get.mockImplementation(async (url) => (url.includes("/history") ? { data: HISTORY } : { data: WAITING }));
  axios.post.mockResolvedValue({ data: {} });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<AccountApprovalsPanel />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; sessionStorage.clear(); jest.clearAllMocks(); });

test("the waiting tab lists the requests, with the count and a badge for repeat applicants, and does not fetch the history yet", async () => {
  await mount();
  expect(container.textContent).toMatch(/Sara Ahmed/);
  expect(container.textContent).toMatch(/Omar Farooq/);
  expect(container.textContent).toMatch(/Attempt 3/);
  expect(button("Waiting").textContent).toMatch(/2/);
  expect(axios.get.mock.calls.some(([url]) => url.includes("/history"))).toBe(false);
});

test("rejecting says the request is removed and the email can be used again, then posts the reason and takes the row off", async () => {
  await mount();
  await click(container.querySelector('[aria-label="Reject Sara Ahmed"]'));
  expect(document.body.textContent).toMatch(/Their request is removed, so sara@gu.edu can be used again/);
  const reason = document.body.querySelector("textarea");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(reason, "Not on the staff list");
    reason.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await click(bodyButton("Reject request"));
  await wait(10);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/account-approvals/p1/reject"), { reason: "Not on the staff list" }, expect.anything());
  expect(container.textContent).not.toMatch(/Sara Ahmed/);
  expect(button("Waiting").textContent).toMatch(/1/);
  expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/rejected and removed/), "success");
});

test("approving posts no reason and tells the admin they can sign in", async () => {
  await mount();
  await click(container.querySelector('[aria-label="Approve Omar Farooq"]'));
  expect(document.body.querySelector("textarea")).toBeNull();
  await click(bodyButton("Approve"));
  await wait(10);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/account-approvals/p2/approve"), {}, expect.anything());
  expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/can sign in/), "success");
});

test("a failed decision keeps the dialog open with the reason it failed", async () => {
  await mount();
  axios.post.mockRejectedValueOnce({ response: { data: { message: "No matching staff account found" } } });
  await click(container.querySelector('[aria-label="Reject Sara Ahmed"]'));
  await click(bodyButton("Reject request"));
  await wait(10);
  expect(document.body.textContent).toMatch(/No matching staff account found/);
});

test("the history shows who was approved or rejected, when, by whom and why, and counts each", async () => {
  await mount();
  await click(button("History"));
  await wait(20);
  const text = container.textContent;
  expect(text).toMatch(/Hina Raza/);
  expect(text).toMatch(/Rejected/);
  expect(text).toMatch(/Not on the staff list/);
  expect(text).toMatch(/Super Admin/);
  expect(text).toMatch(/Bilal Shah/);
  expect(text).toMatch(/Approved/);
  expect(text).toMatch(/Attempt 2/);
  expect(text).toMatch(/No reason given/);
  expect(text).toMatch(/Showing 3 of 3/);
  const chips = [...container.querySelectorAll('[aria-label="Show"] button')].map((b) => b.textContent.replace(/\s+/g, " ").trim());
  expect(chips).toEqual(["All 3", "Approved 1", "Rejected 2"]);
});

test("choosing Rejected asks the server for only rejections", async () => {
  await mount();
  await click(button("History"));
  await wait(20);
  axios.get.mockClear();
  await click([...container.querySelectorAll('[aria-label="Show"] button')].find((b) => b.textContent.startsWith("Rejected")));
  await wait(20);
  const [, options] = axios.get.mock.calls.find(([url]) => url.includes("/history"));
  expect(options.params.decision).toBe("rejected");
});
