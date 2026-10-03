import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import TimetableGrid from "./TimetableGrid";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../utils/sectionTeachers", () => ({ formatSectionTeachers: () => "A Teacher" }));

let container; let root;
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

const course = (name) => ({ _id: name, name, code: name });
const cls = (id, day, startTime, endTime, room, courseName) => ({ _id: id, day, timeSlot: { startTime, endTime, room }, courseId: course(courseName), sectionId: { _id: "s1", section: "A26-F" } });
const render = (schedules) => act(async () => {
  root.render(<TimetableGrid filteredSchedules={schedules} sections={[]} teachers={[]} getSectionColor={() => "#eee"} handleEditSchedule={() => {}} handleDeleteSchedule={() => {}} filters={{}} clearFilters={() => {}} />);
});
const rows = () => [...container.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td").textContent);
const cell = (day, rowIndex) => container.querySelectorAll("tbody tr")[rowIndex].querySelectorAll("td")[["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].indexOf(day) + 1];

const sheet = [
  cls("a", "Monday", "08:30", "09:55", "SF1", "Database Systems"),
  cls("b", "Monday", "10:10", "11:35", "SF1", "Data Structures"),
  cls("c", "Monday", "11:45", "13:10", "SL", "Lab"),
  cls("d", "Monday", "14:00", "15:25", "SF1", "Applied Physics"),
  cls("e", "Tuesday", "08:30", "09:55", "SF1", "PSPF"),
  cls("f", "Tuesday", "10:10", "11:35", "SF1", "PSPF"),
];

test("a timetable of 08:30 / 10:10 / 11:45 / 14:00 classes shows every class, in rows named for the real windows", async () => {
  await render(sheet);
  expect(rows()).toEqual(["08:30 - 09:55", "10:10 - 11:35", "11:45 - 13:10", "14:00 - 15:25"]);
  expect(container.querySelectorAll(".schedule-cell").length).toBe(6);
  expect(cell("Monday", 0).textContent).toContain("Database Systems");
  expect(cell("Monday", 3).textContent).toContain("Applied Physics");
  expect(cell("Tuesday", 1).textContent).toContain("PSPF");
});

test("several classes in the same window stack in one cell, each with its own room", async () => {
  await render([...sheet, cls("g", "Monday", "08:30", "09:55", "GL", "Web Technologies")]);
  const monday = cell("Monday", 0);
  expect(monday.querySelectorAll(".schedule-cell").length).toBe(2);
  expect(monday.textContent).toContain("Room: GL");
  expect(monday.textContent).toContain("Room: SF1");
});

test("a class that straddles two windows is shown once, in the first, with its own times", async () => {
  await render([...sheet, cls("w", "Monday", "09:30", "11:30", "SL", "Web Technologies")]);
  expect(rows()).toHaveLength(4);
  expect(cell("Monday", 0).textContent).toContain("09:30 - 11:30");
  expect(cell("Monday", 1).textContent).not.toContain("Web Technologies");
  expect(container.querySelectorAll(".schedule-cell").length).toBe(7);
});

test("with nothing scheduled the grid shows whole-hour rows as before", async () => {
  await render([]);
  expect(rows()[0]).toBe("08:00 - 09:00");
  expect(rows()).toHaveLength(9);
});
