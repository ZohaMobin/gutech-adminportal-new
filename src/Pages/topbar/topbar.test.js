import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import Topbar from "./topbar";

jest.mock("axios");
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../Components/AuthContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const mount = async (me) => {
  sessionStorage.setItem("adminToken", "t");
  sessionStorage.setItem("adminUser", JSON.stringify({ name: "Ayesha Khan", email: "a@x.io", isSuperAdmin: me.isSuperAdmin }));
  axios.get.mockImplementation(async (url) => ({ data: url.includes("/api/users/me") ? me : [{ _id: "u1" }, { _id: "u2" }] }));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Topbar toggleSidebar={() => {}} isSidebarOpen />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); sessionStorage.clear(); jest.clearAllMocks(); });

test("the super admin sees the approvals bell with the waiting count", async () => {
  await mount({ isSuperAdmin: true });
  expect(container.querySelector(".notification-icon")).not.toBeNull();
  expect(container.querySelector(".notification-badge").textContent).toBe("2");
});

test("the super admin's menu has one Manage access entry with the waiting count, not separate approvals and administrators entries", async () => {
  await mount({ isSuperAdmin: true });
  await act(async () => { container.querySelector(".user-avatar").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  const items = [...container.querySelectorAll(".profile-menu-item")].map((b) => b.textContent.trim());
  expect(items).toEqual(["Manage access2", "Change password", "Logout"]);
});

test("an ordinary administrator sees no bell, no Manage access menu item, and the count is never requested", async () => {
  await mount({ isSuperAdmin: false });
  expect(container.querySelector(".notification-icon")).toBeNull();
  await act(async () => { container.querySelector(".user-avatar").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(container.textContent).toMatch(/Change password/);
  expect(container.textContent).not.toMatch(/Manage access/);
  expect(axios.get.mock.calls.some(([url]) => url.includes("/api/account-approvals"))).toBe(false);
});
