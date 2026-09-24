import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { toast } from "react-hot-toast";
import AppToaster from "./AppToaster";
import { showToast, TOAST_TYPES } from "./Toast";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no matchMedia, which react-hot-toast asks for (reduced-motion preference).
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

let container; let root;
beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<AppToaster />); });
});
afterEach(() => { act(() => { toast.remove(); root.unmount(); }); container.remove(); });

const wait = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

// Pages call toast.* / showToast() without mounting a Toaster of their own, so this one has to show them.
test("a plain toast call from any page is shown", async () => {
  await act(async () => { toast.success("Course offering updated"); });
  await wait();
  expect(document.body.textContent).toContain("Course offering updated");
});

test("showToast is shown too, and only once", async () => {
  await act(async () => { showToast("Administrator updated", TOAST_TYPES.SUCCESS); });
  await wait();
  expect(document.body.textContent.split("Administrator updated").length - 1).toBe(1);
});
