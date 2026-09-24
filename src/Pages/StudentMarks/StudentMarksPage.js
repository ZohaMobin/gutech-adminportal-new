import Loading from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useDepartmentsAndPrograms } from "../../hooks/useDepartmentsAndPrograms";
import { semesters } from "../../config/academicConfig";
import { formatSectionOptionLabel } from "../../utils/sectionTeachers";
import "./StudentMarksPage.css";

const getPerformanceClass = (percentage) => {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return "missing";
  if (percentage >= 80) return "strong";
  if (percentage >= 70) return "good";
  if (percentage >= 50) return "watch";
  return "risk";
};

// A section with nobody enrolled, or nothing published yet, is a normal state, not a failure: the server answers 404 with
// one of these codes, and the page explains it instead of showing an error (and the raw section id).
const EMPTY_SECTION = {
  NO_STUDENTS_IN_SECTION: { title: "No students are enrolled in this section yet", hint: "Marks will appear here once students are registered in it." },
  NO_ASSESSMENTS_IN_SECTION: { title: "No assessments have been published for this section", hint: "The teacher's assessments show up here once they are published." },
};

const getTermDisplayName = (term) => {
  if (!term) return "Select academic term";
  return term.displayName || `${term.semesterType} ${term.year}`;
};

const getTermStatusLabel = (status) => {
  if (status === "active") return "Active";
  if (status === "upcoming") return "Upcoming";
  if (status === "closed") return "Closed";
  if (status === "archived") return "Archived";
  if (status === "completed") return "Closed";
  return status || "Unknown";
};

const StudentMarksPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [academicTerms, setAcademicTerms] = useState([]);
  const [marksMeta, setMarksMeta] = useState({
    assessments: [],
    courseWeightage: 0,
    bonusWeightage: 0,
  });
  const [filters, setFilters] = useState({
    department: "",
    program: "",
    academicYearId: "",
    semester: "",
    course: "",
    section: "",
  });
  const [availableFilters, setAvailableFilters] = useState({
    courses: [],
    sections: [],
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [emptyReason, setEmptyReason] = useState(null);

  const getAuthToken = () => sessionStorage.getItem("adminToken");

  const requestHeaders = () => ({
    "x-auth-token": getAuthToken(),
    Authorization: `Bearer ${getAuthToken()}`,
  });

  useEffect(() => {
    const fetchAcademicTerms = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`${apiUrl}/api/academic-years?includeInactive=true`, {
          headers: requestHeaders(),
        });

        const terms = Array.isArray(response.data) ? response.data : [];
        setAcademicTerms(terms);

        const activeTerm = terms.find((term) => term.status === "active" || term.isCurrent);
        const initialTerm = activeTerm || terms[0];
        if (initialTerm) {
          setFilters((prev) => ({ ...prev, academicYearId: initialTerm._id }));
        }
      } catch (err) {
        setError("Failed to load academic terms. Please try again.");
        console.error("Error loading academic terms:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAcademicTerms();
  }, [apiUrl]);

  useEffect(() => {
    const fetchCourses = async () => {
      if (!filters.academicYearId || !filters.department || !filters.program || !filters.semester) {
        setAvailableFilters((prev) => ({ ...prev, courses: [], sections: [] }));
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const courseRes = await axios.get(`${apiUrl}/api/course-offerings`, {
          params: {
            academicYearId: filters.academicYearId,
            isActive: true,
          },
          headers: requestHeaders(),
        });

        const offerings = Array.isArray(courseRes.data) ? courseRes.data : [];
        const filteredCourses = offerings
          .filter((offering) => {
            const departmentId = offering.department?._id || offering.department;
            const programId = offering.program?._id || offering.program;
            return (
              String(departmentId) === String(filters.department) &&
              String(programId) === String(filters.program) &&
              Number(offering.semester) === Number(filters.semester)
            );
          })
          .map((offering) => ({
            ...(offering.courseId || {}),
            offeringId: offering._id,
          }))
          .filter((course) => course._id);

        setAvailableFilters((prev) => ({ ...prev, courses: filteredCourses, sections: [] }));
      } catch (err) {
        setError("Failed to load courses. Please try again.");
        console.error("Error loading courses:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [filters.academicYearId, filters.department, filters.program, filters.semester, apiUrl]);

  useEffect(() => {
    const fetchSections = async () => {
      if (!filters.course) return;

      try {
        setLoading(true);
        setError(null);
        const sectionRes = await axios.get(`${apiUrl}/api/sections/course-enrollment/${filters.course}`, {
          params: {
            academicYearId: filters.academicYearId,
          },
          headers: requestHeaders(),
        });
        setAvailableFilters((prev) => ({
          ...prev,
          sections: sectionRes.data.sections || [],
        }));
      } catch (err) {
        setError("Failed to load sections. Please try again.");
        console.error("Error loading sections:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [filters.academicYearId, filters.course, apiUrl]);

  useEffect(() => {
    const fetchMarksData = async () => {
      if (!filters.academicYearId || !filters.department || !filters.program || !filters.semester || !filters.course || !filters.section) {
        setMarksData([]);
        setMarksMeta({ assessments: [], courseWeightage: 0, bonusWeightage: 0 });
        return;
      }

      setLoading(true);
      setError(null);
      setEmptyReason(null);
      try {
        const response = await axios.get(`${apiUrl}/api/student-marks`, {
          params: filters,
          headers: requestHeaders(),
        });
        setMarksData(response.data.data || []);
        setMarksMeta({
          assessments: response.data.meta?.assessments || [],
          courseWeightage: response.data.meta?.courseWeightage || 0,
          bonusWeightage: response.data.meta?.bonusWeightage || 0,
        });
      } catch (err) {
        const code = err.response?.data?.error;
        if (err.response?.status === 404 && EMPTY_SECTION[code]) {
          setEmptyReason(code);
        } else {
          setError(err.response?.data?.message || "Failed to load marks data. Please try again.");
          console.error("Error loading marks data:", err);
        }
        setMarksData([]);
        setMarksMeta({ assessments: [], courseWeightage: 0, bonusWeightage: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchMarksData();
  }, [filters.academicYearId, filters.department, filters.program, filters.semester, filters.course, filters.section, apiUrl]);

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
      ...(filterType === "academicYearId" && { department: "", program: "", semester: "", course: "", section: "" }),
      ...(filterType === "department" && { program: "", semester: "", course: "", section: "" }),
      ...(filterType === "program" && { semester: "", course: "", section: "" }),
      ...(filterType === "semester" && { course: "", section: "" }),
      ...(filterType === "course" && { section: "" }),
    }));
  };

  const clearFilters = () => {
    setFilters({
      department: "",
      program: "",
      academicYearId: academicTerms.find((term) => term.status === "active" || term.isCurrent)?._id || academicTerms[0]?._id || "",
      semester: "",
      course: "",
      section: "",
    });
    setError(null);
    setMarksData([]);
    setMarksMeta({ assessments: [], courseWeightage: 0, bonusWeightage: 0 });
  };

  const assessments = marksMeta.assessments || [];
  const courseWeightage = marksMeta.courseWeightage || 0;

  const filteredMarksData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return marksData;
    return marksData.filter(
      (student) =>
        (student.name || "").toLowerCase().includes(query) ||
        (student.rollNumber || "").toLowerCase().includes(query)
    );
  }, [marksData, searchQuery]);

  const gradebookRows = useMemo(() => {
    return filteredMarksData.map((student) => {
      const studentAssessments =
        student.assessments ||
        (student.assessmentTypes || []).flatMap((type) => type.assessments || []);

      const byId = Object.fromEntries(studentAssessments.map((a) => [String(a.id), a]));

      const cells = assessments.map((assessment) => {
        const mark = byId[String(assessment.id)];
        const obtained = mark?.obtainedMarks;
        const hasMark = mark?.hasMark ?? (obtained !== null && obtained !== undefined);
        const weightedScore =
          mark?.weightedScore ??
          (hasMark && assessment.maxMarks > 0
            ? (Number(obtained) / assessment.maxMarks) * assessment.weightage
            : null);
        return {
          assessmentId: assessment.id,
          obtainedMarks: hasMark ? obtained : null,
          weightedScore,
          hasMark,
        };
      });

      const weightedTotal =
        student.weightedTotal ??
        cells.reduce((sum, cell) => sum + (cell.weightedScore || 0), 0);
      const percentage =
        student.percentage ??
        (courseWeightage > 0 ? Math.min(100, (weightedTotal / courseWeightage) * 100) : null);
      const missingMarks =
        student.missingMarks ?? cells.filter((cell) => !cell.hasMark).length;

      return {
        ...student,
        cells,
        weightedTotal,
        percentage,
        missingMarks,
        // The letter is worked out by the server, from the one grading scale.
        estimatedGrade: percentage == null ? "N/A" : student.estimatedGrade || "N/A",
        performanceClass: getPerformanceClass(percentage),
      };
    });
  }, [filteredMarksData, assessments, courseWeightage]);

  const summary = useMemo(() => {
    // Exclude students with grand total 0 from class average
    const scored = gradebookRows.filter(
      (row) => row.percentage != null && Number(row.weightedTotal) > 0
    );
    const classAverage =
      scored.length > 0 ? scored.reduce((sum, row) => sum + row.percentage, 0) / scored.length : 0;
    const missingMarks = gradebookRows.reduce((sum, row) => sum + (row.missingMarks || 0), 0);
    const failingCount = gradebookRows.filter((row) => row.estimatedGrade === "F").length;

    return {
      classAverage,
      studentCount: gradebookRows.length,
      missingMarks,
      failingCount,
    };
  }, [gradebookRows]);

  const selectedCourse = availableFilters.courses.find((c) => c._id === filters.course);
  const selectedSection = availableFilters.sections.find((s) => s.id === filters.section);
  const filtersComplete = Boolean(
    filters.academicYearId && filters.department && filters.program && filters.semester && filters.course && filters.section
  );

  return (
    <div className="student-marks-container page-shell">
      <PageHeader
        title="Student Marks"
        subtitle="Review a section's gradebook. Marks are read-only here; teachers enter them."
      />

      {error && (
        <div className="error-message" role="alert">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="dismiss-error-btn">
            Dismiss
          </button>
        </div>
      )}

      <section className="marks-filters" aria-label="Choose a section">
        <label htmlFor="marks-academic-term">
          <span>Term</span>
          <select
            id="marks-academic-term"
            value={filters.academicYearId}
            onChange={(e) => handleFilterChange("academicYearId", e.target.value)}
            disabled={academicTerms.length === 0}
          >
            <option value="">Select term</option>
            {academicTerms.map((term) => (
              <option key={term._id} value={term._id}>
                {getTermDisplayName(term)} ({getTermStatusLabel(term.status)})
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="department">
          <span>Department</span>
          <select
            id="department"
            value={filters.department}
            onChange={(e) => handleFilterChange("department", e.target.value)}
            disabled={!filters.academicYearId || deptProgLoading}
          >
            <option value="">Select department</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="program">
          <span>Program</span>
          <select
            id="program"
            value={filters.program}
            onChange={(e) => handleFilterChange("program", e.target.value)}
            disabled={!filters.academicYearId || !filters.department || deptProgLoading}
          >
            <option value="">Select program</option>
            {programs.map((prog) => (
              <option key={prog._id} value={prog._id}>
                {prog.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="semester">
          <span>Semester</span>
          <select
            id="semester"
            value={filters.semester}
            onChange={(e) => handleFilterChange("semester", e.target.value)}
            disabled={!filters.academicYearId || !filters.program}
          >
            <option value="">Select semester</option>
            {semesters.map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="course">
          <span>Course</span>
          <select
            id="course"
            value={filters.course}
            onChange={(e) => handleFilterChange("course", e.target.value)}
            disabled={!filters.semester || loading}
          >
            <option value="">Select course</option>
            {availableFilters.courses.map((course) => (
              <option key={course._id} value={course._id}>
                {course.code ? `${course.code}: ${course.name}` : course.name}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="section">
          <span>Section</span>
          <select
            id="section"
            value={filters.section}
            onChange={(e) => handleFilterChange("section", e.target.value)}
            disabled={!filters.course || loading}
          >
            <option value="">Select section</option>
            {availableFilters.sections.map((section) => (
              <option key={section.id} value={section.id}>
                {formatSectionOptionLabel(section)}
              </option>
            ))}
          </select>
        </label>

        <button type="button" className="clear-filters-btn" onClick={clearFilters}>
          Clear
        </button>
      </section>

      <div className="marks-table-section">
        {filtersComplete && (
          <div className="workspace-header">
            <div>
              <p className="workspace-eyebrow">Gradebook Overview</p>
              <h2>
                {selectedCourse?.name || "Course"}
                {selectedSection ? ` — Section ${selectedSection.section}` : ""}
              </h2>
            </div>
            {!emptyReason && !error && (
            <div className="workspace-search">
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            )}
          </div>
        )}

        {filtersComplete && !loading && !error && gradebookRows.length > 0 && (
          <div className="workspace-summary-grid">
            <div className="workspace-summary-card">
              <span>Class Average</span>
              <strong>{summary.classAverage.toFixed(1)}%</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Weightage Covered</span>
              <strong className={courseWeightage > 100 ? "summary-warning" : ""}>
                {courseWeightage} / 100
              </strong>
            </div>
            <div className="workspace-summary-card">
              <span>Students with F</span>
              <strong className={summary.failingCount ? "summary-warning" : ""}>
                {summary.failingCount}
              </strong>
            </div>
            <div className="workspace-summary-card">
              <span>Students</span>
              <strong>{summary.studentCount}</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Missing Marks</span>
              <strong className={summary.missingMarks ? "summary-warning" : ""}>
                {summary.missingMarks}
              </strong>
            </div>
          </div>
        )}

        <div className="table-container">
          {loading ? (
            <Loading variant="table" rows={8} label="Loading marks" />
          ) : !filtersComplete ? (
            <div className="no-data-container">
              <p className="marks-empty-title">Pick a section to see its gradebook</p>
              <p>Choose a term, department, program, semester, course and section above.</p>
            </div>
          ) : error ? (
            <div className="no-data-container">
              <p className="marks-empty-title">This gradebook could not be loaded</p>
              <p>The reason is shown above. Choose the section again to retry.</p>
            </div>
          ) : emptyReason ? (
            <div className="no-data-container">
              <p className="marks-empty-title">{EMPTY_SECTION[emptyReason].title}</p>
              <p>{EMPTY_SECTION[emptyReason].hint}</p>
            </div>
          ) : gradebookRows.length === 0 ? (
            <div className="no-data-container">
              <p>No marks data found for this section.</p>
            </div>
          ) : (
            <div className="gradebook-table-shell">
              <table className="gradebook-table">
                <thead>
                  <tr>
                    <th className="sticky-col roll-col" rowSpan="2">
                      Roll No
                    </th>
                    <th className="sticky-col name-col" rowSpan="2">
                      Student Name
                    </th>
                    {assessments.map((assessment) => (
                      <React.Fragment key={assessment.id}>
                        <th className={assessment.isBonus ? "bonus-col-header" : undefined}>
                          {assessment.title} Marks
                          {assessment.isBonus ? <span className="bonus-pill">Bonus</span> : null}
                        </th>
                        <th
                          className={`weighted-header${assessment.isBonus ? " bonus-col-header" : ""}`}
                        >
                          {assessment.title} Weighted
                        </th>
                      </React.Fragment>
                    ))}
                    <th className="total-header" rowSpan="2">
                      Total
                    </th>
                    <th className="grade-header" rowSpan="2">
                      Estimated Grade
                    </th>
                  </tr>
                  <tr>
                    {assessments.map((assessment) => (
                      <React.Fragment key={`${assessment.id}-meta`}>
                        <th className={`meta-header${assessment.isBonus ? " bonus-col-header" : ""}`}>
                          Total Marks: {assessment.maxMarks}
                        </th>
                        <th
                          className={`meta-header weighted-meta${
                            assessment.isBonus ? " bonus-col-header" : ""
                          }`}
                        >
                          {assessment.isBonus
                            ? `Bonus: +${assessment.weightage}%`
                            : `Weightage: ${assessment.weightage}%`}
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradebookRows.map((student) => (
                    <tr key={student.id}>
                      <td className="sticky-col roll-col">{student.rollNumber || "-"}</td>
                      <td className="sticky-col name-col">{student.name || "Unnamed Student"}</td>
                      {student.cells.map((cell) => (
                        <React.Fragment key={`${student.id}-${cell.assessmentId}`}>
                          <td className={`marks-entry-cell ${!cell.hasMark ? "missing" : ""}`}>
                            {cell.hasMark ? Number(cell.obtainedMarks).toFixed(2) : "—"}
                          </td>
                          <td className="weighted-cell">
                            <strong>
                              {cell.weightedScore == null ? "—" : cell.weightedScore.toFixed(2)}
                            </strong>
                            <span>
                              /{" "}
                              {assessments.find((a) => String(a.id) === String(cell.assessmentId))
                                ?.weightage || 0}
                            </span>
                          </td>
                        </React.Fragment>
                      ))}
                      <td className={`total-cell ${student.performanceClass}`}>
                        <strong>{student.weightedTotal.toFixed(2)}</strong>
                        <span>/ {courseWeightage || 0}</span>
                      </td>
                      <td className={`grade-cell ${student.performanceClass}`}>
                        <span className="grade-chip">{student.estimatedGrade}</span>
                        {student.percentage != null && (
                          <span className="grade-pct">{student.percentage.toFixed(1)}%</span>
                        )}
                        {student.bonusCapped && (
                          <span className="grade-pct" title="Bonus took this student above 100. Students see 100%.">capped at 100%</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtersComplete && gradebookRows.length > 0 && (
          <div className="legend-row">
            <span className="legend-item strong">≥80% Strong</span>
            <span className="legend-item good">70–79% Good</span>
            <span className="legend-item watch">50–69% Watch</span>
            <span className="legend-item risk">&lt;50% Risk</span>
            <span className="legend-item missing">— Missing</span>
            <span className="legend-note">Bonus assessments add points without increasing course weightage.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentMarksPage;
