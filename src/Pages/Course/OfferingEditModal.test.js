import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import OfferingEditModal from "./OfferingEditModal";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const departments = [{ _id: "d1", name: "Computer Science" }, { _id: "d2", name: "Electrical Engineering" }];
const programs = [{ _id: "p1", name: "BSCS", typicalDuration: 8 }, { _id: "p2", name: "BSEE", typicalDuration: 4 }];
const offering = {
  _id: "o1", department: { _id: "d1", name: "Computer Science" }, program: { _id: "p1", name: "BSCS" }, semester: 0, isActive: true,
  courseId: { _id: "c1", code: "CS107", name: "Business Process & Analytics" }, academicYearId: { displayName: "Fall 2026" },
};

let container; let root;
const mount = async (props = {}) => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const handlers = { onSubmit: jest.fn(), onClose: jest.fn() };
  await act(async () => { root.render(<OfferingEditModal offering={offering} departments={departments} programs={programs} saving={false} error="" {...handlers} {...props} />); });
  return handlers;
};
afterEach(() => { act(() => root.unmount()); container.remove(); });

const field = (name) => container.querySelector(`[name="${name}"]`);
const save = () => [...container.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith("Sav"));
const pick = async (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new Event("change", { bubbles: true }));
});

test("shows which course and term it is, with the current values selected", async () => {
  await mount();
  expect(container.querySelector(".oem-summary").textContent).toContain("CS107 Business Process & Analytics · Fall 2026");
  expect(field("department").value).toBe("d1");
  expect(field("program").value).toBe("p1");
  expect(field("semester").value).toBe("0");
  expect(field("isActive").checked).toBe(true);
});

test("semester 0 is explained, and the list runs to the program's length", async () => {
  await mount();
  const labels = [...field("semester").options].map((o) => o.textContent);
  expect(labels[0]).toBe("Not placed in a semester (0)");
  expect(labels[labels.length - 1]).toBe("Semester 8");
  await pick(field("program"), "p2");
  expect([...field("semester").options].map((o) => o.textContent).pop()).toBe("Semester 4");
});

test("Save stays off until something changes, then sends the chosen values", async () => {
  const { onSubmit } = await mount();
  expect(save().disabled).toBe(true);
  await pick(field("semester"), "2");
  expect(save().disabled).toBe(false);
  await act(async () => { container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
  expect(onSubmit).toHaveBeenCalledWith({ department: "d1", program: "p1", semester: "2", isActive: true });
});

test("unticking Active is a change", async () => {
  await mount();
  await act(async () => { field("isActive").click(); });
  expect(save().disabled).toBe(false);
});

test("a server reason is shown in the dialog, and saving disables the controls", async () => {
  await mount({ error: "1 student is enrolled through this offering, so its semester can't be changed. Create a new offering instead.", saving: true });
  expect(container.querySelector(".am-error").textContent).toContain("1 student is enrolled through this offering");
  expect(field("semester").disabled).toBe(true);
  expect(save().disabled).toBe(true);
});

test("an older offering beyond its program's length keeps its own semester in the list", async () => {
  await mount({ offering: { ...offering, program: { _id: "p2" }, semester: 6 } });
  expect(field("semester").value).toBe("6");
});

test("Cancel and Escape both close it", async () => {
  const { onClose } = await mount();
  await act(async () => { [...container.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel").click(); });
  await act(async () => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
  expect(onClose).toHaveBeenCalledTimes(2);
});
