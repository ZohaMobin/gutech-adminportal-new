import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import ManageAccessPage from "./ManageAccessPage";

jest.mock("axios");
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error" } }));
let mockTab = null;
jest.mock("react-router-dom", () => {
  const React = require("react");
  return { useSearchParams: () => { const [tab, setTab] = React.useState(mockTab); return [new URLSearchParams(tab ? { tab } : {}), (next) => setTab(next.tab)]; }, useNavigate: () => jest.fn() };
}, { virtual: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const topTabs = () => [...container.querySelectorAll('[aria-label="Manage access"] [role="tab"]')];
const tab = (label) => topTabs().find((b) => b.textContent.startsWith(label));

const mount = async ({ superAdmin = true, start = null } = {}) => {
  mockTab = start;
  sessionStorage.setItem("adminToken", "t");
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/api/users/me")) return { data: { userId: "u1", isSuperAdmin: superAdmin } };
    if (url.endsWith("/api/users/teachers")) return { data: [{ _id: "t1", name: "Ayesha Khan", email: "a@gu.edu", employeeId: "E-1", department: "CS", status: "active", sections: 2 }] };
    if (url.endsWith("/api/users/admins")) return { data: [{ _id: "a1", name: "Boss", email: "boss@gu.edu", status: "active", isSuperAdmin: true }] };
    if (url.includes("/api/account-approvals")) return { data: [{ _id: "p1", name: "Sara Ahmed", email: "s@gu.edu", role: "teacher", createdAt: "2026-09-28" }, { _id: "p2", name: "Omar", email: "o@gu.edu", role: "teacher", createdAt: "2026-09-29" }] };
    return { data: [] };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<ManageAccessPage />); });
  await wait(30);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; sessionStorage.clear(); jest.clearAllMocks(); });

test("an ordinary administrator sees an explanation, and none of the three lists is requested", async () => {
  await mount({ superAdmin: false });
  expect(container.textContent).toMatch(/Only the super admin can manage who can sign in/);
  expect(container.querySelector('[role="tab"]')).toBeNull();
  const asked = axios.get.mock.calls.map(([url]) => url);
  expect(asked.some((u) => u.endsWith("/api/users/teachers") || u.endsWith("/api/users/admins") || u.includes("/api/account-approvals"))).toBe(false);
});

test("the super admin lands on Teachers and sees the three tabs, with the waiting requests counted on the last", async () => {
  await mount();
  expect(topTabs().map((b) => b.textContent.replace(/\s+/g, " ").trim())).toEqual(["Teachers", "Administrators", "Sign-up requests2"]);
  expect(tab("Teachers").getAttribute("aria-selected")).toBe("true");
  expect(container.textContent).toContain("Ayesha Khan");
});

test("switching tabs shows that list, and a link can open straight onto one tab", async () => {
  await mount();
  await click(tab("Administrators"));
  await wait(20);
  expect(container.textContent).toContain("Boss");
  expect(container.textContent).not.toContain("Ayesha Khan");
  await click(tab("Sign-up requests"));
  await wait(20);
  expect(container.textContent).toContain("Sara Ahmed");
  act(() => root.unmount()); container.remove(); document.body.innerHTML = "";
  await mount({ start: "requests" });
  expect(tab("Sign-up requests").getAttribute("aria-selected")).toBe("true");
  expect(container.textContent).toContain("Sara Ahmed");
});
