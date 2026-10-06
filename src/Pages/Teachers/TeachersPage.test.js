import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import TeachersPanel from "./TeachersPage";
import { visibleTeachers, countByStatus, sectionsText } from "./teacherListUtils";

jest.mock("axios");
jest.mock("../../Components/Toast/Toast", () => ({ showToast: jest.fn(), TOAST_TYPES: { SUCCESS: "success", ERROR: "error" } }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { showToast } = require("../../Components/Toast/Toast");
const teachers = [
  { _id: "t1", name: "Ayesha Khan", email: "ayesha@gu.edu", employeeId: "E-1", department: "Computer Science", status: "active", sections: 3 },
  { _id: "t2", name: "Bilal Raza", email: "bilal@gu.edu", employeeId: "E-2", department: null, status: "active", sections: 0 },
  { _id: "t3", name: "Hina Shah", email: "hina@gu.edu", employeeId: "E-3", department: "Physics", status: "deactivated", sections: 1, deactivatedAt: "2026-09-20", deactivatedByName: "Zoha Mobin" },
];

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const dialog = () => document.querySelector('[role="dialog"]');
const dialogButton = (text) => [...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const rowOf = (name) => [...container.querySelectorAll(".am-row")].find((r) => r.textContent.includes(name));
const buttonIn = (el, text) => [...el.querySelectorAll("button")].find((b) => b.textContent.trim() === text);

const mount = async ({ deletable = { canDelete: true, summary: "" } } = {}) => {
  sessionStorage.setItem("adminToken", "t");
  axios.get.mockImplementation(async (url) => {
    if (url.endsWith("/deletable")) return { data: deletable };
    return { data: teachers };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<TeachersPanel />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; sessionStorage.clear(); jest.clearAllMocks(); });

test("it lists active teachers with their sections, and the revoked ones under their own tab", async () => {
  await mount();
  expect(rowOf("Ayesha Khan").textContent).toContain("3 sections");
  expect(rowOf("Bilal Raza").textContent).toContain("No sections");
  expect(container.textContent).not.toContain("Hina Shah");
  await click([...container.querySelectorAll('[role="tab"]')].find((b) => /Access revoked/.test(b.textContent)));
  expect(rowOf("Hina Shah").textContent).toContain("by Zoha Mobin");
  expect(rowOf("Hina Shah").textContent).toContain("still on 1 section this term");
});

test("revoking asks first, warns about assigned sections, then revokes and refreshes", async () => {
  await mount();
  axios.post.mockResolvedValue({ data: {} });
  await click(buttonIn(rowOf("Ayesha Khan"), "Revoke access…"));
  expect(dialog().textContent).toMatch(/signed out everywhere and will not be able to log in/);
  expect(dialog().textContent).toMatch(/still assigned to 3 sections this term/);
  expect(axios.post).not.toHaveBeenCalled();
  await click(dialogButton("Revoke access"));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/users/teachers/t1/deactivate"), {}, expect.anything());
  expect(showToast).toHaveBeenCalledWith("Ayesha Khan's access was revoked", "success");
});

test("a revoked teacher can be restored", async () => {
  await mount();
  axios.post.mockResolvedValue({ data: {} });
  await click([...container.querySelectorAll('[role="tab"]')].find((b) => /Access revoked/.test(b.textContent)));
  await click(buttonIn(rowOf("Hina Shah"), "Restore access"));
  await click(dialogButton("Restore access"));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/users/teachers/t3/reactivate"), {}, expect.anything());
});

test("deleting a teacher with no records asks for a final confirmation and deletes", async () => {
  await mount({ deletable: { canDelete: true, summary: "" } });
  axios.delete.mockResolvedValue({ data: {} });
  await click(container.querySelector('[aria-label="More actions for Bilal Raza"]'));
  await click(buttonIn(container, "Delete…"));
  await wait(10);
  expect(dialog().textContent).toMatch(/Delete Bilal Raza permanently/);
  expect(axios.delete).not.toHaveBeenCalled();
  await click(dialogButton("Delete permanently"));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining("/api/users/teachers/t2"), expect.anything());
});

test("a teacher with records cannot be deleted: the dialog says what they have and offers to revoke instead", async () => {
  await mount({ deletable: { canDelete: false, summary: "3 sections, 40 attendance records" } });
  await click(container.querySelector('[aria-label="More actions for Ayesha Khan"]'));
  await click(buttonIn(container, "Delete…"));
  await wait(10);
  expect(dialog().textContent).toMatch(/3 sections, 40 attendance records/);
  expect(dialogButton("Delete permanently")).toBeUndefined();
  await click(dialogButton("Revoke access instead"));
  expect(dialog().textContent).toMatch(/signed out everywhere/);
  expect(axios.delete).not.toHaveBeenCalled();
});

test("helpers: filter by tab and search, count, and say how many sections", () => {
  expect(countByStatus(teachers)).toEqual({ active: 2, deactivated: 1 });
  expect(visibleTeachers(teachers, { status: "active", query: "physics" })).toEqual([]);
  expect(visibleTeachers(teachers, { status: "deactivated", query: "physics" }).map((t) => t.name)).toEqual(["Hina Shah"]);
  expect(sectionsText(1)).toBe("1 section");
  expect(sectionsText(0)).toBe("No sections");
});

test("Edit opens the teacher's details, saves only what changed, and warns that a new email signs them out", async () => {
  await mount();
  axios.patch.mockResolvedValue({ data: {} });
  await click(buttonIn(rowOf("Ayesha Khan"), "Edit"));
  expect(dialogButton("Save changes").disabled).toBe(true);
  const set = (name, value) => act(async () => {
    const input = dialog().querySelector(`[name="${name}"]`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await set("employeeId", "E-99");
  expect(dialog().textContent).not.toMatch(/signed out everywhere/);
  await set("email", "ayesha.k@gu.edu");
  expect(dialog().textContent).toMatch(/signed out everywhere and must sign in again with the new email/);
  await click(dialogButton("Save changes"));
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/api/users/teachers/t1"), { email: "ayesha.k@gu.edu", employeeId: "E-99" }, expect.anything());
  expect(showToast).toHaveBeenCalledWith("Ayesha Khan was updated", "success");
});

test("an invalid email keeps Save disabled", async () => {
  await mount();
  await click(buttonIn(rowOf("Ayesha Khan"), "Edit"));
  const input = dialog().querySelector('[name="email"]');
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "nope"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  expect(dialogButton("Save changes").disabled).toBe(true);
});

test("Reset password asks first, then shows the new temporary password once", async () => {
  await mount();
  axios.post.mockResolvedValue({ data: { temporaryPassword: "Abcd-Efgh-Jkmn" } });
  await click(container.querySelector('[aria-label="More actions for Bilal Raza"]'));
  await click(buttonIn(container, "Reset password…"));
  expect(dialog().textContent).toMatch(/signed out everywhere/);
  expect(axios.post).not.toHaveBeenCalled();
  await click(dialogButton("Reset password"));
  await wait(10);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/users/teachers/t2/reset-password"), {}, expect.anything());
  expect(document.querySelector('[data-testid="temporary-password"]').textContent).toBe("Abcd-Efgh-Jkmn");
  expect(dialog().textContent).toMatch(/bilal@gu.edu/);
});

test("a revoked teacher has no Reset password action", async () => {
  await mount();
  await click(container.querySelectorAll('[role="tab"]')[1]);
  await click(container.querySelector('[aria-label="More actions for Hina Shah"]'));
  expect(buttonIn(container, "Reset password…")).toBeUndefined();
});
