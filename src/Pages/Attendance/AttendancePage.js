import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { Download, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import "./AttendancePage.css";

const AttendancePage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;

  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionAttendanceData, setSectionAttendanceData] = useState({}); // { sectionId: { students: [], dates: [], attendanceData: {} } }
  const [sectionSearchQueries, setSectionSearchQueries] = useState({}); // { sectionId: searchQuery }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem("adminToken") || sessionStorage.getItem("token");
  };

  // Fetch all courses
  const fetchCourses = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiUrl}/api/courses`, {
        headers: {
          "x-auth-token": getAuthToken(),
        },
      });

      if (response.data && Array.isArray(response.data)) {
        setCourses(response.data);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch attendance for selected course - separate by sections
  const fetchCourseAttendance = async (courseId) => {
    if (!courseId) return;

    setLoading(true);
    setError(null);
    setSections([]);
    setSelectedSectionId(null);
    setSectionAttendanceData({});
    setSectionSearchQueries({});

    try {
      // First, get all sections for this course
      const sectionsResponse = await axios.get(`${apiUrl}/api/sections/course/${courseId}`, {
        headers: {
          "x-auth-token": getAuthToken(),
        },
      });

      if (!sectionsResponse.data || !Array.isArray(sectionsResponse.data) || sectionsResponse.data.length === 0) {
        setSections([]);
        setLoading(false);
        return;
      }

      // Store sections
      setSections(sectionsResponse.data);

      // Fetch attendance for each section separately
      const newSectionAttendanceData = {};
      const newSectionSearchQueries = {};

      for (const section of sectionsResponse.data) {
        const sectionId = section.id || section._id;
        if (!sectionId) continue;

        // Initialize search query for this section
        newSectionSearchQueries[sectionId] = "";

        try {
          // Fetch attendance for this specific section
          const attendanceResponse = await axios.get(`${apiUrl}/api/teachers/attendance?sectionId=${sectionId}`, {
            headers: {
              "x-auth-token": getAuthToken(),
            },
          });

          // Fetch students for this section
          const sectionStudents = await fetchStudentsForSection(sectionId);

          // Process attendance data for this section
          let sectionDates = [];
          let sectionAttendance = {};
          let sectionStudentsList = sectionStudents;

          if (attendanceResponse.data && attendanceResponse.data.attendance) {
            // Find attendance data for this section
            // The API returns attendance grouped by sectionId, so we need to find the matching section
            const sectionIdStr = sectionId?.toString() || sectionId;
            const sectionAttendanceData = attendanceResponse.data.attendance.find((item) => {
              const itemSectionId = item.sectionId?.toString() || item.sectionId;
              return itemSectionId === sectionIdStr;
            });

            if (sectionAttendanceData && sectionAttendanceData.dates) {
              // Extract all dates
              const datesSet = new Set();
              const studentsFromAttendance = new Map();
              const processedData = {};

              Object.keys(sectionAttendanceData.dates).forEach((dateStr) => {
                datesSet.add(dateStr);

                if (sectionAttendanceData.dates[dateStr] && sectionAttendanceData.dates[dateStr].students) {
                  sectionAttendanceData.dates[dateStr].students.forEach((record) => {
                    const studentId = record.studentId?.toString() || record.studentId;

                    // Add student to map if not already present
                    if (studentId && !studentsFromAttendance.has(studentId)) {
                      studentsFromAttendance.set(studentId, {
                        id: studentId,
                        rollNumber: record.rollNumber || "",
                        name: record.name || "Unknown",
                      });
                    }

                    // Process attendance data
                    if (!processedData[studentId]) {
                      processedData[studentId] = {
                        studentId: studentId,
                        rollNumber: record.rollNumber || "",
                        name: record.name || "Unknown",
                        attendance: {},
                      };
                    }
                    processedData[studentId].attendance[dateStr] = record.status;
                  });
                }
              });

              sectionDates = Array.from(datesSet).sort();
              sectionAttendance = processedData;

              // Merge students from attendance with fetched students
              if (studentsFromAttendance.size > 0) {
                const mergedStudents = new Map();

                // First add all fetched students
                sectionStudents.forEach((student) => {
                  const studentId = student.id?.toString() || student.id;
                  mergedStudents.set(studentId, student);
                });

                // Then add any students from attendance that might not be in fetched list
                studentsFromAttendance.forEach((attStudent, studentId) => {
                  if (!mergedStudents.has(studentId)) {
                    mergedStudents.set(studentId, attStudent);
                  }
                });

                sectionStudentsList = Array.from(mergedStudents.values());
              }
            }
          }

          // Store attendance data for this section
          newSectionAttendanceData[sectionId] = {
            students: sectionStudentsList,
            dates: sectionDates,
            attendanceData: sectionAttendance,
          };
        } catch (err) {
          console.error(`Error fetching attendance for section ${sectionId}:`, err);
          // Initialize empty data for this section
          newSectionAttendanceData[sectionId] = {
            students: [],
            dates: [],
            attendanceData: {},
          };
        }
      }

      setSectionAttendanceData(newSectionAttendanceData);
      setSectionSearchQueries(newSectionSearchQueries);

      // Auto-select first section if available
      if (sectionsResponse.data && sectionsResponse.data.length > 0) {
        const firstSectionId = sectionsResponse.data[0].id || sectionsResponse.data[0]._id;
        if (firstSectionId) {
          setSelectedSectionId(firstSectionId);
        }
      }
    } catch (error) {
      handleApiError(error);
      setSections([]);
      setSectionAttendanceData({});
      setSelectedSectionId(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch students for a specific section
  const fetchStudentsForSection = async (sectionId) => {
    try {
      const sectionStudentsResponse = await axios.get(`${apiUrl}/api/course-registrations/getStudents/${sectionId.toString()}`, {
        headers: {
          "x-auth-token": getAuthToken(),
        },
      });

      if (sectionStudentsResponse.data && Array.isArray(sectionStudentsResponse.data)) {
        const formattedStudents = sectionStudentsResponse.data.map((reg) => {
          const studentId = reg.id || reg.studentId?._id || reg.studentId?.id || reg.studentId;
          const rollNumber = reg.rollNumber || reg.studentId?.rollNumber || "";
          const name = reg.name || reg.studentId?.userId?.name || reg.studentId?.name || "Unknown Student";

          return {
            id: studentId?.toString() || studentId,
            rollNumber: rollNumber,
            name: name,
          };
        });
        return formattedStudents;
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error fetching students for section:", error);
      return [];
    }
  };

  // Error handler
  const handleApiError = (error) => {
    if (error.response) {
      const message = error.response.data?.message || "An error occurred";
      toast.error(message);
      setError(message);
    } else if (error.request) {
      toast.error("Network error. Please check your connection.");
      setError("Network error. Please check your connection.");
    } else {
      toast.error("An unexpected error occurred. Please try again.");
      setError("An unexpected error occurred. Please try again.");
    }
    console.error("API Error:", error);
  };

  // Handle course selection
  const handleCourseChange = (course) => {
    setSelectedCourse(course);
    setSelectedSectionId(null);
    fetchCourseAttendance(course._id || course.id);
  };

  // Handle section selection
  const handleSectionChange = (sectionId) => {
    setSelectedSectionId(sectionId);
    // Reset search query for the selected section
    if (!sectionSearchQueries[sectionId]) {
      setSectionSearchQueries((prev) => ({
        ...prev,
        [sectionId]: "",
      }));
    }
  };

  // Handle section search query change
  const handleSectionSearchChange = (sectionId, query) => {
    setSectionSearchQueries((prev) => ({
      ...prev,
      [sectionId]: query,
    }));
  };

  // Export to CSV for a specific section
  const exportSectionToCSV = (sectionId, sectionName) => {
    const sectionData = sectionAttendanceData[sectionId];
    if (!sectionData || !sectionData.attendanceData || Object.keys(sectionData.attendanceData).length === 0 || sectionData.students.length === 0) {
      toast.error("No attendance data to export for this section");
      return;
    }

    try {
      // Prepare data for CSV
      const csvData = [];

      // Header row: Student Info + Dates
      const header = ["Roll Number", "Name", ...sectionData.dates];
      csvData.push(header);

      // Data rows: Use students array for proper names and roll numbers, attendanceData for attendance status
      sectionData.students.forEach((student) => {
        const studentId = student.id?.toString() || student.id;
        const studentData = sectionData.attendanceData[studentId];

        const row = [
          student.rollNumber || "",
          student.name || "Unknown Student",
          ...sectionData.dates.map((date) => {
            const status = studentData?.attendance[date] || "";
            // Convert status to readable format
            if (status === "present") return "P";
            if (status === "absent") return "A";
            if (status === "late") return "L";
            return "";
          }),
        ];
        csvData.push(row);
      });

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(csvData);

      // Set column widths
      const colWidths = [
        { wch: 15 }, // Roll Number
        { wch: 30 }, // Name
        ...sectionData.dates.map(() => ({ wch: 8 })), // Date columns
      ];
      ws["!cols"] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendance");

      // Generate filename
      const courseName = selectedCourse.name || "Course";
      const courseCode = selectedCourse.code || "";
      const filename = `Attendance_${courseCode}_${courseName}_${sectionName}_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success("Attendance exported successfully!");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export attendance. Please try again.");
    }
  };

  // Filter students for a section based on search query
  const getFilteredStudentsForSection = (sectionId) => {
    const sectionData = sectionAttendanceData[sectionId];
    if (!sectionData) return [];

    const searchQuery = sectionSearchQueries[sectionId] || "";
    if (!searchQuery) return sectionData.students;

    return sectionData.students.filter(
      (student) => student.name.toLowerCase().includes(searchQuery.toLowerCase()) || student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Initialize
  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div className="header-content">
          <h1>Attendance Management</h1>
          <p>View attendance records course-wise</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
        </div>
      )}

      <div className="attendance-content">
        {/* Course Selection Sidebar */}
        <div className="course-sidebar">
          <h3>Select Course</h3>
          {loading && courses.length === 0 ? (
            <div className="loading-text">Loading courses...</div>
          ) : courses.length === 0 ? (
            <div className="empty-text">No courses available</div>
          ) : (
            <div className="course-list">
              {courses.map((course) => (
                <div
                  key={course._id || course.id}
                  className={`course-item ${selectedCourse?._id === course._id || selectedCourse?.id === course.id ? "active" : ""}`}
                  onClick={() => handleCourseChange(course)}
                >
                  <div className="course-info">
                    <div className="course-name">{course.name}</div>
                    <div className="course-code">{course.code}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="attendance-main">
          {selectedCourse ? (
            <>
              <div className="course-header">
                <h2>{selectedCourse.name}</h2>
                <p className="course-code-text">{selectedCourse.code}</p>
              </div>

              {loading ? (
                <div className="loading">Loading attendance data...</div>
              ) : sections.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={48} />
                  <p>No sections found for this course</p>
                </div>
              ) : (
                <>
                  {/* Section Tabs */}
                  <div className="section-tabs-container">
                    <div className="section-tabs">
                      {sections.map((section) => {
                        const sectionId = section.id || section._id;
                        const sectionName = section.section ? `Section ${section.section}` : `Section ${sectionId}`;
                        const isActive = selectedSectionId === sectionId;
                        const sectionData = sectionAttendanceData[sectionId];
                        const studentCount = sectionData?.students?.length || 0;

                        return (
                          <button key={sectionId} className={`section-tab ${isActive ? "active" : ""}`} onClick={() => handleSectionChange(sectionId)}>
                            <span className="tab-label">{sectionName}</span>
                            {section.teacher && <span className="tab-teacher">{section.teacher.name || "N/A"}</span>}
                            {studentCount > 0 && <span className="tab-count">{studentCount} students</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Section Content */}
                  {selectedSectionId ? (
                    (() => {
                      const selectedSection = sections.find((s) => (s.id || s._id) === selectedSectionId);
                      if (!selectedSection) return null;

                      const sectionData = sectionAttendanceData[selectedSectionId];
                      const sectionName = selectedSection.section ? `Section ${selectedSection.section}` : `Section ${selectedSectionId}`;
                      const filteredStudents = getFilteredStudentsForSection(selectedSectionId);
                      const hasData = sectionData && sectionData.dates && sectionData.dates.length > 0;

                      return (
                        <div className="section-attendance-block">
                          <div className="section-header">
                            <div className="section-title">
                              <h3>{sectionName}</h3>
                              {selectedSection.teacher && <p className="section-teacher">Teacher: {selectedSection.teacher.name || "N/A"}</p>}
                            </div>
                            {hasData && (
                              <button className="export-btn section-export-btn" onClick={() => exportSectionToCSV(selectedSectionId, sectionName)}>
                                <Download size={18} />
                                Export to Excel
                              </button>
                            )}
                          </div>

                          {/* Search for this section */}
                          <div className="search-container">
                            <input
                              type="text"
                              placeholder={`Search students in ${sectionName}...`}
                              value={sectionSearchQueries[selectedSectionId] || ""}
                              onChange={(e) => handleSectionSearchChange(selectedSectionId, e.target.value)}
                              className="search-input"
                            />
                          </div>

                          {/* Attendance Table for this section */}
                          {!hasData ? (
                            <div className="empty-state section-empty-state">
                              <Calendar size={32} />
                              <p>No attendance records found for {sectionName}</p>
                            </div>
                          ) : (
                            <div className="attendance-table-container">
                              <table className="attendance-table">
                                <thead>
                                  <tr>
                                    <th className="sticky-col">Roll Number</th>
                                    <th className="sticky-col">Name</th>
                                    {sectionData.dates.map((date) => (
                                      <th key={date} className="date-header">
                                        {formatDate(date)}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredStudents.length === 0 ? (
                                    <tr>
                                      <td colSpan={sectionData.dates.length + 2} className="no-results">
                                        No students found
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredStudents.map((student) => {
                                      const studentId = student.id?.toString() || student.id;
                                      const studentData = sectionData.attendanceData[studentId];
                                      return (
                                        <tr key={studentId}>
                                          <td className="sticky-col roll-number">{student.rollNumber || "N/A"}</td>
                                          <td className="sticky-col student-name">{student.name || "Unknown Student"}</td>
                                          {sectionData.dates.map((date) => {
                                            const status = studentData?.attendance[date] || "";
                                            return (
                                              <td key={date} className={`attendance-cell ${status}`}>
                                                {status === "present" ? "P" : status === "absent" ? "A" : status === "late" ? "L" : ""}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Legend for this section */}
                          {hasData && (
                            <div className="attendance-legend">
                              <div className="legend-item">
                                <span className="legend-dot present"></span>
                                <span>Present (P)</span>
                              </div>
                              <div className="legend-item">
                                <span className="legend-dot absent"></span>
                                <span>Absent (A)</span>
                              </div>
                              <div className="legend-item">
                                <span className="legend-dot late"></span>
                                <span>Late (L)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="empty-state section-empty-state">
                      <Calendar size={32} />
                      <p>Please select a section to view attendance</p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Calendar size={48} />
              <p>Please select a course to view attendance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;
