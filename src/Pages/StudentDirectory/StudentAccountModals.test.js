import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import { DeactivateModal, ReactivateModal } from "./StudentAccountModals";

jest.mock("axios");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const button = (text) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === text);
const type = async (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
});
const student = { _id: "s1", name: "Muhammad Akif", rollNumber: "2622-6DSAI-023", program: { code: "MS DSAI" } };
const mount = async (ui) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(ui); });
  await wait(10);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); });

test("deactivate shows who and what will happen, needs a reason, then sends it", async () => {
  axios.get.mockResolvedValue({ data: { willDrop: [{ code: "AI301", name: "Machine Learning" }], lockedStay: [{ code: "MTH202", name: "Linear Algebra" }] } });
  axios.post.mockResolvedValue({ data: { message: "Deactivated and dropped from 1 course" } });
  const onDone = jest.fn();
  await mount(<DeactivateModal student={student} onDone={onDone} onClose={jest.fn()} />);
  const text = document.querySelector('[role="dialog"]').textContent;
  expect(text).toMatch(/Muhammad Akif/);
  expect(text).toMatch(/Choose a reason to see what happens to their course/);
  expect(text).toMatch(/MTH202 Linear Algebra has a locked result and stays/);
  expect(text).toMatch(/Past results, transcript, attendance and marks are kept/);

  expect(button("Deactivate student").disabled).toBe(true);
  await click(document.querySelectorAll('input[name="sda-reason"]')[0]);       // Withdrew
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/Dropped from 1 course this semester: AI301 Machine Learning/);
  await type(document.querySelector("textarea"), "Letter dated 7 Oct");
  await click(button("Deactivate student"));
  await wait(10);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/students/s1/deactivate"), { category: "withdrew", note: "Letter dated 7 Oct" }, expect.anything());
  expect(onDone).toHaveBeenCalledWith("Deactivated and dropped from 1 course");
});

test("Other needs a note before it can be confirmed", async () => {
  axios.get.mockResolvedValue({ data: { willDrop: [], lockedStay: [] } });
  await mount(<DeactivateModal student={student} onDone={jest.fn()} onClose={jest.fn()} />);
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/Not enrolled in any course this semester/);
  await click(document.querySelectorAll('input[name="sda-reason"]')[3]);       // Other
  expect(button("Deactivate student").disabled).toBe(true);
  await type(document.querySelector("textarea"), "Fee default, Finance office");
  expect(button("Deactivate student").disabled).toBe(false);
});

test("reactivate explains that courses are not added back", async () => {
  axios.post.mockResolvedValue({ data: { message: "Reactivated. They can sign in again." } });
  const onDone = jest.fn();
  await mount(<ReactivateModal student={student} onDone={onDone} onClose={jest.fn()} />);
  expect(document.querySelector('[role="dialog"]').textContent).toMatch(/not added back/);
  await click(button("Reactivate"));
  await wait(10);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining("/api/students/s1/reactivate"), {}, expect.anything());
  expect(onDone).toHaveBeenCalled();
});

test("suspended keeps their courses, and the dialog says so", async () => {
  axios.get.mockResolvedValue({ data: { willDrop: [{ code: "AI301", name: "Machine Learning" }], lockedStay: [] } });
  await mount(<DeactivateModal student={student} onDone={jest.fn()} onClose={jest.fn()} />);
  await click(document.querySelectorAll('input[name="sda-reason"]')[2]);       // Suspended
  const text = document.querySelector('[role="dialog"]').textContent;
  expect(text).toMatch(/Stays enrolled in AI301 Machine Learning/);
  expect(text).toMatch(/Suspended" tag/);
  expect(text).not.toMatch(/Dropped from/);
});
