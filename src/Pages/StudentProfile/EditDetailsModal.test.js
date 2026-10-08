import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import EditDetailsModal from "./EditDetailsModal";

jest.mock("axios");
jest.mock("../../hooks/useDepartmentsAndPrograms", () => ({
  useDepartmentsAndPrograms: () => ({
    loading: false,
    departments: [{ _id: "d1", name: "Computing" }, { _id: "d2", name: "Sciences" }],
    programs: [{ _id: "p1", name: "MS Data Science and AI", typicalDuration: 4 }, { _id: "p2", name: "BS Computer Science", typicalDuration: 8 }],
  }),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container; let root;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
const field = (name) => document.querySelector(`[name="${name}"]`);
const setValue = async (el, value) => act(async () => {
  const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const save = () => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Save changes");
const student = { id: "s1", name: "Muhammad Akif", email: "akif@gu.edu", rollNumber: "2622-6DSAI-023", departmentId: "d1", programId: "p1", currentSemester: 1 };
const mount = async (onDone = jest.fn()) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root.render(<EditDetailsModal student={student} onDone={onDone} onClose={jest.fn()} />); });
  await wait(10);
};
afterEach(() => { act(() => root.unmount()); container.remove(); document.body.innerHTML = ""; jest.clearAllMocks(); });

test("it opens with the current details and Save stays off until something changes", async () => {
  await mount();
  expect(field("name").value).toBe("Muhammad Akif");
  expect(field("rollNumber").value).toBe("2622-6DSAI-023");
  expect(field("program").value).toBe("p1");
  expect([...field("currentSemester").options].map((o) => o.value)).toEqual(["0", "1", "2", "3", "4"]);   // MS DSAI has 4 semesters
  expect(save().disabled).toBe(true);
});

test("only what changed is sent, with the optional note", async () => {
  axios.patch.mockResolvedValue({ data: { message: "Updated program and semester" } });
  const onDone = jest.fn();
  await mount(onDone);
  await setValue(field("program"), "p2");
  expect(document.body.textContent).toMatch(/courses this semester stay as they are/);
  await setValue(field("currentSemester"), "3");
  await setValue(document.querySelector('input[placeholder="Registrar correction, 8 Oct"]'), "Program transfer approved");
  await click(save());
  await wait(10);
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/api/students/s1/details"), { program: "p2", currentSemester: 3, note: "Program transfer approved" }, expect.anything());
  expect(onDone).toHaveBeenCalledWith("Updated program and semester");
});

test("a new roll number warns that they'll be signed out; an invalid email blocks saving", async () => {
  await mount();
  await setValue(field("rollNumber"), "2622-6DSAI-099");
  expect(document.body.textContent).toMatch(/signed out and must sign in with the new roll number/);
  await setValue(field("email"), "not-an-email");
  expect(save().disabled).toBe(true);
});
