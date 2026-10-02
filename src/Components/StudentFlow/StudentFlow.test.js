import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import StudentFlow from "./StudentFlow";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); mockNavigate.mockClear(); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (current) => act(async () => { root.render(<StudentFlow current={current} />); });

test("says what each step does and marks the one you are on", async () => {
  await render("import");
  expect(container.textContent).toContain("Creates their accounts in the LMS");
  expect(container.textContent).toContain("Puts them into courses for the current term");
  expect(container.querySelector("[aria-current='step']").textContent).toContain("Import Students");
  expect(container.querySelector(".sf-here").textContent).toBe("You are here");
});

test("the other step is one click away", async () => {
  await render("import");
  await act(async () => { container.querySelector(".sf-go").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(mockNavigate).toHaveBeenCalledWith("/course-registration");
  await render("enroll");
  await act(async () => { container.querySelector(".sf-go").dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  expect(mockNavigate).toHaveBeenCalledWith("/import-students");
});
