import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import CourseRegistrationPage from "./CourseRegistrationPage";

jest.mock("axios");
jest.mock("xlsx", () => ({
  read: jest.fn(() => ({ SheetNames: ["S"], Sheets: { S: {} } })),
  writeFile: jest.fn(),
  utils: { sheet_to_json: jest.fn(), json_to_sheet: jest.fn(), book_new: jest.fn(), book_append_sheet: jest.fn() },
}));
jest.mock("./EligibilityPreview", () => (props) => <div data-testid="eligibility">{props.students.length} students checked</div>);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const term = { _id: "t1", semesterType: "Fall", year: 2026, displayName: "Fall 2026" };
const offering = (id, semester, code, name) => ({ _id: id, department: "d1", program: "p1", semester, courseId: { _id: `c-${code}`, code, name, creditHours: 3 } });
const offerings = [offering("o1", 1, "CS101", "Programming"), offering("o2", 1, "MT101", "Calculus"), offering("o3", 2, "CS201", "Data Structures")];
const sectionA = { _id: "s1", section: "A", enrolledStudentsCount: 12 };

let container; let root; let state;
const wait = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); }); await wait(); };
const type = async (el, value) => act(async () => {
  const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const gets = (part) => axios.get.mock.calls.filter(([url]) => url.includes(part)).length;
const select = (label) => [...container.querySelectorAll(".enr-filters label")].find((l) => l.textContent.startsWith(label)).querySelector("select");
const button = (text, scope = container) => [...scope.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));

const mount = async ({ sections = [sectionA], sheetRows = null } = {}) => {
  state = { sections: [...sections] };
  axios.get.mockImplementation((url, config) => {
    if (url.includes("/academic-years/current")) return Promise.resolve({ data: term });
    if (url.includes("/departments")) return Promise.resolve({ data: [{ _id: "d1", name: "Computer Science" }] });
    if (url.includes("/programs")) return Promise.resolve({ data: [{ _id: "p1", name: "BSCS" }, { _id: "p2", name: "BBA" }] });
    if (url.includes("/student-directory/semesters")) return Promise.resolve({ data: { semesters: [1, 2] } });
    if (url.includes("/course-offerings")) return Promise.resolve({ data: offerings });
    if (url.includes("/sections/course/")) return Promise.resolve({ data: state.sections });
    if (url.includes("/api/teachers")) return Promise.resolve({ data: [{ _id: "tc1", department: "d1", userId: { name: "Dr. Ada" }, employeeId: "E1" }] });
    if (url.includes("/bulk-enroll/")) {
      const { rows, ...light } = state.job;                                          // the progress view carries no report rows
      return Promise.resolve({ data: config?.params?.view === "progress" ? light : state.job });
    }
    return Promise.resolve({ data: [] });
  });
  XLSX.utils.sheet_to_json.mockReturnValue(sheetRows || []);
  await act(async () => { root.render(<CourseRegistrationPage />); });
  await wait(20);
};
const chooseCourse = async (semester = "1", code = "CS101") => {
  await type(select("Department"), "d1"); await type(select("Program"), "p1"); await wait(10);
  await type(select("Semester"), semester); await wait(10);
  await click([...container.querySelectorAll(".enr-course")].find((c) => c.textContent.includes(code)));
  await wait(20);
};
const upload = async (rows) => {
  XLSX.utils.sheet_to_json.mockReturnValue(rows);
  const input = container.querySelector("#enr-file");
  const file = new File(["x"], "class-list.xlsx");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event("change", { bubbles: true })); });
  await wait(60);
};

beforeEach(() => {
  container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
  sessionStorage.setItem("adminToken", "t");
  jest.clearAllMocks();
  axios.post.mockReset();
  XLSX.read.mockReturnValue({ SheetNames: ["S"], Sheets: { S: {} } });          // the app's Jest resets mock implementations between tests
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test("the page shows the current term and asks for the course first; later steps appear as each one is done", async () => {
  await mount();
  expect(container.textContent).toContain("Term: Fall 2026");
  expect(container.querySelectorAll(".enr-step")).toHaveLength(1);
  await chooseCourse();
  expect(container.querySelectorAll(".enr-step")).toHaveLength(3);            // course, sections, upload
  expect(container.textContent).toContain("Sections of Programming");
  expect(container.textContent).toContain("Section A");
  expect(container.textContent).toContain("12 students");
});

test("choosing filters does not fetch again: each thing is loaded once, and teachers only when a section is being added", async () => {
  await mount();
  await chooseCourse("1", "CS101");
  await type(select("Semester"), "2"); await wait(10);
  await type(select("Semester"), "1"); await wait(10);
  await type(select("Program"), "p2"); await type(select("Program"), "p1"); await wait(10);
  expect([gets("/academic-years/current"), gets("/departments"), gets("/programs"), gets("/course-offerings")]).toEqual([1, 1, 1, 1]);
  expect(gets("/student-directory/semesters")).toBe(2);                        // once per program, not once per change
  expect(gets("/api/teachers")).toBe(0);
  await chooseCourse("1", "CS101");                                            // changing the program cleared the course
  await click(button("Add another section"));
  expect(gets("/api/teachers")).toBe(1);
});

test("a class list with headings spelled differently still fills the preview, with a summary of the sections", async () => {
  await mount({ sections: [sectionA, { _id: "s2", section: "B", enrolledStudentsCount: 0 }] });
  await chooseCourse();
  await upload([{ "Roll No": 2023001, "Student Name": "Ali Ahmad", "E-mail": "ali@x.pk", Sec: "A" }, { "Roll No": 2023002, "Student Name": "Sara Khan", "E-mail": "sara@x.pk", Sec: "B" }]);
  const rows = [...container.querySelectorAll(".enr-table tbody tr")].map((r) => [...r.children].map((c) => c.textContent));
  expect(rows).toEqual([["2", "2023001", "Ali Ahmad", "ali@x.pk", "A", " OK"], ["3", "2023002", "Sara Khan", "sara@x.pk", "B", " OK"]]);
  expect(container.querySelector(".enr-preview-head h3").textContent).toBe("2 students");
  expect([...container.querySelectorAll(".enr-chip")].map((c) => c.textContent)).toEqual(["Section A · 1", "Section B · 1"]);
  expect(container.querySelector('[data-testid="eligibility"]').textContent).toBe("2 students checked");
});

test("a file with no roll number column says which columns are missing and which it found, and shows no table", async () => {
  await mount();
  await chooseCourse();
  await upload([{ Name: "Ali", Email: "a@x.pk", Group: "A" }]);
  expect(container.querySelector(".enr-banner.bad p").textContent).toContain("couldn't find a Roll Number and a Section column in this file");
  expect(container.textContent).not.toContain("</strong>");
  expect(container.textContent).toContain("The columns we found are: Name, Email, Group");
  expect(container.querySelector(".enr-table")).toBeNull();
  expect(button("Enroll ")).toBeUndefined();                                    // nothing to enroll from this file
});

test("problem rows are flagged in the table, block enrolling, and can be left out", async () => {
  await mount();
  await chooseCourse();
  await upload([{ "Roll Number": "1", Section: "A" }, { "Roll Number": "1", Section: "A" }, { "Roll Number": "", Section: "A" }, { "Roll Number": "4", Section: "" }, { "Roll Number": "5", Section: "A" }]);
  const flagged = [...container.querySelectorAll(".enr-table tr.has-problem")].map((r) => r.querySelector("td:last-child").textContent);
  expect(flagged).toEqual(["Roll number appears more than once (first on row 2)", "Roll number is missing", "Section is missing"]);
  expect(container.textContent).toContain("3 rows with a problem");
  expect(button("Enroll").disabled).toBe(true);
  await click(button("Leave out the 3 rows"));
  expect([...container.querySelectorAll(".enr-table tbody tr")].map((r) => r.children[1].textContent)).toEqual(["1", "5"]);
  expect(button("Enroll 2 students").disabled).toBe(false);
});

test("a section that does not exist yet is called out, can be added from the warning, and then enrolling is allowed", async () => {
  await mount();
  await chooseCourse();
  await upload([{ "Roll Number": "1", Section: "A" }, { "Roll Number": "2", Section: "B" }]);
  expect(container.textContent).toContain("Section B does not exist for Programming in Fall 2026.");
  expect(container.querySelector(".enr-chip.bad").textContent).toBe("Section B · 1");
  expect(button("Enroll").disabled).toBe(true);
  await click(button("Add section B"));
  expect(container.querySelector('.enr-add-section input').value).toBe("B");
  await type(container.querySelector(".enr-add-section select"), "tc1");
  axios.post.mockResolvedValueOnce({ data: {} });
  state.sections = [sectionA, { _id: "s2", section: "B", enrolledStudentsCount: 0 }];
  await click(button("Add section", container.querySelector(".enr-add-section")));
  expect(axios.post.mock.calls[0][0]).toContain("/sections/course/c-CS101/section/B");
  expect(axios.post.mock.calls[0][1]).toEqual({ teacherId: "tc1" });
  expect(container.textContent).toContain("Section B created.");
  expect(container.textContent).not.toContain("does not exist for Programming");
  expect(button("Enroll 2 students").disabled).toBe(false);
});

test("enrolling sends only roll numbers and sections, watches the job, and reports what happened", async () => {
  await mount();
  await chooseCourse();
  await upload([{ "Roll Number": 2023001, Section: "A" }, { "Roll Number": 2023002, Section: "A" }]);
  state.job = { status: "done", total: 2, processed: 2, registered: 2, alreadyRegistered: 0, rows: [{ rollNumber: "2023001", status: "registered" }, { rollNumber: "2023002", status: "registered" }] };
  axios.post.mockResolvedValueOnce({ data: { jobId: "j1" } });
  await click(button("Enroll 2 students"));
  await wait(30);
  const [url, body] = axios.post.mock.calls[0];
  expect(url).toContain("/course-registrations/bulk-enroll");
  expect(body).toEqual({ courseId: "c-CS101", semester: 1, academicYear: "t1", rows: [{ rollNumber: "2023001", section: "A" }, { rollNumber: "2023002", section: "A" }], fileName: "class-list.xlsx", rowsInFile: 2, leftOut: 0 });
  expect(container.querySelector(".enr-banner.ok").textContent).toContain("Enrolled 2 of 2 students in Programming.");
  const asked = axios.get.mock.calls.filter(([u]) => u.includes("/bulk-enroll/"));
  expect(asked.map(([, c]) => c?.params?.view || "full")).toEqual(["progress", "full"]);          // progress while waiting, the full report once
  expect(container.querySelector(".enr-table")).toBeNull();                    // finished: the form resets
});

test("the page has two tabs and a summary that follows the choices, and the enroll button appears only with a usable list", async () => {
  await mount();
  const summary = () => container.querySelector(".enr-summary").textContent;
  expect(summary()).toContain("Not chosen yet");
  expect(summary()).toContain("Choose a course to begin.");
  await chooseCourse();
  expect(summary()).toContain("CS101");
  expect(summary()).toContain("Upload a class list to continue.");
  await upload([{ "Roll Number": "1", Section: "A" }]);
  expect(summary()).toContain("class-list.xlsx");
  expect(summary()).toContain("1 student");
  expect(button("Enroll 1 student", container.querySelector(".enr-summary"))).toBeTruthy();
  expect(container.querySelector(".enr-hidden .enh")).not.toBeNull();                    // history is on its own tab, out of sight
  await click(container.querySelectorAll(".enr-tabs button")[1]);
  expect(container.querySelector(".enr-hidden .enr-summary")).not.toBeNull();
  expect(container.querySelector("#enr-tab-history").getAttribute("aria-selected")).toBe("true");
});

test("the upload records its file name and how many rows of the file were left out", async () => {
  await mount();
  await chooseCourse();
  await upload([{ "Roll Number": "1", Section: "A" }, { "Roll Number": "2", Section: "A" }, { "Roll Number": "", Section: "A" }]);
  await click(button("Leave out the"));
  state.job = { status: "done", total: 2, processed: 2, registered: 2, alreadyRegistered: 0, rows: [{ rollNumber: "1", status: "registered" }, { rollNumber: "2", status: "registered" }] };
  axios.post.mockResolvedValueOnce({ data: { jobId: "j1" } });
  await click(button("Enroll 2 students"));
  await wait(30);
  const body = axios.post.mock.calls[0][1];
  expect([body.fileName, body.rowsInFile, body.leftOut]).toEqual(["class-list.xlsx", 3, 1]);
  expect(gets("/course-registrations/bulk-enroll?") + axios.get.mock.calls.filter(([u]) => /bulk-enroll$/.test(u)).length).toBe(2);   // history loaded once, and again after the upload
});

test("students who could not be enrolled are listed with their reasons, and only they stay for a retry", async () => {
  await mount();
  await chooseCourse();
  await upload([{ "Roll Number": "1", Section: "A" }, { "Roll Number": "2", Section: "A" }]);
  state.job = { status: "done", total: 2, processed: 2, registered: 1, alreadyRegistered: 0, rows: [{ rollNumber: "1", status: "registered" }, { rollNumber: "2", status: "failed", message: "Needs an exception: CS101 not passed" }] };
  axios.post.mockResolvedValueOnce({ data: { jobId: "j1" } });
  await click(button("Enroll 2 students"));
  await wait(30);
  expect(container.querySelector(".enr-banner.bad").textContent).toContain("1 student could not be enrolled");
  expect(container.querySelector(".enr-failures").textContent).toContain("2: Needs an exception: CS101 not passed");
  expect([...container.querySelectorAll(".enr-table tbody tr")].map((r) => r.children[1].textContent)).toEqual(["2"]);
});

test("the server's own reason is shown when enrolling is refused", async () => {
  await mount();
  await chooseCourse();
  await upload([{ "Roll Number": "1", Section: "A" }]);
  axios.post.mockRejectedValueOnce({ response: { status: 409, data: { message: "Enrolment is closed for this term." } } });
  await click(button("Enroll 1 student"));
  expect(container.querySelector(".enr-banner.bad").textContent).toContain("Enrolment is closed for this term.");
  expect(container.textContent).not.toMatch(/network error/i);
});

test("choosing a different course clears the uploaded list, so it can never be enrolled in the wrong course", async () => {
  await mount();
  await chooseCourse("1", "CS101");
  await upload([{ "Roll Number": "1", Section: "A" }]);
  expect(container.querySelector(".enr-table")).not.toBeNull();
  await click([...container.querySelectorAll(".enr-course")].find((c) => c.textContent.includes("MT101")));
  await wait(20);
  expect(container.querySelector(".enr-table")).toBeNull();
});

test("with no active term the page says so and nothing can be enrolled", async () => {
  await mount();
  axios.get.mockImplementation((url) => (url.includes("/academic-years/current") ? Promise.reject({ response: { data: { message: "No active academic term is configured" } } }) : Promise.resolve({ data: [] })));
  act(() => root.unmount()); root = createRoot(container);
  await act(async () => { root.render(<CourseRegistrationPage />); });
  await wait(30);
  expect(container.textContent).toContain("There is no active academic term");
});
