import React, { useState, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { Download, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import { formatSectionTeachers } from "../../utils/sectionTeachers";
import Loading from "../../Components/Loading/Loading";
import "./AttendancePage.css";

const getAttendanceItems = (payload) => {
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => (Array.isArray(entry?.attendance) ? entry.attendance : []));
  }

  if (Array.isArray(payload?.attendance)) {
    return payload.attendance;
  }

  return [];
};

const normalizeAttendanceStatus = (status) => {
  if (!status) return "";

  const normalizedStatus = status.toString().trim().toLowerCase();

  if (["present", "absent", "late", "leave"].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return "";
};

const getAttendanceStatusLabel = (status) => {
  if (status === "present") return "P";
  if (status === "absent") return "A";
  if (status === "late") return "L";
  if (status === "leave") return "LV";
  return "";
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

const getWorksheetDataForSection = (sectionData, formatDateSlot) => {
  const header = ["Roll Number", "Name", ...sectionData.dates.map((date) => formatDateSlot(date))];
  const rows = sectionData.students.map((student) => {
    const studentId = student.id?.toString() || student.id;
    const studentData = sectionData.attendanceData[studentId];

    return [
      student.rollNumber || "",
      student.name || "Unknown Student",
      ...sectionData.dates.map((date) => getAttendanceStatusLabel(studentData?.attendance[date] || "")),
    ];
  });

  return [header, ...rows];
};

const AttendancePage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;

  const [courses, setCourses] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [academicTerms, setAcademicTerms] = useState([]);
  const [selectedAcademicTermId, setSelectedAcademicTermId] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionAttendanceData, setSectionAttendanceData] = useState({}); // { sectionId: { students: [], dates: [], attendanceData: {} } }
  const [sectionSearchQueries, setSectionSearchQueries] = useState({}); // { sectionId: searchQuery }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get auth token
  const getAuthToken = () => {
    return sessionStorage.getItem("adminToken");
  };

  const selectedAcademicTerm = academicTerms.find((term) => term._id === selectedAcademicTermId);

  const requestHeaders = () => ({
    "x-auth-token": getAuthToken(),
    Authorization: `Bearer ${getAuthToken()}`,
  });

  const resetAttendanceWorkspace = () => {
    setSelectedCourse(null);
    setSections([]);
    setSelectedSectionId(null);
    setSectionAttendanceData({});
    setSectionSearchQueries({});
  };

  const fetchAcademicTerms = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`${apiUrl}/api/academic-years?includeInactive=true`, {
        headers: requestHeaders(),
      });

      const terms = Array.isArray(response.data) ? response.data : [];
      setAcademicTerms(terms);

      const activeTerm = terms.find((term) => term.status === "active" || term.isCurrent);
      const initialTerm = activeTerm || terms[0];

      if (initialTerm) {
        setSelectedAcademicTermId(initialTerm._id);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch courses offered in the selected academic term
  const fetchCourses = async (academicYearId) => {
    if (!academicYearId) {
      setCourses([]);
      resetAttendanceWorkspace();
      return;
    }

    setLoading(true);
    setError(null);
    resetAttendanceWorkspace();

    try {
      const response = await axios.get(`${apiUrl}/api/course-offerings`, {
        params: {
          academicYearId,
          isActive: true,
        },
        headers: requestHeaders(),
      });

      const offerings = Array.isArray(response.data) ? response.data : [];
      const courseMap = new Map();

      offerings.forEach((offering) => {
        const course = offering.courseId;
        if (!course?._id) return;
        // One course can be offered to several programs: keep them all, so it shows under each program's filter.
        const known = courseMap.get(course._id);
        const programs = [...(known?.programs || [])];
        if (offering.program?._id && !programs.some((p) => p._id === offering.program._id)) programs.push({ ...offering.program, semester: offering.semester });
        courseMap.set(course._id, {
          ...course,
          offeringId: known?.offeringId || offering._id,
          program: known?.program || offering.program,
          department: known?.department || offering.department,
          departmentIds: [...new Set([...(known?.departmentIds || []), offering.department?._id].filter(Boolean))],
          semester: known?.semester ?? offering.semester,
          programs,
        });
      });

      setCourses(Array.from(courseMap.values()));
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
        params: {
          academicYearId: selectedAcademicTermId,
        },
        headers: requestHeaders(),
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
          const attendanceResponse = await axios.get(`${apiUrl}/api/teachers/attendance`, {
            params: {
              sectionId,
              academicYearId: selectedAcademicTermId,
            },
            headers: requestHeaders(),
          });

          // Fetch students for this section
          const sectionStudents = await fetchStudentsForSection(sectionId);

          // Process attendance data for this section
          let sectionDates = [];
          let sectionAttendance = {};
          let sectionStudentsList = sectionStudents;

          const attendanceItems = getAttendanceItems(attendanceResponse.data);

          if (attendanceItems.length > 0) {
            // Find attendance data for this section
            // The API returns attendance grouped by sectionId, so we need to find the matching section
            const sectionIdStr = sectionId?.toString() || sectionId;
            const sectionAttendanceData = attendanceItems.find((item) => {
              const itemSectionId = item.sectionId?.toString() || item.sectionId;
              return itemSectionId === sectionIdStr;
            });

            if (sectionAttendanceData && sectionAttendanceData.dates) {
              // Extract all dates
              const dateSlotsSet = new Set();
              const studentsFromAttendance = new Map();
              const processedData = {};

              Object.keys(sectionAttendanceData.dates).forEach((dateStr) => {
                const dateEntry = sectionAttendanceData.dates[dateStr];
                if (dateEntry?.slots && Array.isArray(dateEntry.slots)) {
                  dateEntry.slots.forEach((slot) => {
                    const slotKey = `${dateStr}__slot-${slot.slotNumber}`;
                    dateSlotsSet.add(slotKey);
                    slot.students.forEach((record) => {
                      const studentId = record.studentId?.toString() || record.studentId;

                      if (studentId && !studentsFromAttendance.has(studentId)) {
                        studentsFromAttendance.set(studentId, {
                          id: studentId,
                          rollNumber: record.rollNumber || "",
                          name: record.name || "Unknown",
                        });
                      }

                      if (!processedData[studentId]) {
                        processedData[studentId] = {
                          studentId: studentId,
                          rollNumber: record.rollNumber || "",
                          name: record.name || "Unknown",
                          attendance: {},
                        };
                      }
                      processedData[studentId].attendance[slotKey] = normalizeAttendanceStatus(record.status);
                    });
                  });
                } else if (dateEntry?.students) {
                  // Backward compatibility with old payload
                  const slotKey = `${dateStr}__slot-1`;
                  dateSlotsSet.add(slotKey);
                  dateEntry.students.forEach((record) => {
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
                    processedData[studentId].attendance[slotKey] = normalizeAttendanceStatus(record.status);
                  });
                }
              }); 

              sectionDates = Array.from(dateSlotsSet).sort((a, b) => {
                const [dateA, slotA] = a.split("__slot-");
                const [dateB, slotB] = b.split("__slot-");
                if (dateA === dateB) return Number(slotA) - Number(slotB);
                return dateA.localeCompare(dateB);
              });
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
        params: {
          academicYearId: selectedAcademicTermId,
        },
        headers: requestHeaders(),
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

  const handleAcademicTermChange = (termId) => {
    setSelectedAcademicTermId(termId);
    setDepartmentFilter(""); setProgramFilter(""); setCourseQuery("");
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
      const csvData = getWorksheetDataForSection(sectionData, formatDateSlot);

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
      const termName = getTermDisplayName(selectedAcademicTerm).replace(/\s+/g, "_");
      const filename = `Attendance_${termName}_${courseCode}_${courseName}_${sectionName}_${new Date().toISOString().split("T")[0]}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
      toast.success("Attendance exported successfully!");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export attendance. Please try again.");
    }
  };

  const exportCourseAttendanceToExcel = () => {
    if (!selectedCourse || sections.length === 0) {
      toast.error("No course selected to export");
      return;
    }

    const sectionsWithData = sections
      .map((section) => {
        const sectionId = section.id || section._id;
        return {
          section,
          sectionId,
          sectionData: sectionAttendanceData[sectionId],
        };
      })
      .filter(({ sectionData }) => sectionData && sectionData.students.length > 0 && Object.keys(sectionData.attendanceData || {}).length > 0);

    if (sectionsWithData.length === 0) {
      toast.error("No attendance data available to export");
      return;
    }

    try {
      const workbook = XLSX.utils.book_new();

      sectionsWithData.forEach(({ section, sectionData }, index) => {
        const sectionName = section.section ? `Section ${section.section}` : `Section ${index + 1}`;
        const worksheetData = getWorksheetDataForSection(sectionData, formatDateSlot);
        const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

        worksheet["!cols"] = [
          { wch: 15 },
          { wch: 30 },
          ...sectionData.dates.map(() => ({ wch: 14 })),
        ];

        const safeSheetName = sectionName.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || `Section${index + 1}`;
        XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
      });

      const courseName = selectedCourse.name || "Course";
      const courseCode = selectedCourse.code || "";
      const termName = getTermDisplayName(selectedAcademicTerm).replace(/\s+/g, "_");
      const filename = `Attendance_${termName}_${courseCode}_${courseName}_All_Sections_${new Date().toISOString().split("T")[0]}.xlsx`;

      XLSX.writeFile(workbook, filename);
      toast.success("Course attendance exported successfully!");
    } catch (error) {
      console.error("Error exporting course attendance:", error);
      toast.error("Failed to export course attendance. Please try again.");
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
  const formatDateSlot = (dateSlotStr) => {
    const [dateStr, slotPart] = dateSlotStr.split("__slot-");
    const date = new Date(dateStr);
    const slotNumber = Number(slotPart) || 1;
    const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${dateLabel} (S${slotNumber})`;
  };

  // What can be filtered on comes from the term's own offerings, so there is never an empty choice.
  const departmentOptions = [...new Map(courses.flatMap((c) => (c.department?._id ? [[c.department._id, c.department]] : []))).values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const programOptions = [...new Map(courses
    .filter((c) => !departmentFilter || (c.departmentIds || []).includes(departmentFilter))
    .flatMap((c) => (c.programs || []).map((p) => [p._id, p]))).values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const visibleCourses = courses.filter((c) => {
    if (departmentFilter && !(c.departmentIds || []).includes(departmentFilter)) return false;
    if (programFilter && !(c.programs || []).some((p) => p._id === programFilter)) return false;
    const needle = courseQuery.trim().toLowerCase();
    return !needle || `${c.code} ${c.name}`.toLowerCase().includes(needle);
  }).sort((a, b) => String(a.code).localeCompare(String(b.code), undefined, { numeric: true }));

  // Initialize
  useEffect(() => {
    fetchAcademicTerms();
  }, []);

  useEffect(() => {
    fetchCourses(selectedAcademicTermId);
  }, [selectedAcademicTermId]);

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div className="att-header-content">
          <h1>Attendance Management</h1>
          <p>Choose an academic term first, then inspect attendance course-wise</p>
        </div>
        {selectedCourse && sections.some((section) => {
          const sectionId = section.id || section._id;
          const sectionData = sectionAttendanceData[sectionId];
          return sectionData && sectionData.students.length > 0 && Object.keys(sectionData.attendanceData || {}).length > 0;
        }) && (
          <button className="export-btn" onClick={exportCourseAttendanceToExcel}>
            <Download size={18} />
            Export All Sections
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          <span>{error}</span>
        </div>
      )}

      <section className="att-filters" aria-label="Find a course">
        <label className="att-f">
          <span>Academic term</span>
          <select id="attendance-academic-term" value={selectedAcademicTermId} onChange={(e) => handleAcademicTermChange(e.target.value)} disabled={academicTerms.length === 0}>
            <option value="">Select academic term</option>
            {academicTerms.map((term) => (
              <option key={term._id} value={term._id}>{getTermDisplayName(term)} · {getTermStatusLabel(term.status)}</option>
            ))}
          </select>
        </label>
        <label className="att-f">
          <span>Department</span>
          <select value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setProgramFilter(""); }} disabled={!selectedAcademicTermId || departmentOptions.length === 0}>
            <option value="">All departments</option>
            {departmentOptions.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </label>
        <label className="att-f">
          <span>Program</span>
          <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} disabled={!selectedAcademicTermId || programOptions.length === 0}>
            <option value="">All programs</option>
            {programOptions.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </label>
        <label className="att-f att-f-search">
          <span>Search</span>
          <input type="search" value={courseQuery} onChange={(e) => setCourseQuery(e.target.value)} placeholder="Course code or name" disabled={!selectedAcademicTermId} />
        </label>
        {selectedAcademicTerm && <span className={`term-status-pill ${selectedAcademicTerm.status || "unknown"}`}>{getTermStatusLabel(selectedAcademicTerm.status)}</span>}
      </section>

      <div className="attendance-content">
        {/* Course list: filtered, scrollable, with a count */}
        <div className="att-sidebar">
          <h3>Courses {courses.length > 0 && <span className="att-count">{visibleCourses.length === courses.length ? courses.length : `${visibleCourses.length} of ${courses.length}`}</span>}</h3>
          {loading && courses.length === 0 ? (
            <Loading variant="list" rows={6} label="Loading courses" />
          ) : !selectedAcademicTermId ? (
            <div className="empty-text">Select an academic term first</div>
          ) : courses.length === 0 ? (
            <div className="empty-text">No course offerings found for this term</div>
          ) : visibleCourses.length === 0 ? (
            <div className="empty-text">No course matches these filters. <button type="button" className="att-clear" onClick={() => { setDepartmentFilter(""); setProgramFilter(""); setCourseQuery(""); }}>Clear filters</button></div>
          ) : (
            <div className="att-courses">
              {visibleCourses.map((course) => (
                <div
                  key={course._id || course.id}
                  className={`att-course ${selectedCourse && (selectedCourse._id || selectedCourse.id) === (course._id || course.id) ? "is-on" : ""}`}
                  onClick={() => handleCourseChange(course)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCourseChange(course); } }}
                >
                  <div className="att-course-info">
                    <div className="att-course-code">{course.code}</div>
                    <div className="att-course-name">{course.name}</div>
                    {course.programs?.length > 0 && <div className="att-course-meta">{course.programs.map((p) => `${p.code || p.name}${p.semester !== undefined ? ` · Sem ${p.semester}` : ""}`).join(", ")}</div>}
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
                <p className="course-code-text">
                  {selectedCourse.code} · {getTermDisplayName(selectedAcademicTerm)}
                </p>
              </div>

              {loading ? (
                <Loading variant="table" rows={8} label="Loading attendance" />
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
                            <span className="tab-teacher">{formatSectionTeachers(section)}</span>
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
                              <p className="section-teacher">Teachers: {formatSectionTeachers(selectedSection)}</p>
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
                                        {formatDateSlot(date)}
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
                                                {status === "present" ? "P" : status === "absent" ? "A" : status === "late" ? "L" : status === "leave" ? "LV" : ""}
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
                              <div className="legend-item">
                                <span className="legend-dot leave"></span>
                                <span>Leave (LV)</span>
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
