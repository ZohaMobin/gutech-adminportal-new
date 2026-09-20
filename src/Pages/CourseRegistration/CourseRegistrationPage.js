import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useDepartmentsAndPrograms } from "../../hooks/useDepartmentsAndPrograms";
import "./CourseRegistrationPage.css";
import NoResultsFound from "../../Components/NoResultsFound";
import { formatSectionTeachers } from "../../utils/sectionTeachers";

const CourseRegistrationPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedProgram, setSelectedProgram] = useState("");
  const [availableSemesters, setAvailableSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [failures, setFailures] = useState([]); // [{ student, reason }] from the last registration run
  const [progress, setProgress] = useState(0);
  const [existingSections, setExistingSections] = useState([]);
  const [loadingSections, setLoadingSections] = useState(false);
  const [teachers, setTeachers] = useState([]);
  const [newSection, setNewSection] = useState({ section: "", teacherId: "" });
  const [activeAcademicTerm, setActiveAcademicTerm] = useState(null);

  const getAuthToken = () => sessionStorage.getItem("adminToken") || sessionStorage.getItem("token");
  const requestHeaders = () => ({ "x-auth-token": getAuthToken(), Authorization: `Bearer ${getAuthToken()}` });

  useEffect(() => {
    const fetchActiveAcademicTerm = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/academic-years/current`, {
          headers: requestHeaders(),
        });
        setActiveAcademicTerm(response.data);
      } catch (err) {
        setActiveAcademicTerm(null);
        setError(err.response?.data?.message || "No active academic term is configured");
      }
    };

    fetchActiveAcademicTerm();
  }, [apiUrl]);

  // Fetch semesters when program is selected
  useEffect(() => {
    const fetchSemesters = async () => {
      if (selectedProgram) {
        try {
          const response = await axios.get(`${apiUrl}/api/student-directory/semesters`, {
            params: { program: selectedProgram },
          });
          setAvailableSemesters(response.data.semesters || []);
        } catch (err) {
          setAvailableSemesters([]);
        }
      } else {
        setAvailableSemesters([]);
      }
    };
    fetchSemesters();
  }, [selectedProgram, apiUrl]);

  useEffect(() => {
    if (selectedDepartment && selectedProgram && selectedSemester) {
      fetchCourses();
      fetchTeachers();
    }
  }, [selectedDepartment, selectedProgram, selectedSemester, activeAcademicTerm]);

  useEffect(() => {
    if (selectedCourse) {
      fetchExistingSections();
    } else {
      setExistingSections([]);
    }
  }, [selectedCourse, activeAcademicTerm]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      if (!activeAcademicTerm?._id) {
        setCourses([]);
        setError("No active academic term is configured");
        return;
      }

      const response = await axios.get(`${apiUrl}/api/course-offerings`, {
        params: {
          academicYearId: activeAcademicTerm._id,
          isActive: true,
        },
        headers: requestHeaders(),
      });
      const offerings = Array.isArray(response.data) ? response.data : [];
      const scopedCourses = offerings
        .filter((offering) => {
          const departmentId = offering.department?._id || offering.department;
          const programId = offering.program?._id || offering.program;
          return (
            String(departmentId) === String(selectedDepartment) &&
            String(programId) === String(selectedProgram) &&
            Number(offering.semester) === Number(selectedSemester)
          );
        })
        .map((offering) => ({
          ...(offering.courseId || {}),
          offeringId: offering._id,
        }))
        .filter((course) => course._id);

      setCourses(scopedCourses);
    } catch (error) {
      setError("Error fetching courses: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingSections = async () => {
    if (!selectedCourse) return;

    try {
      setLoadingSections(true);
      const response = await axios.get(`${apiUrl}/api/sections/course/${selectedCourse._id}`, {
        params: { academicYearId: activeAcademicTerm?._id },
        headers: requestHeaders(),
      });
      setExistingSections(response.data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setExistingSections([]);
    } finally {
      setLoadingSections(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/teachers`, {
        headers: requestHeaders(),
      });
      const filteredTeachers = response.data.filter((teacher) => {
        const teacherDeptId = teacher.department?._id || teacher.department;
        return teacherDeptId === selectedDepartment;
      });
      setTeachers(filteredTeachers);
    } catch (err) {
      setError("Failed to fetch teachers: " + err.message);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      readExcelFile(file);
    }
  };

  const readExcelFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);


        setPreview(jsonData);
      } catch (error) {
        setError("Error reading Excel file: " + error.message);
        setPreview([]);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        rollNumber: "2023001",
        name: "Ali Ahmad",
        email: "aliahmad@agu.edu.pk",
        section: "A",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "student_registration_template.xlsx");
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!activeAcademicTerm?._id) {
      setError("No active academic term is configured");
      return;
    }

    if (!selectedCourse || !file || preview.length === 0) {
      setError("Please select a course and upload a valid Excel file with student data");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setFailures([]);

      // A section must exist (with a teacher) before students can be placed in it.
      // Check first so the admin gets one clear message instead of a failure per student.
      const normalize = (name) => String(name ?? "").trim().toLowerCase();
      const known = new Set(existingSections.map((sec) => normalize(sec.section)));
      const missing = [...new Set(preview.map((row) => String(row.section ?? "").trim()))].filter((name) => !known.has(normalize(name)));
      if (missing.length > 0) {
        const label = missing.map((name) => name || "(blank)").join(", ");
        setError(
          `${missing.length === 1 ? "Section" : "Sections"} ${label} ${missing.length === 1 ? "does" : "do"} not exist for ${selectedCourse.name} in the active term. ` +
            `Create ${missing.length === 1 ? "it" : "them"} first in the "Create Section" form below (a teacher is required), then upload again.`
        );
        return;
      }

      setLoading(true);
      setProgress(0);

      const token = getAuthToken();

      // Process students in batches
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < preview.length; i += batchSize) {
        batches.push(preview.slice(i, i + batchSize));
      }

      let registeredCount = 0;
      let failedRegistrations = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        // Register students in the current batch
        await Promise.all(
          batch.map(async (student) => {
            try {
              // Get or create section
              let sectionResponse;
              try {
                sectionResponse = await axios.get(`${apiUrl}/api/sections/course/${selectedCourse._id}/section/${student.section}`, { headers: { "x-auth-token": token } });
              } catch (error) {
                if (error.response && error.response.status === 404) {
                  failedRegistrations.push({ student: student.rollNumber, row: student, error: `Section ${student.section} does not exist` });
                  return;
                }
                throw error;
              }

              if (!sectionResponse.data) {
                console.error(`Section ${student.section} not found for student ${student.rollNumber}`);
                failedRegistrations.push({ student: student.rollNumber, row: student, error: "Section not found" });
                return;
              }

              await axios.post(
                `${apiUrl}/api/course-registrations/register`,
                {
                  studentId: student.rollNumber,
                  courseId: selectedCourse._id,
                  sectionId: sectionResponse.data._id,
                  semester: parseInt(selectedSemester),
                  academicYear: activeAcademicTerm?._id,
                },
                {
                  headers: {
                    "Content-Type": "application/json",
                    "x-auth-token": token,
                  },
                }
              );

              registeredCount++;
            } catch (error) {
              console.error(`Error registering student ${student.rollNumber}:`, error);
              const status = error.response?.status;
              const reason =
                error.response?.data?.message ||
                (status === 401 || status === 403 ? "You are not allowed to register students (please log in again)" : null) ||
                (error.response ? `Registration failed (${status})` : "Could not reach the server");
              failedRegistrations.push({ student: student.rollNumber, row: student, error: reason });
            }
          })
        );

        // Update progress
        const percentCompleted = Math.round(((i + 1) / batches.length) * 100);
        setProgress(percentCompleted);
      }

      if (registeredCount > 0) {
        setSuccess(`Registered ${registeredCount} of ${preview.length} students for ${selectedCourse.name}.`);
      }
      if (failedRegistrations.length > 0) {
        setError(
          registeredCount === 0
            ? `No students were registered. ${failedRegistrations.length} failed:`
            : `${failedRegistrations.length} student${failedRegistrations.length === 1 ? "" : "s"} could not be registered:`
        );
        setFailures(failedRegistrations.map((f) => ({ student: f.student, reason: f.error })));
        // Keep only the failed rows so a retry does not touch students who already succeeded.
        setPreview(failedRegistrations.map((f) => f.row));
      } else {
        setFile(null);
        setPreview([]);
        setSelectedCourse(null);
        setExistingSections([]);
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.response?.data?.message || "Error registering students");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSection = async () => {
    if (!selectedCourse || !newSection.section || !newSection.teacherId) {
      setError("Please select a course, enter section name, and select a teacher");
      return;
    }

    try {
      setLoading(true);
      const token = getAuthToken();

      await axios.post(
        `${apiUrl}/api/sections/course/${selectedCourse._id}/section/${newSection.section}`,
        {
          teacherId: newSection.teacherId,
        },
        {
          headers: { "x-auth-token": token },
        }
      );

      setSuccess("Section created successfully");
      setNewSection({ section: "", teacherId: "" });
      fetchExistingSections();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create section");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="course-registration-container">
      <div className="page-header">
        <h2>Course Registration</h2>
        <p className="header-description">Browse and register for available courses. Use the filters below to find specific courses by semester, department, or program.</p>
      </div>

      {error && (
        <div className="error-message" role="alert">
          {error}
          {failures.length > 0 && (
            <ul className="failure-list">
              {failures.map((f, index) => (
                <li key={`${f.student}-${index}`}>
                  <strong>{f.student}</strong>: {f.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {success && <div className="success-message">{success}</div>}

      <div className="filters">
        <div className="form-group">
          <label>Department</label>
          <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} disabled={deptProgLoading}>
            <option value="">Select Department</option>
            {departments.map((dept) => (
              <option key={dept._id} value={dept._id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Program</label>
          <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} disabled={deptProgLoading}>
            <option value="">Select Program</option>
            {programs.map((prog) => (
              <option key={prog._id} value={prog._id}>
                {prog.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Semester</label>
          <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} disabled={!selectedProgram || availableSemesters.length === 0}>
            <option value="">Select Semester</option>
            {availableSemesters.map((sem) => (
              <option key={sem} value={sem}>
                Semester {sem}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="loading">Loading courses...</div>}

      {!loading && courses.length === 0 && (
        <NoResultsFound
          title="No Courses Found"
          message="No courses match your current filter criteria. Try adjusting your filters or selecting different options."
          icon="filter"
          actionButton={true}
          actionButtonText="Clear All Filters"
          onActionButtonClick={() => {
            setSelectedDepartment("");
            setSelectedProgram("");
            setSelectedSemester("");
          }}
        />
      )}

      {courses.length > 0 && (
        <div className="courses-section">
          <h3>Available Courses</h3>
          <div className="courses-grid">
            {courses.map((course) => (
              <div key={course._id} className={`course-card ${selectedCourse?._id === course._id ? "selected" : ""}`} onClick={() => setSelectedCourse(course)}>
                <h4>{course.name}</h4>
                <p>Code: {course.code}</p>
                <p>Credit Hours: {course.creditHours}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedCourse && (
        <div className="registration-section">
          <h3>Register Students for {selectedCourse.name}</h3>

          {/* Display existing sections */}
          <div className="existing-sections-section">
            <h4>Existing Sections</h4>
            {loadingSections ? (
              <div className="loading-sections">Loading sections...</div>
            ) : existingSections.length > 0 ? (
              <div className="sections-grid">
                {existingSections.map((section) => (
                  <div key={section._id || section.id} className="section-card">
                    <div className="section-header">
                      <h5>Section {section.section}</h5>
                    </div>
                    <div className="section-details">
                      <div className="section-metrics">
                        <div className="section-metric">
                          <span className="metric-label">Students</span>
                          <span className="metric-value">{section.enrolledStudentsCount || 0}</span>
                        </div>
                      </div>
                      {formatSectionTeachers(section) && (
                        <div className="teacher-info">
                          <span className="teacher-label">Teachers:</span>
                          <span className="section-teacher-name">{formatSectionTeachers(section)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-sections-message">
                <p>No sections exist for this course yet. Create a section to proceed.</p>
                <div className="create-section-form">
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Section Name (e.g., A, B, C)"
                      value={newSection.section}
                      onChange={(e) => setNewSection({ ...newSection, section: e.target.value })}
                      className="section-input"
                    />
                    <select value={newSection.teacherId} onChange={(e) => setNewSection({ ...newSection, teacherId: e.target.value })} className="teacher-select">
                      <option value="">Select Teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher._id} value={teacher._id}>
                          {teacher.userId?.name || "Unknown Teacher"} ({teacher.employeeId})
                        </option>
                      ))}
                    </select>
                    <button onClick={handleCreateSection} disabled={!newSection.section || !newSection.teacherId || loading} className="create-section-btn">
                      {loading ? "Creating..." : "Create Section"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="file-upload-section">
            <h4>Upload Student Data</h4>
            <div className="file-upload">
              <div className="file-input-container">
                <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} disabled={loading} id="file-upload-input" />
                <label htmlFor="file-upload-input" className="file-upload-label">
                  Choose File
                </label>
              </div>
              <button onClick={handleDownloadTemplate} className="download-template" disabled={loading} type="button">
                Download Template
              </button>
            </div>
            <p className="template-info">
              The Excel file should include: Roll Number, Name, Email, and Section. Sections will be created automatically based on the data in the Excel file.
            </p>
          </div>

          {loading && (
            <div className="progress-bar">
              <div className="progress" style={{ width: `${progress}%` }}></div>
              <span>{progress}%</span>
            </div>
          )}

          {preview.length > 0 && (
            <div className="preview-section">
              <h3>Preview ({preview.length} students)</h3>
              <div className="preview-table">
                <table>
                  <thead>
                    <tr>
                      <th>Roll Number</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Section</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index}>
                        <td>{row.rollNumber}</td>
                        <td>{row.name}</td>
                        <td>{row.email}</td>
                        <td>{row.section}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button onClick={handleRegister} disabled={!file || loading || preview.length === 0} className="register-button" type="button">
            {loading ? "Registering..." : "Register Students"}
          </button>
        </div>
      )}
    </div>
  );
};

export default CourseRegistrationPage;
