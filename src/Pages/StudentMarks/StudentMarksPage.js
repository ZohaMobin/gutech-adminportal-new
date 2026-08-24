import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useDepartmentsAndPrograms } from "../../hooks/useDepartmentsAndPrograms";
import { semesters } from "../../config/academicConfig";
import { getEstimatedGrade } from "../../utils/gradingScale";
import { formatSectionOptionLabel } from "../../utils/sectionTeachers";
import "./StudentMarksPage.css";

const getPerformanceClass = (percentage) => {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) return "missing";
  if (percentage >= 80) return "strong";
  if (percentage >= 70) return "good";
  if (percentage >= 50) return "watch";
  return "risk";
};

const StudentMarksPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL || "http://localhost:5001";
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [marksMeta, setMarksMeta] = useState({
    assessments: [],
    courseWeightage: 0,
    bonusWeightage: 0,
  });
  const [filters, setFilters] = useState({
    department: "",
    program: "",
    semester: "",
    course: "",
    section: "",
  });
  const [availableFilters, setAvailableFilters] = useState({
    courses: [],
    sections: [],
  });
  const [showHelp, setShowHelp] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const getAuthToken = () => sessionStorage.getItem("adminToken");

  useEffect(() => {
    const fetchCourses = async () => {
      if (!filters.department || !filters.program || !filters.semester) return;

      try {
        setLoading(true);
        setError(null);
        const courseRes = await axios.get(
          `${apiUrl}/api/courses/department/${encodeURIComponent(filters.department)}/program/${encodeURIComponent(filters.program)}/semester/${filters.semester}`,
          { headers: { "x-auth-token": getAuthToken() } }
        );
        setAvailableFilters((prev) => ({ ...prev, courses: courseRes.data }));
      } catch (err) {
        setError("Failed to load courses. Please try again.");
        console.error("Error loading courses:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [filters.department, filters.program, filters.semester, apiUrl]);

  useEffect(() => {
    const fetchSections = async () => {
      if (!filters.course) return;

      try {
        setLoading(true);
        setError(null);
        const sectionRes = await axios.get(`${apiUrl}/api/sections/course-enrollment/${filters.course}`, {
          headers: { "x-auth-token": getAuthToken() },
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
  }, [filters.course, apiUrl]);

  useEffect(() => {
    const fetchMarksData = async () => {
      if (!filters.department || !filters.program || !filters.semester || !filters.course || !filters.section) {
        setMarksData([]);
        setMarksMeta({ assessments: [], courseWeightage: 0, bonusWeightage: 0 });
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${apiUrl}/api/student-marks`, {
          params: filters,
          headers: { "x-auth-token": getAuthToken() },
        });
        setMarksData(response.data.data || []);
        setMarksMeta({
          assessments: response.data.meta?.assessments || [],
          courseWeightage: response.data.meta?.courseWeightage || 0,
          bonusWeightage: response.data.meta?.bonusWeightage || 0,
        });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load marks data. Please try again.");
        console.error("Error loading marks data:", err);
        setMarksData([]);
        setMarksMeta({ assessments: [], courseWeightage: 0, bonusWeightage: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchMarksData();
  }, [filters.department, filters.program, filters.semester, filters.course, filters.section, apiUrl]);

  const handleFilterChange = (filterType, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value,
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
        estimatedGrade: percentage == null ? "N/A" : getEstimatedGrade(percentage),
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
    filters.department && filters.program && filters.semester && filters.course && filters.section
  );

  return (
    <div className="student-marks-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Student Marks</h1>
          <p>Section-level oversight of obtained marks, weighted scores, and estimated grades</p>
        </div>
      </div>

      {showHelp && (
        <div className="help-text">
          <p>
            Select Department → Program → Semester → Course → Section. Marks are read-only here;
            teachers enter them. Bonus assessments add points without increasing course weightage.
          </p>
          <button className="close-help" onClick={() => setShowHelp(false)} aria-label="Close help text">
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="dismiss-error-btn">
            Dismiss
          </button>
        </div>
      )}

      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              value={filters.department}
              onChange={(e) => handleFilterChange("department", e.target.value)}
              disabled={deptProgLoading}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="program">Program</label>
            <select
              id="program"
              value={filters.program}
              onChange={(e) => handleFilterChange("program", e.target.value)}
              disabled={!filters.department || deptProgLoading}
            >
              <option value="">Select Program</option>
              {programs.map((prog) => (
                <option key={prog._id} value={prog._id}>
                  {prog.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="semester">Semester</label>
            <select
              id="semester"
              value={filters.semester}
              onChange={(e) => handleFilterChange("semester", e.target.value)}
              disabled={!filters.program}
            >
              <option value="">Select Semester</option>
              {semesters.map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="course">Course</label>
            <select
              id="course"
              value={filters.course}
              onChange={(e) => handleFilterChange("course", e.target.value)}
              disabled={!filters.semester || loading}
            >
              <option value="">Select Course</option>
              {availableFilters.courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.code ? `${course.code}: ${course.name}` : course.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="section">Section</label>
            <select
              id="section"
              value={filters.section}
              onChange={(e) => handleFilterChange("section", e.target.value)}
              disabled={!filters.course || loading}
            >
              <option value="">Select Section</option>
              {availableFilters.sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {formatSectionOptionLabel(section)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="clear-filters-btn" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

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
            <div className="workspace-search">
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
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
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading marks data...</p>
            </div>
          ) : !filtersComplete ? (
            <div className="no-data-container">
              <p>Select all filters to view the section gradebook.</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p>{error}</p>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentMarksPage;
