// Turns the rows of an uploaded class list into students, whatever the column headings look like ("Roll Number", "roll_no",
// "ROLL NO", "rollNumber"...), and says what is wrong with each row BEFORE anyone is enrolled. Pure, so it is easy to test.
//
// The server needs a roll number and a section for every student. Name and email are shown for checking only.

const clean = (heading) => String(heading ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const ALIASES = {
  rollNumber: ["rollnumber", "rollno", "rollnum", "roll", "studentid", "studentroll", "studentrollnumber", "registrationnumber", "regno", "regnumber", "enrollmentnumber", "enrolmentnumber"],
  name: ["name", "studentname", "fullname"],
  email: ["email", "emailaddress", "studentemail", "mail"],
  section: ["section", "sec", "sectionname"],
};
const LABELS = { rollNumber: "Roll Number", name: "Name", email: "Email", section: "Section" };
export const REQUIRED = ["rollNumber", "section"];

export const ISSUES = {
  NO_ROLL: "Roll number is missing",
  DUPLICATE_ROLL: "Roll number appears more than once",
  NO_SECTION: "Section is missing",
};

const text = (value) => String(value ?? "").trim();

export function parseStudentSheet(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const headings = [...new Set(list.flatMap((row) => Object.keys(row || {})))];

  // Which of the file's headings is which field. The first match wins.
  const columnFor = {};
  for (const [field, names] of Object.entries(ALIASES)) {
    const found = headings.find((heading) => names.includes(clean(heading)));
    if (found !== undefined) columnFor[field] = found;
  }
  const missing = REQUIRED.filter((field) => columnFor[field] === undefined);
  const used = new Set(Object.values(columnFor));
  const columns = { found: headings, missing: missing.map((field) => LABELS[field]), ignored: headings.filter((heading) => !used.has(heading)) };

  const students = [];
  const firstSeen = new Map();
  list.forEach((row, index) => {
    const values = Object.fromEntries(Object.keys(ALIASES).map((field) => [field, columnFor[field] === undefined ? "" : text(row[columnFor[field]])]));
    if (Object.values(row || {}).every((value) => text(value) === "")) return;            // a blank line in the sheet
    const line = index + 2;                                                                 // the sheet's own row number (row 1 is the heading)
    const issues = [];
    if (!values.rollNumber) issues.push("NO_ROLL");
    else if (firstSeen.has(values.rollNumber.toLowerCase())) issues.push("DUPLICATE_ROLL");
    else firstSeen.set(values.rollNumber.toLowerCase(), line);
    if (!values.section) issues.push("NO_SECTION");
    students.push({ line, ...values, issues, ...(issues.includes("DUPLICATE_ROLL") ? { firstLine: firstSeen.get(values.rollNumber.toLowerCase()) } : {}) });
  });

  const sectionCounts = new Map();
  for (const student of students) if (student.section) sectionCounts.set(student.section, (sectionCounts.get(student.section) || 0) + 1);
  const withProblems = students.filter((student) => student.issues.length > 0).length;
  return {
    students, columns,
    sections: [...sectionCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    problems: withProblems,
    usable: missing.length === 0 && students.length > 0,
  };
}
