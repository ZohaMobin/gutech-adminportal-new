import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import AcademicStructurePage from "./AcademicStructurePage";

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
const tab = (label) => [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent === label);

const mount = async (start = null) => {
  mockTab = start;
  sessionStorage.setItem("adminToken", "t");
  axios.get.mockImplementation(async (url) => {
    if (url.includes("/api/departments")) return { data: [{ _id: "d1", code: "CS", name: "Computer Science", description: "", isActive: true }] };
    if (url.includes("/api/programs")) return { data: [{ _id: "p1", code: "BSCS", name: "BS Computer Science", level: "undergraduate", typicalDuration: 8, description: "", isActive: true, department: "d1" }] };
    return { data: [] };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<AcademicStructurePage />); });
  await wait(30);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; sessionStorage.clear(); jest.clearAllMocks(); });

test("one page with a Departments tab and a Programs tab, opening on Departments", async () => {
  await mount();
  expect(container.querySelector(".page-head-title").textContent).toBe("Departments & Programs");
  expect([...container.querySelectorAll('[role="tab"]')].map((b) => b.textContent)).toEqual(["Departments", "Programs"]);
  expect(tab("Departments").getAttribute("aria-selected")).toBe("true");
  expect(container.textContent).toContain("Computer Science");
  expect(container.textContent).toContain("+ Add Department");
});

test("switching tabs shows the programs, with their own Add button", async () => {
  await mount();
  await click(tab("Programs"));
  await wait(30);
  expect(container.textContent).toContain("BS Computer Science");
  expect(container.textContent).toContain("+ Add Program");
  expect(container.textContent).not.toContain("+ Add Department");
});

test("a link can open straight onto the Programs tab", async () => {
  await mount("programs");
  expect(tab("Programs").getAttribute("aria-selected")).toBe("true");
  expect(container.textContent).toContain("BS Computer Science");
});
