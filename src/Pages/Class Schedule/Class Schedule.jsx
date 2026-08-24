import React, { useState, useEffect } from "react";
import axios from "axios";
import { Toaster } from "react-hot-toast";
import LoadingSpinner from "../../Components/LoadingSpinner";
import FiltersPanel from "./components/FiltersPanel";
import TimetableGrid from "./components/TimetableGrid";
import ScheduleModal from "./components/ScheduleModal";
import { showToast, showConflictToasts, TOAST_TYPES } from "../../Components/Toast/Toast";
import { formatSectionTeachers } from "../../utils/sectionTeachers";
import "./Class Schedule.css";

function ClassSchedule() {
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState(["Room 101", "Room 102", "Room 103", "Lab 1", "Lab 2", "Lab 3"]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentAcademicYear, setCurrentAcademicYear] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [sectionColors, setSectionColors] = useState({});
  const [filters, setFilters] = useState({
    day: "",
    teacher: "",
    section: "",
    department: "",
    program: "",
  });
  const [newSchedule, setNewSchedule] = useState({
    day: "Monday",
    timeSlot: {
      startTime: "",
      endTime: "",
      room: "",
    },
    teacherId: "",
  });

  const apiUrl = process.env.REACT_APP_BACKEND_URL;

  // Fetch course details function moved before it's used
  const fetchCourseDetails = async (courseId) => {
    try {
      const response = await axios.get(`${apiUrl}/api/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
      });
      return response.data;
    } catch (error) {
      console.warn(`Error fetching course details for ${courseId}:`, error);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        await Promise.all([fetchSections(), fetchTeachers(), fetchAllSchedules(), fetchCurrentAcademicYear()]);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
    };
  }, [apiUrl]); // Added apiUrl as a dependency

  const fetchCurrentAcademicYear = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/academic-years/current`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
      });
      setCurrentAcademicYear(response.data);
    } catch (error) {
      console.warn("Error fetching current academic year:", error);
      // Continue without current academic year
    }
  };

  const fetchSections = async () => {
    try {
      // Use the deep populate query parameter to include the userId field
      const response = await axios.get(`${apiUrl}/api/sections`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
        params: {
          populate: "true",
          deep: "true", // This parameter should trigger deep population in the backend
        },
      });

      setSections(response.data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      showToast("Failed to fetch sections", TOAST_TYPES.ERROR);
    }
  };

  const fetchTeachers = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/teachers`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
      });
      setTeachers(response.data);
    } catch (error) {
      showToast("Failed to fetch teachers", TOAST_TYPES.ERROR);
      console.error(error);
    }
  };

  const fetchSchedules = async (sectionId) => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiUrl}/api/section-schedules/section/${sectionId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
      });

      // Collect unique course IDs for fetching additional details
      const courseIds = new Set();
      response.data.forEach((schedule) => {
        if (schedule.courseId && typeof schedule.courseId === "object" && schedule.courseId._id) {
          courseIds.add(schedule.courseId._id);
        } else if (typeof schedule.courseId === "string") {
          courseIds.add(schedule.courseId);
        }
      });

      // Fetch missing course details if needed
      const courseDetailsMap = {};
      const courseDetailPromises = [];

      for (const courseId of courseIds) {
        courseDetailPromises.push(
          fetchCourseDetails(courseId).then((courseData) => {
            if (courseData) {
              courseDetailsMap[courseId] = courseData;
            }
          })
        );
      }

      // Wait for all course details to be fetched
      await Promise.all(courseDetailPromises);

      // Normalize schedule data to ensure consistent structure
      const normalizedSchedules = response.data.map((schedule) => {
        // Create a normalized version of the schedule object
        const courseData = schedule.courseId || { name: "Unknown Course" };

        // Get course ID
        const courseId = courseData._id || (typeof schedule.courseId === "string" ? schedule.courseId : null);

        // Add department and program from course details if available
        if (courseId && courseDetailsMap[courseId]) {
          const courseDetails = courseDetailsMap[courseId];
          courseData.department = courseDetails.department;
          courseData.program = courseDetails.program;

          // Ensure course name is available
          if (!courseData.name) {
            courseData.name = courseDetails.name;
          }
        }

        // Find the section data
        const sectionData = sections.find((s) => s._id === schedule.sectionId);

        return {
          ...schedule,
          sectionId: sectionData || { _id: schedule.sectionId },
          courseId: courseData,
          teacherId: sectionData?.teacherId || schedule.teacherId || { _id: "unknown" },
        };
      });

      setSchedules(normalizedSchedules);

      // Generate colors for sections if they don't already have one
      const newSectionColors = { ...sectionColors };
      normalizedSchedules.forEach((schedule) => {
        const sectionId = schedule.sectionId._id;
        if (!newSectionColors[sectionId]) {
          newSectionColors[sectionId] = generateSectionColor(sectionId);
        }
      });
      setSectionColors(newSectionColors);
    } catch (error) {
      showToast("Failed to fetch schedules", TOAST_TYPES.ERROR);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Generate a consistent color for each section
  const generateSectionColor = (sectionId) => {
    // Simple hash function to convert sectionId to a number
    let hash = 0;
    for (let i = 0; i < sectionId.length; i++) {
      hash = sectionId.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Convert the hash to a hue value (0-360)
    const hue = hash % 360;

    // Use a light, pastel color (high saturation and lightness)
    return `hsl(${hue}, 70%, 85%)`;
  };

  // Get section color for a schedule
  const getSectionColor = (schedule) => {
    if (!schedule || !schedule.sectionId) return "#f8f9fa";

    const sectionId = typeof schedule.sectionId === "string" ? schedule.sectionId : schedule.sectionId._id;

    return sectionColors[sectionId] || "#f8f9fa";
  };

  const handleSectionChange = (section) => {
    if (section) {
      setSelectedSection(section);
      fetchSchedules(section._id);
    } else {
      setSelectedSection(null);
      // Don't clear schedules when deselecting a section
      // This allows the user to see all schedules when no section is selected
    }
  };

  const checkConflicts = async (scheduleData) => {
    try {
      setLoading(true); // Show loader during API call
      const response = await axios.post(`${apiUrl}/api/section-schedules/check-conflicts`, scheduleData, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
      });

      // Check if there are conflicts in the response
      if (response.data.conflicts && response.data.conflicts.length > 0) {
        // Use the new showConflictToasts function to display conflicts
        showConflictToasts(response.data.conflicts);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Conflict check error:", error);
      const errorMessage = error.response?.data?.message || "Error checking conflicts";
      showToast(errorMessage, TOAST_TYPES.ERROR);
      return true;
    } finally {
      setLoading(false); // Hide loader after API call completes
    }
  };

  const handleAddSchedule = async () => {
    try {
      if (!selectedSection) {
        showToast("Please select a section first", TOAST_TYPES.ERROR);
        return;
      }

      // Validate that end time is after start time
      if (newSchedule.timeSlot.startTime >= newSchedule.timeSlot.endTime) {
        showToast("End time must be after start time", TOAST_TYPES.ERROR);
        return;
      }

      // Use the teacherId from the schedule data
      const teacherId = newSchedule.teacherId;
      if (!teacherId) {
        showToast("No teacher assigned to this schedule", TOAST_TYPES.ERROR);
        return;
      }

      // Get semester from CourseOffering or default to 1
      // For now, we'll use 1 as default since Section doesn't have semester
      // In the future, this could be derived from CourseOffering
      const semester = 1; // Default semester
      const academicYearString = currentAcademicYear
        ? currentAcademicYear.displayName || `${currentAcademicYear.semesterType} ${currentAcademicYear.year}`
        : new Date().getFullYear().toString();

      const scheduleData = {
        ...newSchedule,
        sectionId: selectedSection._id,
        courseId: selectedSection.courseId?._id,
        teacherId: teacherId,
        semester: semester,
        academicYear: academicYearString,
      };

      // Check for conflicts before saving
      const hasConflicts = await checkConflicts(scheduleData);
      if (hasConflicts) {
        return; // Stop if there are conflicts
      }

      try {
        setLoading(true); // Show loader during API call
        const response = await axios.post(`${apiUrl}/api/section-schedules`, scheduleData, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
        });

        showToast("Schedule added successfully", TOAST_TYPES.SUCCESS);
        fetchSchedules(selectedSection._id);
        setShowAddModal(false);
        setNewSchedule({
          day: "Monday",
          timeSlot: {
            startTime: "",
            endTime: "",
            room: "",
          },
          teacherId: "",
        });
      } catch (error) {
        const errorMessage = error.response?.data?.message || "Failed to add schedule";
        showToast(errorMessage, TOAST_TYPES.ERROR);
        console.error("Add schedule error:", error);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error in handleAddSchedule:", error);
      showToast("An error occurred while adding the schedule", TOAST_TYPES.ERROR);
    }
  };

  const handleEditSchedule = async (schedule) => {
    setSelectedSchedule(schedule);
    setNewSchedule({
      day: schedule.day,
      timeSlot: schedule.timeSlot,
      teacherId: schedule.teacherId?._id || "",
    });
    setShowAddModal(true);
  };

  const handleUpdateSchedule = async () => {
    try {
      if (!selectedSchedule) {
        showToast("No schedule selected for update", TOAST_TYPES.ERROR);
        return;
      }

      // Validate that end time is after start time
      if (newSchedule.timeSlot.startTime >= newSchedule.timeSlot.endTime) {
        showToast("End time must be after start time", TOAST_TYPES.ERROR);
        return;
      }

      // Use the teacherId from the schedule data
      const teacherId = newSchedule.teacherId;
      if (!teacherId) {
        showToast("No teacher assigned to this schedule", TOAST_TYPES.ERROR);
        return;
      }

      // Get semester from CourseOffering or default to 1
      // For now, we'll use 1 as default since Section doesn't have semester
      // In the future, this could be derived from CourseOffering
      const semester = 1; // Default semester
      const academicYearString = currentAcademicYear
        ? currentAcademicYear.displayName || `${currentAcademicYear.semesterType} ${currentAcademicYear.year}`
        : new Date().getFullYear().toString();

      const scheduleData = {
        ...newSchedule,
        sectionId: selectedSection._id,
        courseId: selectedSection.courseId?._id,
        teacherId: teacherId,
        semester: semester,
        academicYear: academicYearString,
      };

      // Check for conflicts before updating
      const hasConflicts = await checkConflicts(scheduleData);
      if (hasConflicts) {
        return; // Stop if there are conflicts
      }

      try {
        setLoading(true); // Show loader during API call
        const response = await axios.put(`${apiUrl}/api/section-schedules/${selectedSchedule._id}`, scheduleData, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
        });

        showToast("Schedule updated successfully", TOAST_TYPES.SUCCESS);
        fetchSchedules(selectedSection._id);
        setShowAddModal(false);
        setSelectedSchedule(null);
        setNewSchedule({
          day: "Monday",
          timeSlot: {
            startTime: "",
            endTime: "",
            room: "",
          },
          teacherId: "",
        });
      } catch (error) {
        const errorMessage = error.response?.data?.message || "Failed to update schedule";
        showToast(errorMessage, TOAST_TYPES.ERROR);
        console.error("Update schedule error:", error);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error in handleUpdateSchedule:", error);
      showToast("An error occurred while updating the schedule", TOAST_TYPES.ERROR);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) {
      return;
    }

    try {
      setLoading(true); // Show loader during API call
      await axios.delete(`${apiUrl}/api/section-schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
      });

      showToast("Schedule deleted successfully", TOAST_TYPES.SUCCESS);

      // Refresh schedule list - either section specific or all schedules
      if (selectedSection) {
        fetchSchedules(selectedSection._id);
      } else {
        fetchAllSchedules();
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete schedule";
      showToast(errorMessage, TOAST_TYPES.ERROR);
      console.error("Delete schedule error:", error);
    } finally {
      setLoading(false); // Hide loader after API call completes
    }
  };

  const formatSectionName = (section) => {
    if (!section) return "";

    const courseName = section.courseId?.name || (typeof section.courseId === "string" ? section.courseId : "");
    const sectionName = section.section || section.name || "";
    const teachersLabel = formatSectionTeachers(section);
    const teacherInfo = teachersLabel !== "No teacher assigned" ? ` - Teachers: ${teachersLabel}` : "";

    return `${courseName} (Section ${sectionName})${teacherInfo}`;
  };

  const formatTeacherName = (teacher) => {
    if (!teacher) return "No teacher assigned";

    // Check for different ways the teacher name might be available
    if (teacher.userId && teacher.userId.name) {
      return teacher.userId.name;
    } else if (teacher.name) {
      return teacher.name;
    } else if (teacher.firstName && teacher.lastName) {
      return `${teacher.firstName} ${teacher.lastName}`;
    } else if (teacher.email) {
      return teacher.email;
    }

    return "Teacher information unavailable";
  };

  // New function to fetch all schedules
  const fetchAllSchedules = async () => {
    try {
      setLoading(true);

      // First, fetch all sections
      const sectionsResponse = await axios.get(`${apiUrl}/api/sections`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
        params: {
          populate: "true",
          deep: "true",
        },
      });

      // Then fetch schedules for each section
      const fetchPromises = [];
      for (const section of sectionsResponse.data) {
        fetchPromises.push(
          axios
            .get(`${apiUrl}/api/section-schedules/section/${section._id}`, {
              headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` },
            })
            .catch((error) => {
              // If there's an error fetching schedules for this section, return an empty array
              console.warn(`Error fetching schedules for section ${section._id}:`, error);
              return { data: [] };
            })
        );
      }

      const scheduleResponses = await Promise.all(fetchPromises);

      // Combine all schedules into a single array
      let allSchedules = [];
      scheduleResponses.forEach((response) => {
        if (response.data && Array.isArray(response.data)) {
          allSchedules = [...allSchedules, ...response.data];
        }
      });

      // Collect unique course IDs for fetching additional details
      const courseIds = new Set();
      allSchedules.forEach((schedule) => {
        if (schedule.courseId && typeof schedule.courseId === "object" && schedule.courseId._id) {
          courseIds.add(schedule.courseId._id);
        } else if (typeof schedule.courseId === "string") {
          courseIds.add(schedule.courseId);
        }
      });

      // Fetch missing course details if needed
      const courseDetailsMap = {};
      const courseDetailPromises = [];

      for (const courseId of courseIds) {
        courseDetailPromises.push(
          fetchCourseDetails(courseId).then((courseData) => {
            if (courseData) {
              courseDetailsMap[courseId] = courseData;
            }
          })
        );
      }

      // Wait for all course details to be fetched
      await Promise.all(courseDetailPromises);

      // Normalize schedule data to ensure consistent structure
      const normalizedSchedules = allSchedules.map((schedule) => {
        // Create a normalized version of the schedule object
        const courseData = { ...schedule.courseId } || { name: "Unknown Course" };

        // Get course ID
        const courseId = courseData._id || (typeof schedule.courseId === "string" ? schedule.courseId : null);

        // Add department and program from course details if available
        if (courseId && courseDetailsMap[courseId]) {
          const courseDetails = courseDetailsMap[courseId];
          courseData.department = courseDetails.department;
          courseData.program = courseDetails.program;

          // Ensure course name is available
          if (!courseData.name) {
            courseData.name = courseDetails.name;
          }
        }

        return {
          ...schedule,
          sectionId: typeof schedule.sectionId === "string" ? { _id: schedule.sectionId } : schedule.sectionId,
          courseId: courseData,
          teacherId: schedule.teacherId || { _id: "unknown" },
        };
      });

      setSchedules(normalizedSchedules);

      // Generate colors for all sections
      const newSectionColors = { ...sectionColors };
      normalizedSchedules.forEach((schedule) => {
        const sectionId = schedule.sectionId._id;
        if (!newSectionColors[sectionId]) {
          newSectionColors[sectionId] = generateSectionColor(sectionId);
        }
      });
      setSectionColors(newSectionColors);
    } catch (error) {
      showToast("Failed to fetch all schedules", TOAST_TYPES.ERROR);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter schedules based on selected filters
  const filteredSchedules = schedules.filter((schedule) => {
    // Day filter
    if (filters.day && schedule.day !== filters.day) {
      return false;
    }

    // Teacher filter
    if (filters.teacher && schedule.teacherId && schedule.teacherId._id !== filters.teacher) {
      return false;
    }

    // Section filter
    if (filters.section && schedule.sectionId && schedule.sectionId._id !== filters.section) {
      return false;
    }

    // Department filter
    if (filters.department && schedule.courseId && schedule.courseId.department !== filters.department) {
      return false;
    }

    // Program filter
    if (filters.program && schedule.courseId && schedule.courseId.program !== filters.program) {
      return false;
    }

    // Semester filter removed - semester is now in CourseOffering, not Course

    return true;
  });

  // Handler for filter changes
  const handleFilterChange = (filterName, value) => {
    setFilters({
      ...filters,
      [filterName]: value,
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      day: "",
      teacher: "",
      section: "",
      department: "",
      program: "",
      semester: "",
    });
  };

  return (
    <div className="schedule-container">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: "#ffffff",
            color: "#333333",
            padding: "16px",
            borderRadius: "8px",
            maxWidth: "500px",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            border: "1px solid #e0e0e0",
            fontSize: "14px",
            fontWeight: "500",
          },
          success: {
            style: {
              background: "#f0fdf4",
              color: "#166534",
              border: "1px solid #86efac",
            },
            icon: "✅",
          },
          error: {
            style: {
              background: "#fef2f2",
              color: "#991b1b",
              border: "1px solid #fecaca",
            },
            icon: "❌",
          },
        }}
      />

      <h1 className="heading">Class Schedule Management</h1>

      <div className="dashboard-layout">
        <FiltersPanel
          filters={filters}
          sections={sections}
          teachers={teachers}
          handleFilterChange={handleFilterChange}
          clearFilters={clearFilters}
          handleAddSchedule={handleAddSchedule}
          getSectionColor={getSectionColor}
          formatTeacherName={formatTeacherName}
          formatSectionName={formatSectionName}
          selectedSection={selectedSection}
          setSelectedSection={setSelectedSection}
          setShowAddModal={setShowAddModal}
          setSelectedSchedule={setSelectedSchedule}
          sectionColors={sectionColors}
        />

        <div className="schedule-content">
          {loading ? (
            <div className="loading-container">
              <LoadingSpinner />
            </div>
          ) : (
            <TimetableGrid
              filteredSchedules={filteredSchedules}
              sections={sections}
              teachers={teachers}
              getSectionColor={getSectionColor}
              handleEditSchedule={handleEditSchedule}
              handleDeleteSchedule={handleDeleteSchedule}
              filters={filters}
              clearFilters={clearFilters}
            />
          )}
        </div>
      </div>

      <ScheduleModal
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
        selectedSchedule={selectedSchedule}
        setSelectedSchedule={setSelectedSchedule}
        newSchedule={newSchedule}
        setNewSchedule={setNewSchedule}
        handleAddSchedule={handleAddSchedule}
        handleUpdateSchedule={handleUpdateSchedule}
        selectedSection={selectedSection}
        formatTeacherName={formatTeacherName}
        rooms={rooms}
        teachers={teachers}
      />
    </div>
  );
}

export default ClassSchedule;
