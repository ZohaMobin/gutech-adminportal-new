import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import StudentMarksPage from "./StudentMarksPage";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const term = { _id: "t1", semesterType: "Fall", year: 2026, displayName: "Fall 2026", status: "active" };
let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const mount = async ({ pending = false } = {}) => {
  axios.get.mockImplementation((url) => {
    if (pending) return new Promise(() => {});
    return Promise.resolve({ data: url.includes("academic-years") ? [term] : [] });
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<StudentMarksPage />); });
  await wait(20);
};
afterEach(() => { act(() => root.unmount()); container.remove(); jest.clearAllMocks(); });

test("uses the shared header and page shell, with no hero card", async () => {
  await mount();
  expect(container.firstElementChild.classList.contains("page-shell")).toBe(true);
  expect(container.querySelector(".page-head-title").textContent).toBe("Student Marks");
  expect(container.querySelector(".term-selector-card")).toBeNull();
});

test("keeps its title on screen while the terms load", async () => {
  await mount({ pending: true });
  expect(container.querySelector(".page-head-title").textContent).toBe("Student Marks");
});

test("term and the five section filters share one filter row, with the current term chosen", async () => {
  await mount();
  const selects = [...container.querySelectorAll(".marks-filters select")];
  expect(selects.map((s) => s.id)).toEqual(["marks-academic-term", "department", "program", "semester", "course", "section"]);
  expect(selects[0].value).toBe("t1");
  expect(selects[0].selectedOptions[0].textContent).toBe("Fall 2026 (Active)");
  expect(container.querySelector(".clear-filters-btn").textContent).toBe("Clear");
});

test("before a section is chosen it says what to pick", async () => {
  await mount();
  expect(container.querySelector(".no-data-container").textContent).toMatch(/Pick a section to see its gradebook/);
});
