import { parseStudentSheet, ISSUES } from "./parseStudentSheet";

test("headings are matched however they are spelled: spaces, case, underscores and common alternatives", () => {
  for (const heading of [["Roll Number", "Name", "Email", "Section"], ["rollNumber", "name", "email", "section"], ["ROLL NO", "STUDENT NAME", "E-mail", "Sec"], ["roll_no", "Full Name", "Email Address", "Section Name"], ["Registration Number", "name", "email", "section"]]) {
    const row = { [heading[0]]: "2023001", [heading[1]]: "Ali Ahmad", [heading[2]]: "ali@x.pk", [heading[3]]: "A" };
    const { students, columns } = parseStudentSheet([row]);
    expect(students[0]).toMatchObject({ rollNumber: "2023001", name: "Ali Ahmad", email: "ali@x.pk", section: "A", issues: [] });
    expect(columns.missing).toEqual([]);
  }
});

test("numbers from Excel become text, and stray spaces are trimmed", () => {
  const { students } = parseStudentSheet([{ "Roll Number": 2023001, Name: "  Ali  ", Email: "", Section: " A " }]);
  expect(students[0]).toMatchObject({ rollNumber: "2023001", name: "Ali", section: "A" });
});

test("a missing roll number or section column is reported by name, with the columns that were found", () => {
  const out = parseStudentSheet([{ Name: "Ali", Email: "a@x.pk", Group: "A" }]);
  expect(out.columns.missing).toEqual(["Roll Number", "Section"]);
  expect(out.columns.found).toEqual(["Name", "Email", "Group"]);
  expect(out.usable).toBe(false);
});

test("name and email are optional: only roll number and section are needed", () => {
  const out = parseStudentSheet([{ roll: "1", sec: "A" }, { roll: "2", sec: "B" }]);
  expect(out.columns.missing).toEqual([]);
  expect(out.usable).toBe(true);
  expect(out.students.map((s) => s.name)).toEqual(["", ""]);
});

test("each row's problems are flagged: no roll number, no section, and a roll number that repeats (with the first row named)", () => {
  const out = parseStudentSheet([
    { "Roll Number": "1", Section: "A" },
    { "Roll Number": "", Section: "A" },
    { "Roll Number": "2", Section: "" },
    { "Roll Number": "1", Section: "B" },
    { "Roll Number": " 1 ", Section: "B" },
  ]);
  expect(out.students.map((s) => s.issues)).toEqual([[], ["NO_ROLL"], ["NO_SECTION"], ["DUPLICATE_ROLL"], ["DUPLICATE_ROLL"]]);
  expect(out.students[3].firstLine).toBe(2);
  expect(out.students[3].line).toBe(5);                                    // the sheet's own row number
  expect(out.problems).toBe(4);
  expect(ISSUES.DUPLICATE_ROLL).toBe("Roll number appears more than once");
});

test("blank lines in the sheet are ignored, and the sections are counted", () => {
  const out = parseStudentSheet([{ "Roll Number": "1", Section: "B" }, { "Roll Number": "", Section: "" }, { "Roll Number": "2", Section: "A" }, { "Roll Number": "3", Section: "B" }, { "Roll Number": "10", Section: "A2" }]);
  expect(out.students).toHaveLength(4);
  expect(out.sections).toEqual([{ name: "A", count: 1 }, { name: "A2", count: 1 }, { name: "B", count: 2 }]);
});

test("unrecognised columns are ignored and listed", () => {
  const out = parseStudentSheet([{ "Roll Number": "1", Section: "A", Phone: "0300", Notes: "x" }]);
  expect(out.columns.ignored).toEqual(["Phone", "Notes"]);
});

test("an empty file is not usable", () => {
  expect(parseStudentSheet([]).usable).toBe(false);
  expect(parseStudentSheet(null).students).toEqual([]);
});
