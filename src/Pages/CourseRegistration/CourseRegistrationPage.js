import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useDepartmentsAndPrograms } from "../../hooks/useDepartmentsAndPrograms";
import { formatSectionTeachers } from "../../utils/sectionTeachers";
import { messageOf } from "../../utils/apiMessage";
import { pollJob } from "../../utils/pollJob";
import EligibilityPreview from "./EligibilityPreview";
import EnrollmentHistory from "./EnrollmentHistory";
import { parseStudentSheet, ISSUES } from "./parseStudentSheet";
import "./CourseRegistrationPage.css";

const API = process.env.REACT_APP_BACKEND_URL;
const idOf = (value) => String(value?._id ?? value ?? "");
const normalize = (name) => String(name ?? "").trim().toLowerCase();

const Svg = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const CheckIcon = () => <Svg size={14}><path d="M5 12l5 5 9-10" /></Svg>;
const UploadIcon = () => <Svg size={22}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></Svg>;
const FileIcon = () => <Svg size={18}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /></Svg>;
const AlertIcon = () => <Svg size={16}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></Svg>;

// A numbered step: what to do now is always the first thing that is not yet done.
const Step = ({ number, title, done, hint, children }) => (
  <section className={`enr-step ${done ? "is-done" : ""}`}>
    <header className="enr-step-head">
      <span className="enr-step-n" aria-hidden="true">{done ? <CheckIcon /> : number}</span>
      <div><h2>{title}</h2>{hint && <p>{hint}</p>}</div>
    </header>
    <div className="enr-step-body">{children}</div>
  </section>
);

// Adds a class list to a course for the current term. Everything the page needs is loaded once and only when it is needed:
// the term, the departments and programs and the term's offerings once each, semesters once per program, teachers only when a
// section is being added. Choosing filters never fetches again.
const CourseRegistrationPage = () => {
  const { departments, programs, loading: filtersLoading } = useDepartmentsAndPrograms();
  const [department, setDepartment] = useState("");
  const [program, setProgram] = useState("");
  const [semester, setSemester] = useState("");
  const [term, setTerm] = useState(null);
  const [offerings, setOfferings] = useState(null);           // every active offering of the term, fetched once
  const [semestersByProgram, setSemestersByProgram] = useState({});
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [sections, setSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [teachers, setTeachers] = useState(null);             // fetched only when a section is being added
  const [addingSection, setAddingSection] = useState(false);
  const [newSection, setNewSection] = useState({ section: "", teacherId: "" });
  const [sheet, setSheet] = useState(null);                   // { fileName, rowsInFile, parsed }
  const [historyKey, setHistoryKey] = useState(0);           // bumped after an upload so the history reloads
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [failures, setFailures] = useState([]);
  const started = useRef(false);
  const sectionRequest = useRef(0);

  const headers = useCallback(() => {
    const token = sessionStorage.getItem("adminToken");
    return { "x-auth-token": token, Authorization: `Bearer ${token}` };
  }, []);

  // The current term, once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    axios.get(`${API}/api/academic-years/current`, { headers: headers() })
      .then((response) => setTerm(response.data))
      .catch((err) => { setTerm(false); setError(messageOf(err, "No active academic term is configured.")); });
  }, [headers]);

  // The term's offerings, once per term (not once per filter change).
  useEffect(() => {
    if (!term?._id) return;
    let current = true;
    setOfferings(null);
    axios.get(`${API}/api/course-offerings`, { params: { academicYearId: term._id, isActive: true }, headers: headers() })
      .then((response) => { if (current) setOfferings(Array.isArray(response.data) ? response.data : []); })
      .catch((err) => { if (current) { setOfferings([]); setError(messageOf(err, "The courses could not be loaded.")); } });
    return () => { current = false; };
  }, [term?._id, headers]);

  // A program's semesters, once per program.
  useEffect(() => {
    if (!program || semestersByProgram[program]) return;
    let current = true;
    axios.get(`${API}/api/student-directory/semesters`, { params: { program } })
      .then((response) => { if (current) setSemestersByProgram((known) => ({ ...known, [program]: response.data.semesters || [] })); })
      .catch(() => { if (current) setSemestersByProgram((known) => ({ ...known, [program]: [] })); });
    return () => { current = false; };
  }, [program, semestersByProgram]);

  const availableSemesters = semestersByProgram[program] || [];
  const courses = useMemo(() => {
    if (!offerings || !department || !program || !semester) return [];
    return offerings
      .filter((offering) => idOf(offering.department) === department && idOf(offering.program) === program && Number(offering.semester) === Number(semester))
      .map((offering) => ({ ...(offering.courseId || {}), offeringId: offering._id }))
      .filter((course) => course._id);
  }, [offerings, department, program, semester]);
  const course = courses.find((c) => c._id === selectedCourseId) || null;

  // The course's sections in this term.
  const loadSections = useCallback(async (courseId) => {
    const token = ++sectionRequest.current;
    setLoadingSections(true);
    try {
      const response = await axios.get(`${API}/api/sections/course/${courseId}`, { params: { academicYearId: term?._id }, headers: headers() });
      if (token === sectionRequest.current) setSections(Array.isArray(response.data) ? response.data : []);
    } catch {
      if (token === sectionRequest.current) setSections([]);
    } finally {
      if (token === sectionRequest.current) setLoadingSections(false);
    }
  }, [term?._id, headers]);

  useEffect(() => {
    setSheet(null); setAddingSection(false);
    if (course?._id && term?._id) loadSections(course._id); else { sectionRequest.current += 1; setSections([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course?._id, term?._id]);

  // Teachers are needed only to add a section, and only once.
  useEffect(() => {
    if (!addingSection || teachers) return;
    axios.get(`${API}/api/teachers`, { headers: headers() })
      .then((response) => setTeachers(Array.isArray(response.data) ? response.data : []))
      .catch((err) => { setTeachers([]); setError(messageOf(err, "The teachers could not be loaded.")); });
  }, [addingSection, teachers, headers]);
  const departmentTeachers = useMemo(() => (teachers || []).filter((t) => idOf(t.department) === department), [teachers, department]);

  // ---------- the uploaded list ----------
  const readFile = (file) => {
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setError("Please choose an Excel file (.xlsx or .xls)."); return; }
    setError(""); setSuccess(""); setFailures([]);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
        const parsed = parseStudentSheet(rows);
        setSheet({ fileName: file.name, rowsInFile: parsed.students.length, parsed });
      } catch (err) {
        setSheet(null);
        setError("That file could not be read. Check that it is a normal Excel file, then try again.");
      }
    };
    reader.onerror = () => setError("That file could not be read. Please try again.");
    reader.readAsArrayBuffer(file);
  };
  const onDrop = (event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer?.files?.[0]); };
  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ "Roll Number": "2023001", Name: "Ali Ahmad", Email: "aliahmad@agu.edu.pk", Section: "A" }]), "Template");
    XLSX.writeFile(workbook, "student_registration_template.xlsx");
  };
  const removeProblemRows = () => setSheet((current) => ({ ...current, parsed: parseStudentSheet(current.parsed.students.filter((s) => s.issues.length === 0).map((s) => ({ "Roll Number": s.rollNumber, Name: s.name, Email: s.email, Section: s.section }))) }));

  const students = sheet?.parsed.students || [];
  const known = useMemo(() => new Set(sections.map((s) => normalize(s.section))), [sections]);
  const unknownSections = useMemo(() => (sheet?.parsed.sections || []).map((s) => s.name).filter((name) => !known.has(normalize(name))), [sheet, known]);
  const dataProblems = sheet?.parsed.problems || 0;
  const canEnroll = Boolean(course && term?._id && sheet?.parsed.usable && dataProblems === 0 && unknownSections.length === 0 && !busy);

  // ---------- adding a section ----------
  const openAddSection = (name = "") => { setNewSection({ section: name, teacherId: "" }); setAddingSection(true); };
  const createSection = async () => {
    if (!course || !newSection.section.trim() || !newSection.teacherId) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      await axios.post(`${API}/api/sections/course/${course._id}/section/${encodeURIComponent(newSection.section.trim())}`, { teacherId: newSection.teacherId }, { headers: headers() });
      setSuccess(`Section ${newSection.section.trim()} created.`);
      setNewSection({ section: "", teacherId: "" }); setAddingSection(false);
      await loadSections(course._id);
    } catch (err) {
      setError(messageOf(err, "The section could not be created."));
    } finally { setBusy(false); }
  };

  // ---------- enrolling ----------
  const enroll = async () => {
    setError(""); setSuccess(""); setFailures([]); setBusy(true); setProgress(0);
    try {
      // The server enrols as one stored job with a report for every row, so closing the tab or losing the connection cannot
      // leave the list half done without a record. We start it and watch it.
      const start = await axios.post(`${API}/api/course-registrations/bulk-enroll`, {
        courseId: course._id, semester: parseInt(semester, 10), academicYear: term._id,
        rows: students.map((s) => ({ rollNumber: s.rollNumber, section: s.section })),
        // For the enrolment history: which file this was and how many of its rows were left out on the way.
        fileName: sheet.fileName, rowsInFile: sheet.rowsInFile ?? students.length, leftOut: Math.max(0, (sheet.rowsInFile ?? students.length) - students.length),
      }, { headers: headers() });

      // Ask for progress only (a few bytes), gently backing off; the full report is downloaded once, when the job is over.
      const jobUrl = `${API}/api/course-registrations/bulk-enroll/${start.data.jobId}`;
      const { job: last, timedOut } = await pollJob({
        fetchProgress: async () => (await axios.get(jobUrl, { params: { view: "progress" }, headers: headers() })).data,
        onProgress: (progressNow) => setProgress(progressNow.total ? Math.round((progressNow.processed / progressNow.total) * 100) : 100),
      });
      const job = timedOut ? last : (await axios.get(jobUrl, { headers: headers() })).data;
      if (timedOut) {
        setError("This is taking longer than expected. The enrolment is still running on the server; check the report in a few minutes before uploading again.");
        return;
      }
      if (job.status !== "done") setError(job.note || "The enrolment stopped before it finished. Rows already processed are saved; upload again to finish the rest.");

      // Rows already enrolled count as done, so uploading a list again is harmless.
      const done = job.registered + job.alreadyRegistered;
      const failed = job.rows.map((row, index) => ({ row, student: students[index] })).filter(({ row }) => row.status === "failed" || row.status === "pending");
      if (done > 0) setSuccess(`Enrolled ${done} of ${students.length} students in ${course.name}.`);
      if (failed.length > 0) {
        setError(done === 0 ? `No students were enrolled. ${failed.length} failed:` : `${failed.length} student${failed.length === 1 ? "" : "s"} could not be enrolled:`);
        setFailures(failed.map(({ row }) => ({ student: row.rollNumber, reason: row.message || "Not processed" })));
        // Keep only the failed rows, so a retry does not touch students who already succeeded.
        setSheet((current) => ({ ...current, parsed: parseStudentSheet(failed.map(({ student }) => ({ "Roll Number": student.rollNumber, Name: student.name, Email: student.email, Section: student.section }))) }));
      } else {
        setSheet(null); setSelectedCourseId("");
      }
    } catch (err) {
      setError(messageOf(err, "The students could not be enrolled."));
    } finally { setBusy(false); setHistoryKey((key) => key + 1); }
  };

  const clearFilters = () => { setDepartment(""); setProgram(""); setSemester(""); setSelectedCourseId(""); };
  const termLabel = term?.displayName || (term?.semesterType ? `${term.semesterType} ${term.year}` : "");
  const step1Done = Boolean(course);
  const step3Done = students.length > 0 && sheet?.parsed.usable;

  return (
    <div className="enr-page">
      <header className="enr-header">
        <div>
          <h1>Enroll students</h1>
          <p>Add a class list to a course for the current term: choose the course, check its sections, then upload the list.</p>
        </div>
        {termLabel && <span className="enr-term" title="Students are enrolled in the current academic term">Term: <strong>{termLabel}</strong></span>}
      </header>

      {term === false && <div className="enr-banner bad" role="alert"><AlertIcon /><p>There is no active academic term, so nobody can be enrolled yet. Set one under <strong>Academic Years</strong> first.</p></div>}
      {error && (
        <div className="enr-banner bad" role="alert">
          <AlertIcon />
          <div><p>{error}</p>
            {failures.length > 0 && <ul className="enr-failures">{failures.map((f, index) => <li key={`${f.student}-${index}`}><strong>{f.student}</strong>: {f.reason}</li>)}</ul>}
          </div>
        </div>
      )}
      {success && <div className="enr-banner ok" role="status"><CheckIcon /><p>{success}</p></div>}

      <Step number={1} title="Choose the course" done={step1Done} hint="Pick the department, program and semester, then the course.">
        <div className="enr-filters">
          <label><span>Department</span>
            <select value={department} onChange={(e) => { setDepartment(e.target.value); setSelectedCourseId(""); }} disabled={filtersLoading}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </label>
          <label><span>Program</span>
            <select value={program} onChange={(e) => { setProgram(e.target.value); setSemester(""); setSelectedCourseId(""); }} disabled={filtersLoading}>
              <option value="">Select program</option>
              {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label><span>Semester</span>
            <select value={semester} onChange={(e) => { setSemester(e.target.value); setSelectedCourseId(""); }} disabled={!program || availableSemesters.length === 0}>
              <option value="">{program && availableSemesters.length === 0 ? "No semesters" : "Select semester"}</option>
              {availableSemesters.map((s) => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </label>
        </div>

        {department && program && semester && offerings === null && <p className="enr-muted" aria-busy="true">Loading courses…</p>}
        {department && program && semester && offerings !== null && courses.length === 0 && (
          <div className="enr-empty">
            <strong>No courses found</strong>
            <span>Nothing is offered for this department, program and semester in {termLabel || "the current term"}. Try a different choice.</span>
            <button type="button" className="enr-btn" onClick={clearFilters}>Clear the choices</button>
          </div>
        )}
        {courses.length > 0 && (
          <div className="enr-courses" role="radiogroup" aria-label="Courses">
            {courses.map((c) => (
              <button key={c._id} type="button" role="radio" aria-checked={selectedCourseId === c._id} className={`enr-course ${selectedCourseId === c._id ? "is-on" : ""}`} onClick={() => { setSelectedCourseId(c._id); setSuccess(""); setFailures([]); setError(""); }}>
                <strong>{c.code}</strong><span>{c.name}</span><small>{c.creditHours} credit hours</small>
              </button>
            ))}
          </div>
        )}
      </Step>

      {course && (
        <Step number={2} title={`Sections of ${course.name}`} done={sections.length > 0} hint="Students are placed in a section, which must exist first and have a teacher.">
          {loadingSections ? <p className="enr-muted" aria-busy="true">Loading sections…</p> : sections.length > 0 ? (
            <div className="enr-sections">
              {sections.map((s) => (
                <div key={s._id || s.id} className="enr-section">
                  <strong>Section {s.section}</strong>
                  <span>{s.enrolledStudentsCount || 0} student{(s.enrolledStudentsCount || 0) === 1 ? "" : "s"}</span>
                  {formatSectionTeachers(s) && <small>{formatSectionTeachers(s)}</small>}
                </div>
              ))}
            </div>
          ) : <p className="enr-muted">This course has no sections in {termLabel || "this term"} yet. Add one to continue.</p>}

          {!addingSection
            ? <button type="button" className="enr-btn" onClick={() => openAddSection()}>{sections.length ? "Add another section" : "Add a section"}</button>
            : (
              <div className="enr-add-section" role="group" aria-label="Add a section">
                <label><span>Section name</span><input value={newSection.section} maxLength={20} onChange={(e) => setNewSection({ ...newSection, section: e.target.value })} placeholder="For example: A" /></label>
                <label><span>Teacher</span>
                  <select value={newSection.teacherId} onChange={(e) => setNewSection({ ...newSection, teacherId: e.target.value })} disabled={teachers === null}>
                    <option value="">{teachers === null ? "Loading teachers…" : departmentTeachers.length ? "Select teacher" : "No teachers in this department"}</option>
                    {departmentTeachers.map((t) => <option key={t._id} value={t._id}>{t.userId?.name || "Unknown teacher"} ({t.employeeId})</option>)}
                  </select>
                </label>
                <div className="enr-add-buttons">
                  <button type="button" className="enr-btn" onClick={() => setAddingSection(false)} disabled={busy}>Cancel</button>
                  <button type="button" className="enr-btn enr-btn-primary" onClick={createSection} disabled={busy || !newSection.section.trim() || !newSection.teacherId}>{busy ? "Adding…" : "Add section"}</button>
                </div>
              </div>
            )}
        </Step>
      )}

      {course && sections.length > 0 && (
        <Step number={3} title="Upload the class list" done={step3Done} hint="An Excel file with a Roll Number and a Section for every student. Name and Email are shown for checking only.">
          <div className={`enr-drop ${dragging ? "is-over" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            <span className="enr-drop-icon"><UploadIcon /></span>
            <div>
              <label htmlFor="enr-file" className="enr-drop-label">Choose an Excel file</label>
              <span> or drop it here</span>
              <input id="enr-file" type="file" accept=".xlsx,.xls" disabled={busy} onChange={(e) => { readFile(e.target.files[0]); e.target.value = ""; }} />
            </div>
            <button type="button" className="enr-link" onClick={downloadTemplate} disabled={busy}>Download the template</button>
          </div>

          {sheet && (
            <div className="enr-file-chip"><FileIcon /><span>{sheet.fileName}</span>
              <button type="button" className="enr-link" onClick={() => setSheet(null)} disabled={busy}>Remove</button>
            </div>
          )}

          {sheet && !sheet.parsed.usable && (
            <div className="enr-banner bad" role="alert"><AlertIcon />
              <div>
                {sheet.parsed.columns.missing.length > 0
                  ? <p>We couldn't find a {sheet.parsed.columns.missing.map((name, index) => <React.Fragment key={name}>{index > 0 && " and a "}<strong>{name}</strong></React.Fragment>)} column in this file. The columns we found are: {sheet.parsed.columns.found.join(", ") || "none"}. Download the template to see the layout.</p>
                  : <p>This file has no students in it.</p>}
              </div>
            </div>
          )}

          {sheet?.parsed.usable && (
            <div className="enr-preview">
              <div className="enr-preview-head">
                <h3>{students.length} student{students.length === 1 ? "" : "s"}</h3>
                <div className="enr-chips">
                  {sheet.parsed.sections.map((s) => <span key={s.name} className={`enr-chip ${unknownSections.includes(s.name) ? "bad" : ""}`}>Section {s.name} · {s.count}</span>)}
                  {dataProblems > 0 && <span className="enr-chip bad">{dataProblems} row{dataProblems === 1 ? "" : "s"} with a problem</span>}
                </div>
              </div>

              {unknownSections.length > 0 && (
                <div className="enr-banner warn" role="alert"><AlertIcon />
                  <div>
                    <p>{unknownSections.length === 1 ? "Section" : "Sections"} <strong>{unknownSections.join(", ")}</strong> {unknownSections.length === 1 ? "does" : "do"} not exist for {course.name} in {termLabel || "this term"}. Add {unknownSections.length === 1 ? "it" : "them"} first, then upload again or continue.</p>
                    <button type="button" className="enr-btn" onClick={() => openAddSection(unknownSections[0])}>Add section {unknownSections[0]}</button>
                  </div>
                </div>
              )}
              {dataProblems > 0 && (
                <div className="enr-banner warn" role="alert"><AlertIcon />
                  <div><p>Fix these rows in your file and upload it again, or leave them out of this enrolment.</p>
                    <button type="button" className="enr-btn" onClick={removeProblemRows}>Leave out the {dataProblems} row{dataProblems === 1 ? "" : "s"} with a problem</button>
                  </div>
                </div>
              )}

              <div className="enr-table-wrap">
                <table className="enr-table">
                  <thead><tr><th>Row</th><th>Roll number</th><th>Name</th><th>Email</th><th>Section</th><th>Check</th></tr></thead>
                  <tbody>
                    {students.map((s) => {
                      const unknown = s.section && unknownSections.includes(s.section);
                      const bad = s.issues.length > 0 || unknown;
                      return (
                        <tr key={s.line} className={bad ? "has-problem" : ""}>
                          <td className="enr-row-n">{s.line}</td>
                          <td>{s.rollNumber || <em>missing</em>}</td>
                          <td>{s.name || <span className="enr-muted">–</span>}</td>
                          <td>{s.email || <span className="enr-muted">–</span>}</td>
                          <td>{s.section || <em>missing</em>}</td>
                          <td>
                            {!bad && <span className="enr-ok"><CheckIcon /> OK</span>}
                            {s.issues.map((code) => <span key={code} className="enr-issue">{ISSUES[code]}{code === "DUPLICATE_ROLL" ? ` (first on row ${s.firstLine})` : ""}</span>)}
                            {unknown && <span className="enr-issue">Section does not exist yet</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Step>
      )}

      {course && sheet?.parsed.usable && (
        <Step number={4} title="Check and enroll" done={false} hint="Each student is checked against the course's rules before anyone is enrolled.">
          {term?._id && semester !== "" && dataProblems === 0 && (
            <EligibilityPreview apiUrl={API} courseId={course._id} semester={semester} academicYear={term._id} students={students} headers={headers()} />
          )}
          {busy && <div className="enr-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${progress}%` }} /><span>{progress}%</span></div>}
          <div className="enr-enroll">
            <p>{canEnroll ? `Ready to enroll ${students.length} student${students.length === 1 ? "" : "s"} in ${course.name}.` : dataProblems > 0 ? "Fix or leave out the rows with a problem to continue." : unknownSections.length > 0 ? "Add the missing sections to continue." : "Working…"}</p>
            <button type="button" className="enr-btn enr-btn-primary enr-btn-lg" onClick={enroll} disabled={!canEnroll}>{busy ? "Enrolling…" : `Enroll ${students.length} student${students.length === 1 ? "" : "s"}`}</button>
          </div>
        </Step>
      )}

      <EnrollmentHistory apiUrl={API} headers={headers} refreshKey={historyKey} />
    </div>
  );
};

export default CourseRegistrationPage;
