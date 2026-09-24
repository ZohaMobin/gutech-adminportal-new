import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import CoursePage from "./CoursePage";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

const course = (id, code, isActive = true) => ({ _id: id, code, name: `${code} name`, description: "d", creditHours: 3, isActive });
let courses;
let container; let root;
let finish;   // resolves the in-flight PATCH / DELETE

const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const clickEl = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(); };
const tab = (text) => [...container.querySelectorAll("button.tab")].find((b) => b.textContent.trim() === text);
const row = (code) => [...container.querySelectorAll(".courses-table tbody tr")].find((r) => r.textContent.includes(code));

beforeEach(async () => {
  courses = [course("c1", "CS101"), course("c2", "CS102", false)];
  axios.get.mockImplementation((url) => {
    if (url.includes("/api/departments")) return Promise.resolve({ data: [] });
    if (url.includes("/api/programs")) return Promise.resolve({ data: [] });
    if (url.includes("/api/academic-years")) return Promise.resolve({ data: [] });
    if (url.includes("/api/course-offerings")) return Promise.resolve({ data: [] });
    if (url.includes("/api/courses")) return Promise.resolve({ data: courses });
    return Promise.resolve({ data: [] });
  });
  axios.patch.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ data: {} }); }));
  axios.delete.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ data: {} }); }));
  window.confirm = jest.fn(() => true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<CoursePage />); });
  await wait(20);
  await clickEl(tab("Manage Courses"));
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllMocks(); });

test("the courses are listed once the first load is done", () => {
  expect(container.querySelector(".ld-table")).toBeNull();
  expect(row("CS101")).toBeTruthy();
  expect(row("CS102")).toBeTruthy();
});

test("switching a course on or off keeps the table on screen; only that row shows it is busy", async () => {
  await clickEl(row("CS101").querySelector(".toggle-btn"));
  expect(container.querySelector(".ld-table")).toBeNull();                       // no skeleton, no blank
  expect(container.querySelectorAll(".courses-table tbody tr").length).toBe(2);
  expect(row("CS101").classList.contains("is-busy")).toBe(true);
  expect(row("CS101").querySelector(".toggle-btn").disabled).toBe(true);
  expect(row("CS102").classList.contains("is-busy")).toBe(false);                // the others stay usable
  expect(row("CS102").querySelector(".toggle-btn").disabled).toBe(false);

  await act(async () => { finish(); });
  await wait();
  expect(row("CS101").classList.contains("is-busy")).toBe(false);
  expect(row("CS101").textContent).toContain("Inactive");
});

const dialog = () => document.querySelector('[role="dialog"]');
const dialogButton = (text) => [...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === text);

test("the page starts with the shared header", () => {
  expect(container.firstElementChild.classList.contains("page-shell")).toBe(true);
  expect(container.querySelector(".page-head-title").textContent).toBe("Courses");
});

test("deleting asks in a dialog first, and cancelling deletes nothing", async () => {
  await clickEl(row("CS102").querySelector(".delete-btn"));
  expect(dialog().textContent).toMatch(/Delete CS102 CS102 name\?/);
  expect(axios.delete).not.toHaveBeenCalled();
  await clickEl(dialogButton("Cancel"));
  expect(dialog()).toBeNull();
  expect(axios.delete).not.toHaveBeenCalled();
  expect(window.confirm).not.toHaveBeenCalled();
});

test("deleting a course leaves the rest in place and removes just that row when it is done", async () => {
  await clickEl(row("CS102").querySelector(".delete-btn"));
  await clickEl(dialogButton("Delete course"));
  expect(dialog().textContent).toMatch(/Deleting…/);   // the dialog stays, busy, until the server answers
  expect(container.querySelector(".ld-table")).toBeNull();
  expect(row("CS102").classList.contains("is-busy")).toBe(true);
  expect(row("CS101")).toBeTruthy();

  await act(async () => { finish(); });
  await wait();
  expect(dialog()).toBeNull();
  expect(row("CS102")).toBeUndefined();
  expect(row("CS101")).toBeTruthy();
});

test("a refused delete shows the reason inside the dialog and keeps the course", async () => {
  axios.delete.mockImplementation(() => Promise.reject({ response: { data: { message: "This course has enrolled students" } } }));
  await clickEl(row("CS102").querySelector(".delete-btn"));
  await clickEl(dialogButton("Delete course"));
  expect(dialog().querySelector(".am-error").textContent).toBe("This course has enrolled students");
  expect(row("CS102")).toBeTruthy();
});
