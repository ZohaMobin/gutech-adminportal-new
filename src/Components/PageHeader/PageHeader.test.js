import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import PageHeader from "./PageHeader";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let container; let root;
const render = async (ui) => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); await act(async () => { root.render(ui); }); };
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("the title is the page's one h1", async () => {
  await render(<PageHeader title="Departments" />);
  const h1 = container.querySelectorAll("h1");
  expect(h1.length).toBe(1);
  expect(h1[0].textContent).toBe("Departments");
  expect(container.querySelector("header.page-head")).not.toBeNull();
});

test("without a subtitle or actions, neither is rendered", async () => {
  await render(<PageHeader title="Programs" />);
  expect(container.querySelector(".page-head-sub")).toBeNull();
  expect(container.querySelector(".page-head-actions")).toBeNull();
});

test("a subtitle sits under the title and actions on the right", async () => {
  await render(<PageHeader title="Academic Years" subtitle="The terms the university runs" actions={<button>+ Add</button>} />);
  expect(container.querySelector(".page-head-text .page-head-sub").textContent).toBe("The terms the university runs");
  expect(container.querySelector(".page-head-actions button").textContent).toBe("+ Add");
});
