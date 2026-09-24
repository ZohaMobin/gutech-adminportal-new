import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import DepartmentsPage from "./Departments/DepartmentsPage";
import ProgramsPage from "./Programs/ProgramsPage";
import AcademicYearsPage from "./AcademicYears/AcademicYearsPage";
import AccountApprovalsPage from "./AccountApprovals/AccountApprovalsPage";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const mount = async (Page, { pending = false } = {}) => {
  axios.get.mockImplementation(() => (pending ? new Promise(() => {}) : Promise.resolve({ data: [] })));
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<Page />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllMocks(); });

const pages = [
  ["Departments", DepartmentsPage, "+ Add Department"],
  ["Programs", ProgramsPage, "+ Add Program"],
  ["Academic Years", AcademicYearsPage, "+ Add Academic Year"],
  ["Account Approvals", AccountApprovalsPage, null],
];

describe.each(pages)("%s", (title, Page, action) => {
  test("uses the shared header and page shell", async () => {
    await mount(Page);
    expect(container.firstElementChild.classList.contains("page-shell")).toBe(true);
    expect(container.querySelector(".page-head-title").textContent).toBe(title);
    if (action) expect(container.querySelector(".page-head-actions button").textContent.trim()).toBe(action);
  });

  test("keeps its title on screen while the data loads", async () => {
    await mount(Page, { pending: true });
    expect(container.querySelector(".page-head-title").textContent).toBe(title);
  });
});
