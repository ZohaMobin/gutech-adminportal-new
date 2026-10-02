import React, { useState, useEffect } from "react";
import axios from "axios";
import "./CoursePage.css";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import TeacherAssignmentPage from '../TeacherAssignment/TeacherAssignmentPage';
import { FiSearch, FiX, FiEdit2, FiTrash2, FiToggleLeft, FiToggleRight } from "react-icons/fi";
import Loading, { BusyLabel, Refreshing, Spinner } from '../../Components/Loading/Loading';
import NoResultsFound from '../../Components/NoResultsFound';
import OfferingEditModal from './OfferingEditModal';
import CourseSetupSteps from './CourseSetupSteps';
import { semesterLabel } from '../../utils/semester';
import './CourseRefresh.css';
import PageHeader from '../../Components/PageHeader/PageHeader';
import { ConfirmModal } from '../Administrators/AdminModals';

const COURSES_PER_PAGE = 25;

const CoursePage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const { departments, programs, loading: deptProgLoading, getProgramById } = useDepartmentsAndPrograms();
  
  const [course, setCourse] = useState({
    code: "",
    name: "",
    description: "",
    creditHours: "",
    isActive: true
  });

  const [courseOffering, setCourseOffering] = useState({
    courseId: "",
    department: "",
    program: "",
    semester: "0",
    academicYearId: ""
  });

  const [courses, setCourses] = useState([]);
  const [courseOfferings, setCourseOfferings] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [message, setMessage] = useState({ text: "", type: "" });
  // What is happening, kept apart so an action never blanks the screen: the first load shows placeholders, a refresh
  // dims what is already there, and a button or a row shows its own busy state.
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);               // the create / update course form
  const [busyCourseId, setBusyCourseId] = useState(null);    // the course whose status is being changed or that is being deleted
  const [deactivating, setDeactivating] = useState(false);   // "Deactivate Year Offerings"
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'offerings', 'assignments', 'manage'
  const [groupByOptions, setGroupByOptions] = useState({
    department: true,
    program: true,
    semester: true
  });
  // Filters for the offerings list and for the course list: everything is shown until a filter is chosen.
  const [offeringDepartment, setOfferingDepartment] = useState("");
  const [offeringProgram, setOfferingProgram] = useState("");
  const [offeringSemester, setOfferingSemester] = useState("");
  const [offeringQuery, setOfferingQuery] = useState("");
  const [courseDepartment, setCourseDepartment] = useState("");
  const [coursePage, setCoursePage] = useState(0);
  // What was just done, so the next step can pick up from it: { code, name, id } after creating a course, { course, term } after offering one.
  const [justCreated, setJustCreated] = useState(null);
  const [justOffered, setJustOffered] = useState(null);
  const [editingOffering, setEditingOffering] = useState(null);
  const [savingOffering, setSavingOffering] = useState(false);
  const [offeringEditError, setOfferingEditError] = useState('');
  // One confirmation at a time: { kind: "delete" | "restore" | "deactivate-offerings", ... } (never window.confirm).
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [selectedOfferingAcademicYear, setSelectedOfferingAcademicYear] = useState("");
  
  // New state for manage courses tab
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [editingCourse, setEditingCourse] = useState(null);
  const [filteredCourses, setFilteredCourses] = useState([]);

  useEffect(() => {
    // Each fetch reports its own failure, so this always settles.
    Promise.all([fetchCourses(), fetchCourseOfferings(), fetchAcademicYears()]).finally(() => setFirstLoad(false));
  }, []);

  const fetchAcademicYears = async () => {
    try {
      const token = sessionStorage.getItem('adminToken');
      const response = await axios.get(`${apiUrl}/api/academic-years`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter to only show active academic years and sort by year (descending) and semester type
      const activeYears = response.data
        .filter(ay => ay.isActive)
        .sort((a, b) => {
          // Sort by year descending first
          if (b.year !== a.year) {
            return b.year - a.year;
          }
          // Then by semester type: Fall, Spring, Summer
          const order = { Fall: 1, Spring: 2, Summer: 3 };
          return (order[a.semesterType] || 0) - (order[b.semesterType] || 0);
        });
      setAcademicYears(activeYears);
    } catch (error) {
      console.error('Error fetching academic years:', error);
      showToast('Failed to fetch academic years', TOAST_TYPES.ERROR);
    }
  };

  // Filter courses when search term, semester filter, or status filter changes
  useEffect(() => {
    if (activeTab === 'manage') {
      let filtered = [...courses];
      
      // Apply search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(course => 
          course.code.toLowerCase().includes(term) || 
          course.name.toLowerCase().includes(term) ||
          (course.description || '').toLowerCase().includes(term)
        );
      }
      
      // Semester filter removed - semester is now in CourseOffering, not Course
      
      // Apply status filter
      if (filterStatus !== "") {
        const isActive = filterStatus === "active";
        filtered = filtered.filter(course => 
          course.isActive === isActive
        );
      }
      
      // Department comes from where the course is offered ("none" is a course that is not offered anywhere yet).
      if (courseDepartment) {
        const offered = (id) => courseOfferings.filter((o) => String(o.courseId?._id ?? o.courseId) === String(id));
        filtered = filtered.filter((course) => (courseDepartment === 'none'
          ? offered(course._id).length === 0
          : offered(course._id).some((o) => String(o.department?._id ?? o.department) === courseDepartment)));
      }

      setFilteredCourses(filtered);
      setCoursePage(0);
    }
  }, [searchTerm, filterStatus, courseDepartment, courses, courseOfferings, activeTab]);

  const fetchCourses = async () => {
    try {
      const response = await axios.get(`${apiUrl}/api/courses`);
      setCourses(response.data);
    } catch (error) {
      setMessage({ text: "Error fetching courses", type: "error" });
    }
  };

  const fetchCourseOfferings = async () => {
    try {
      const token = sessionStorage.getItem('adminToken');
      const response = await axios.get(`${apiUrl}/api/course-offerings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCourseOfferings(response.data);
    } catch (error) {
      setMessage({ text: "Error fetching course offerings", type: "error" });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCourse((prevState) => ({
      ...prevState,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleOfferingChange = (e) => {
    const { name, value, type, checked } = e.target;
    setCourseOffering(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditCourse = (course) => {
    setEditingCourse(course);
    setCourse({
      code: course.code,
      name: course.name,
      description: course.description,
      creditHours: course.creditHours,
      isActive: course.isActive
    });
    setActiveTab('create');
  };

  const handleDeleteCourse = (courseToDelete) => {
    setConfirmError("");
    setConfirm({ kind: "delete", course: courseToDelete });
  };

  const runDeleteCourse = async (courseId) => {
    try {
      setBusyCourseId(courseId);
      await axios.delete(`${apiUrl}/api/courses/${courseId}`);
      // The server has soft-deleted it: drop the row here rather than reloading the table. Its offerings were switched
      // off, so refresh those quietly.
      setCourses((prev) => prev.filter((c) => c._id !== courseId));
      showToast("Course deleted", TOAST_TYPES.SUCCESS);
      fetchCourseOfferings();
      return true;
    } catch (error) {
      setConfirmError(error.response?.data?.message || "Failed to delete course.");
      return false;
    } finally {
      setBusyCourseId(null);
    }
  };

  const handleToggleStatus = async (courseId, currentStatus) => {
    try {
      setBusyCourseId(courseId);
      await axios.patch(`${apiUrl}/api/courses/${courseId}/toggle-status`, {
        isActive: !currentStatus
      });
      
      // Update local state
      setCourses(prevCourses => 
        prevCourses.map(course => 
          course._id === courseId 
            ? { ...course, isActive: !currentStatus } 
            : course
        )
      );
      
      showToast(`Course ${!currentStatus ? 'activated' : 'deactivated'}`, TOAST_TYPES.SUCCESS);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to update course status", TOAST_TYPES.ERROR);
    } finally {
      setBusyCourseId(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!course.code || !course.name || !course.description || !course.creditHours) {
      setMessage({ text: "Please fill out all fields!", type: "error" });
      return;
    }

    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      if (editingCourse) {
        // Update existing course
        await axios.put(
          `${apiUrl}/api/courses/${editingCourse._id}`,
          course,
          {
            headers: {
              "Content-Type": "application/json",
            }
          }
        );
        setMessage({ text: "Course updated successfully!", type: "success" });
      } else {
        // Create new course
        const created = await axios.post(
        `${apiUrl}/api/courses`,
        course,
        {
          headers: {
            "Content-Type": "application/json",
          }
        }
      );
      setMessage({ text: "", type: "" });
      setJustCreated({ id: created?.data?._id, code: course.code, name: course.name });
      }

      setCourse({ code: "", name: "", description: "", creditHours: "", isActive: true });
      setEditingCourse(null);
      fetchCourses(); // Refresh the courses list
    } catch (error) {
      const data = error.response?.data;
      const fallback = editingCourse ? "Failed to update course." : "Failed to create course.";

      // The code belongs to a deleted course: offer to bring that course back instead.
      if (data?.reason === "DELETED_DUPLICATE" && data.deletedCourseId) {
        // Ask in a dialog; declining leaves the duplicate-code message on the form.
        setMessage({ text: data.message, type: "error" });
        setConfirmError("");
        setConfirm({ kind: "restore", data });
      } else {
        setMessage({ text: data?.message || fallback, type: "error" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleOfferingSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = sessionStorage.getItem('adminToken');
      const response = await axios.post(
        `${apiUrl}/api/course-offerings`, 
        courseOffering,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCourseOfferings([...courseOfferings, response.data]);
      const offeredCourse = courses.find((c) => c._id === courseOffering.courseId);
      const offeredTerm = academicYears.find((ay) => ay._id === courseOffering.academicYearId);
      setJustOffered({
        course: offeredCourse ? `${offeredCourse.code} ${offeredCourse.name}` : "The course",
        term: offeredTerm ? (offeredTerm.displayName || `${offeredTerm.semesterType} ${offeredTerm.year}`) : "",
      });
      setCourseOffering({
        courseId: "",
        department: "",
        program: "",
        semester: "0",
        academicYearId: ""
      });
      showToast('Course offering created', TOAST_TYPES.SUCCESS);
      fetchCourseOfferings(); // Refresh to get populated data
    } catch (error) {
      console.error('Error creating course offering:', error);
      showToast(error.response?.data?.message || 'Error creating course offering', TOAST_TYPES.ERROR);
    }
  };

  const handleGroupByChange = (option) => {
    setGroupByOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  const getAcademicYearLabel = (offering) => {
    if (offering.academicYearId && typeof offering.academicYearId === 'object') {
      return offering.academicYearId.displayName || `${offering.academicYearId.semesterType} ${offering.academicYearId.year}`;
    }

    if (offering.semesterType && offering.year) {
      return `${offering.semesterType} ${offering.year}`;
    }

    return 'Unassigned Academic Year';
  };

  const academicYearTabs = React.useMemo(() => {
    const tabMap = new Map();

    courseOfferings.forEach((offering) => {
      const academicYearObject = offering.academicYearId && typeof offering.academicYearId === 'object'
        ? offering.academicYearId
        : null;
      const key = academicYearObject?._id || `${offering.semesterType || 'unknown'}-${offering.year || 'unknown'}`;

      if (!tabMap.has(key)) {
        tabMap.set(key, {
          key,
          label: getAcademicYearLabel(offering),
          year: academicYearObject?.year || offering.year || 0,
          semesterType: academicYearObject?.semesterType || offering.semesterType || '',
          isCurrent: Boolean(academicYearObject?.isCurrent),
        });
      }
    });

    const semesterOrder = { Fall: 1, Spring: 2, Summer: 3 };

    return Array.from(tabMap.values()).sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }

      return (semesterOrder[a.semesterType] || 99) - (semesterOrder[b.semesterType] || 99);
    });
  }, [courseOfferings]);

  useEffect(() => {
    if (academicYearTabs.length === 0) {
      if (selectedOfferingAcademicYear !== "") {
        setSelectedOfferingAcademicYear("");
      }
      return;
    }

    const hasSelectedTab = academicYearTabs.some((tab) => tab.key === selectedOfferingAcademicYear);
    if (hasSelectedTab) {
      return;
    }

    const currentTab = academicYearTabs.find((tab) => tab.isCurrent);
    setSelectedOfferingAcademicYear(currentTab?.key || academicYearTabs[0].key);
  }, [academicYearTabs, selectedOfferingAcademicYear]);

  const visibleCourseOfferings = selectedOfferingAcademicYear
    ? courseOfferings.filter((offering) => {
        const academicYearObject = offering.academicYearId && typeof offering.academicYearId === 'object'
          ? offering.academicYearId
          : null;
        const key = academicYearObject?._id || `${offering.semesterType || 'unknown'}-${offering.year || 'unknown'}`;
        return key === selectedOfferingAcademicYear;
      })
    : courseOfferings;

  const idOfRef = (value) => String(value?._id ?? value ?? '');
  const filteredOfferings = visibleCourseOfferings.filter((offering) => {
    if (offeringDepartment && idOfRef(offering.department) !== offeringDepartment) return false;
    if (offeringProgram && idOfRef(offering.program) !== offeringProgram) return false;
    if (offeringSemester !== '' && Number(offering.semester) !== Number(offeringSemester)) return false;
    const needle = offeringQuery.trim().toLowerCase();
    return !needle || `${offering.courseId?.code || ''} ${offering.courseId?.name || ''}`.toLowerCase().includes(needle);
  });
  const offeringDepartmentOptions = [...new Map(visibleCourseOfferings.filter((o) => o.department?._id).map((o) => [o.department._id, o.department.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const offeringProgramOptions = [...new Map(visibleCourseOfferings.filter((o) => o.program?._id && (!offeringDepartment || idOfRef(o.department) === offeringDepartment)).map((o) => [o.program._id, o.program.name])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const offeringSemesterOptions = [...new Set(visibleCourseOfferings.map((o) => Number(o.semester)))].sort((a, b) => a - b);

  // Group course offerings by selected criteria
  const groupOfferings = () => {
    const offeringsToGroup = filteredOfferings;

    // If no grouping options are selected, return a single group
    if (!Object.values(groupByOptions).some(value => value)) {
      return { "All Offerings": offeringsToGroup };
    }

    const grouped = {};
    
    offeringsToGroup.forEach(offering => {
      // Create a composite key based on selected grouping options
      const keyParts = [];
      
      if (groupByOptions.department) {
        const deptName = typeof offering.department === 'object' 
          ? offering.department.name 
          : (offering.department || 'Unassigned Department');
        keyParts.push(deptName);
      }
      
      if (groupByOptions.program) {
        const progName = typeof offering.program === 'object' 
          ? offering.program.name 
          : (offering.program || 'Unassigned Program');
        keyParts.push(progName);
      }
      
      if (groupByOptions.semester) {
        keyParts.push(semesterLabel(offering.semester));
      }
      
      const key = keyParts.join(' - ');
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      
      grouped[key].push(offering);
    });
    
    return grouped;
  };

  // Render a table for a specific group of offerings
  const closeOfferingEditor = () => { setEditingOffering(null); setOfferingEditError(''); };
  const handleOfferingEdit = async (form) => {
    setSavingOffering(true);
    setOfferingEditError('');
    try {
      const token = sessionStorage.getItem('adminToken');
      const { data } = await axios.put(
        `${apiUrl}/api/course-offerings/${editingOffering._id}`,
        { department: form.department, program: form.program, semester: Number(form.semester), isActive: form.isActive },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // The server answers with the updated, populated offering: swap it in rather than reloading the whole list.
      setCourseOfferings((prev) => prev.map((o) => (o._id === data._id ? data : o)));
      closeOfferingEditor();
      showToast('Course offering updated', TOAST_TYPES.SUCCESS);
    } catch (error) {
      setOfferingEditError(error.response?.data?.message || 'The offering could not be saved. Please try again.');
    } finally {
      setSavingOffering(false);
    }
  };

  const renderOfferingsTable = (groupName, offerings) => {
    return (
      <details className="offerings-group" key={groupName} open={filteredOfferings.length <= 40}>
        <summary className="group-title"><span>{groupName}</span><span className="group-count">{offerings.length} course{offerings.length === 1 ? '' : 's'}</span></summary>
        <div className="group-scroll"><table className="pk-table">
          <thead>
            <tr>
              <th>Course</th>
              {!groupByOptions.department && <th>Department</th>}
              {!groupByOptions.program && <th>Program</th>}
              {!groupByOptions.semester && <th>Semester</th>}
              <th>Term</th>
              <th>Status</th>
              <th aria-label="Actions"></th>
            </tr>
          </thead>
          <tbody>
            {offerings.map(offering => (
              <tr key={offering._id}>
                <td><span className="of-code">{offering.courseId?.code}</span> <span className="of-name">{offering.courseId?.name}</span></td>
                {!groupByOptions.department && <td>{typeof offering.department === 'object' ? offering.department.name : offering.department}</td>}
                {!groupByOptions.program && <td>{typeof offering.program === 'object' ? offering.program.name : offering.program}</td>}
                {!groupByOptions.semester && <td>{semesterLabel(offering.semester)}</td>}
                <td>
                  {offering.academicYearId && typeof offering.academicYearId === 'object'
                    ? offering.academicYearId.displayName || `${offering.academicYearId.semesterType} ${offering.academicYearId.year}`
                    : offering.semesterType && offering.year
                    ? `${offering.semesterType} ${offering.year}`
                    : 'N/A'}
                </td>
                <td><span className={`of-pill ${offering.isActive ? 'on' : 'off'}`}>{offering.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="offering-action-cell">
                  <button type="button" className="edit-btn" onClick={() => setEditingOffering(offering)} title="Edit offering" aria-label={`Edit ${offering.courseId?.code || ''} offering`}>
                    <FiEdit2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </details>
    );
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("");
    setCourseDepartment("");
    setCoursePage(0);
  };

  const handleDeactivateAcademicYearOfferings = async () => {
    const activeOfferingsInYear = visibleCourseOfferings.filter((offering) => offering.isActive);

    if (activeOfferingsInYear.length === 0) {
      showToast("No active course offerings found in the selected academic year", TOAST_TYPES.ERROR);
      return;
    }

    const selectedYearLabel = academicYearTabs.find((tab) => tab.key === selectedOfferingAcademicYear)?.label || "this academic year";
    setConfirmError("");
    setConfirm({ kind: "deactivate-offerings", count: activeOfferingsInYear.length, label: selectedYearLabel, offerings: activeOfferingsInYear });
  };

  const runDeactivateOfferings = async ({ offerings: activeOfferingsInYear, label: selectedYearLabel }) => {
    try {
      setDeactivating(true);
      const token = sessionStorage.getItem('adminToken');

      await Promise.all(
        activeOfferingsInYear.map((offering) =>
          axios.put(
            `${apiUrl}/api/course-offerings/${offering._id}`,
            { isActive: false },
            {
              headers: { Authorization: `Bearer ${token}` }
            }
          )
        )
      );

      showToast(`Deactivated ${activeOfferingsInYear.length} course offering(s) in ${selectedYearLabel}`, TOAST_TYPES.SUCCESS);
      setRefreshing(true);
      await fetchCourseOfferings();
      return true;
    } catch (error) {
      console.error('Error deactivating course offerings:', error);
      setConfirmError(error.response?.data?.message || 'Failed to deactivate course offerings');
      return false;
    } finally {
      setDeactivating(false);
      setRefreshing(false);
    }
  };

  const runRestoreCourse = async ({ data }) => {
    try {
      await axios.patch(`${apiUrl}/api/courses/${data.deletedCourseId}/restore`);
      setMessage({ text: "Course restored. It is available again in the courses list.", type: "success" });
      setCourse({ code: "", name: "", description: "", creditHours: "", isActive: true });
      fetchCourses();
      return true;
    } catch (restoreError) {
      setConfirmError(restoreError.response?.data?.message || "Failed to restore the course.");
      return false;
    }
  };

  const runConfirm = async () => {
    setConfirming(true);
    setConfirmError("");
    const done = confirm.kind === "delete" ? await runDeleteCourse(confirm.course._id)
      : confirm.kind === "restore" ? await runRestoreCourse(confirm)
      : await runDeactivateOfferings(confirm);
    setConfirming(false);
    if (done) setConfirm(null);
  };

  const confirmDialog = confirm && (
    <ConfirmModal
      title={confirm.kind === "delete" ? "Delete course" : confirm.kind === "restore" ? "Restore deleted course" : "Deactivate offerings"}
      body={
        confirm.kind === "delete"
          ? `Delete ${confirm.course.code} ${confirm.course.name}? It leaves the course list and its offerings are switched off. Adding a course with the same code later offers to bring it back.`
          : confirm.kind === "restore"
            ? `${confirm.data.message} Restore the deleted course now?`
            : `Deactivate ${confirm.count} active course offering${confirm.count === 1 ? "" : "s"} in ${confirm.label}?`
      }
      confirmLabel={confirm.kind === "delete" ? "Delete course" : confirm.kind === "restore" ? "Restore course" : "Deactivate"}
      busyText={confirm.kind === "delete" ? "Deleting…" : confirm.kind === "restore" ? "Restoring…" : "Deactivating…"}
      danger={confirm.kind !== "restore"}
      busy={confirming}
      error={confirmError}
      onConfirm={runConfirm}
      onClose={() => setConfirm(null)}
    />
  );

  // The offering being filled in, for the summary line and to know when the form is complete.
  const offerDraft = (() => {
    const draftCourse = courses.find((c) => c._id === courseOffering.courseId);
    const draftProgram = programs.find((p) => p._id === courseOffering.program);
    const draftTerm = academicYears.find((ay) => ay._id === courseOffering.academicYearId);
    return {
      course: draftCourse,
      program: draftProgram,
      termLabel: draftTerm ? (draftTerm.displayName || `${draftTerm.semesterType} ${draftTerm.year}`) : '',
      complete: Boolean(draftCourse && courseOffering.department && draftProgram && draftTerm),
    };
  })();

  // Step 1's side panel: what already exists, checked as the code or name is typed, so nothing is added twice.
  const typedCode = course.code.trim().toLowerCase();
  const typedName = course.name.trim().toLowerCase();
  const exactCourse = !editingCourse && typedCode ? courses.find((c) => c.code.toLowerCase() === typedCode) : null;
  const similarCourses = (typedCode || typedName.length >= 3)
    ? courses.filter((c) => c._id !== editingCourse?._id && c._id !== exactCourse?._id
        && ((typedCode && c.code.toLowerCase().includes(typedCode)) || (typedName.length >= 3 && c.name.toLowerCase().includes(typedName)))).slice(0, 5)
    : [];
  const createPanel = (
    <aside className="cr-panel" aria-label="Courses already in the system">
      <div className="cr-panel-head"><h3>Already in the system</h3><span className="cr-count">{courses.length}</span></div>
      {exactCourse && (
        <div className="cr-alert" role="status">
          <strong>{exactCourse.code} already exists</strong>
          <span>{exactCourse.name}</span>
          <button type="button" className="cintro-btn" onClick={() => { setCourseOffering((current) => ({ ...current, courseId: exactCourse._id })); setActiveTab('offerings'); }}>Offer {exactCourse.code} for a term →</button>
        </div>
      )}
      {similarCourses.length > 0 && (
        <ul className="cr-list">
          {similarCourses.map((c) => (
            <li key={c._id}><strong>{c.code}</strong><span>{c.name}</span>{!c.isActive && <em>Inactive</em>}</li>
          ))}
        </ul>
      )}
      {!exactCourse && similarCourses.length === 0 && <p className="cr-empty">Type a code or name and any similar course already here shows up, so you don't add one twice.</p>}
      <button type="button" className="cintro-link" onClick={() => setActiveTab('manage')}>Browse all courses</button>
    </aside>
  );

  // Step 2's side panel: the offering as it will be created, the create button, and where this course is already offered.
  const draftDepartment = departments.find((d) => d._id === courseOffering.department);
  const courseOfferingsOfDraft = offerDraft.course ? courseOfferings.filter((o) => String(o.courseId?._id ?? o.courseId) === offerDraft.course._id) : [];
  const alreadyOffered = offerDraft.complete && courseOfferingsOfDraft.some((o) => String(o.academicYearId?._id ?? o.academicYearId) === courseOffering.academicYearId && String(o.program?._id ?? o.program) === courseOffering.program && Number(o.semester) === Number(courseOffering.semester));
  const offerPanel = (
    <aside className="cr-panel cr-sticky" aria-label="Offering summary">
      <div className="cr-panel-head"><h3>Summary</h3></div>
      <ul className="cr-sum">
        <li className={offerDraft.course ? 'is-done' : ''}><i aria-hidden="true" /><span>Course</span><strong>{offerDraft.course ? `${offerDraft.course.code} ${offerDraft.course.name}` : 'Not chosen yet'}</strong></li>
        <li className={draftDepartment && offerDraft.program ? 'is-done' : ''}><i aria-hidden="true" /><span>Belongs to</span><strong>{draftDepartment && offerDraft.program ? `${offerDraft.program.name} · ${semesterLabel(courseOffering.semester)}` : 'Not chosen yet'}</strong></li>
        <li className={offerDraft.termLabel ? 'is-done' : ''}><i aria-hidden="true" /><span>Term</span><strong>{offerDraft.termLabel || 'Not chosen yet'}</strong></li>
      </ul>
      {alreadyOffered && <p className="of-warn">This exact offering already exists: {offerDraft.termLabel}, {offerDraft.program.name}, {semesterLabel(courseOffering.semester)}.</p>}
      <button className="pk-btn pk-btn-primary cr-submit" type="submit" form="offering-form" disabled={!offerDraft.complete}>Create offering</button>
      {courseOfferingsOfDraft.length > 0 && (
        <div className="cr-already">
          <h4>{offerDraft.course.code} is already offered</h4>
          <ul>
            {courseOfferingsOfDraft.slice(0, 6).map((o) => (
              <li key={o._id}>{getAcademicYearLabel(o)} · {typeof o.program === 'object' ? o.program?.name : 'Program'} · {semesterLabel(o.semester)}</li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );

  // Where things stand, in a few words under each step: how many courses exist, and how many are offered in the current term.
  const currentTerm = academicYears.find((ay) => ay.isCurrent);
  const offeredInCurrentTerm = currentTerm ? courseOfferings.filter((o) => String(o.academicYearId?._id ?? o.academicYearId) === String(currentTerm._id)).length : null;
  const stepCaptions = {
    create: `${courses.length} ${courses.length === 1 ? 'course' : 'courses'}`,
    offerings: currentTerm ? `${offeredInCurrentTerm} offered in ${currentTerm.displayName || `${currentTerm.semesterType} ${currentTerm.year}`}` : `${courseOfferings.length} ${courseOfferings.length === 1 ? 'offering' : 'offerings'}`,
  };

  return (
    <div className="course-container page-shell">
      <PageHeader
        title="Courses"
        subtitle="Set up a course in three steps: create it, offer it for a term, then assign a teacher."
        actions={
          <button type="button" className={`pk-btn course-all-btn ${activeTab === 'manage' ? 'is-on' : ''}`} aria-pressed={activeTab === 'manage'} onClick={() => { setEditingCourse(null); setActiveTab('manage'); }}>
            All courses
          </button>
        }
      />
      <CourseSetupSteps
        active={activeTab}
        captions={stepCaptions}
        onSelect={(tab) => {
          setActiveTab(tab);
          if (tab === 'create') setEditingCourse(null);
        }}
      />

      {message.text && <p className={`message ${message.type}`}>{message.text}</p>}

      {activeTab === 'create' && (
        <>
          {justCreated ? (
            <div className="cintro is-done" role="status">
              <p><strong>{justCreated.code} {justCreated.name}</strong> was created. Next, offer it for a term so it can be taught.</p>
              <button type="button" className="cintro-btn" onClick={() => {
                if (justCreated.id) setCourseOffering((current) => ({ ...current, courseId: justCreated.id }));
                setJustCreated(null);
                setActiveTab('offerings');
              }}>Offer {justCreated.code} for a term →</button>
            </div>
          ) : null}
          <div className="cr-split">
          <div className="course-form cf">
            <div className="cf-head">
              <h2>{editingCourse ? 'Edit course' : 'Create a new course'}</h2>
              <p>{editingCourse ? `Changing ${editingCourse.code}. Save when you are done.` : 'Fields marked * are required.'}</p>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="cf-grid">
                <div className="cf-field">
                  <label htmlFor="cf-code">Course code *</label>
                  <input id="cf-code" type="text" name="code" value={course.code} onChange={handleChange} placeholder="PF101" required />
                  <small className="field-hint">Short and unique, for example CS201.</small>
                </div>
                <div className="cf-field">
                  <label htmlFor="cf-credits">Credit hours *</label>
                  <input id="cf-credits" type="number" name="creditHours" value={course.creditHours} onChange={handleChange} placeholder="3" required />
                </div>
                <div className="cf-field cf-wide">
                  <label htmlFor="cf-name">Course name *</label>
                  <input id="cf-name" type="text" name="name" value={course.name} onChange={handleChange} placeholder="Programming Fundamentals" required />
                </div>
                <div className="cf-field cf-wide">
                  <label htmlFor="cf-description">Description *</label>
                  <textarea id="cf-description" name="description" value={course.description} onChange={handleChange} placeholder="Introductory course covering programming concepts, problem-solving, and algorithms." required />
                </div>
              </div>
              <label className="cf-switch">
                <input type="checkbox" name="isActive" checked={course.isActive} onChange={handleChange} />
                <span className="cf-track" aria-hidden="true" />
                <span className="cf-switch-text"><strong>Active</strong><small>Inactive courses can't be offered to students.</small></span>
              </label>
              <div className="form-actions">
                {editingCourse && (
                  <button type="button" className="pk-btn" onClick={() => { setEditingCourse(null); setCourse({ code: "", name: "", description: "", creditHours: "", isActive: true }); }}>
                    Cancel
                  </button>
                )}
                <button className="pk-btn pk-btn-primary" type="submit" disabled={saving}>
                  <BusyLabel busy={saving} busyText="Saving…" idle={editingCourse ? "Update course" : "Create course"} />
                </button>
              </div>
        </form>
          </div>
          {createPanel}
          </div>
        </>
      )}

      {activeTab === 'manage' && (
        <>
          <div className="cintro">
            <p>Every course in the system. Edit, switch off or delete one here.</p>
            <button type="button" className="cintro-link" onClick={() => { setEditingCourse(null); setActiveTab('create'); }}>Create a new course</button>
          </div>
          
          <div className="manage-courses-section">
            <div className="filters-container">
              <div className="search-container">
                <FiSearch className="search-icon" />
                <input
                  type="text"
                  placeholder="Search courses by code, name, or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              
              <div className="filter-container">
                <label>Department:</label>
                <select value={courseDepartment} onChange={(e) => setCourseDepartment(e.target.value)} className="filter-select">
                  <option value="">All departments</option>
                  {[...new Map(courseOfferings.filter((o) => o.department?._id).map((o) => [o.department._id, o.department.name])).entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                  <option value="none">Not offered yet</option>
                </select>
              </div>

              <div className="filter-container">
                <label>Filter by Status:</label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              
              <button 
                className="course-clear-btn"
                onClick={clearFilters}
              >
                <FiX /> Clear Filters
              </button>
            </div>
            
            <div className="courses-table-container">
              {firstLoad ? (
                <Loading variant="table" rows={8} label="Loading courses" />
              ) : filteredCourses.length === 0 ? (
                <NoResultsFound 
                  title="No Courses Found"
                  message="No courses match your search criteria. Try adjusting your filters or search terms."
                  icon="search"
                  actionButton={true}
                  actionButtonText="Clear Filters"
                  onActionButtonClick={clearFilters}
                />
              ) : (
                <table className="courses-table pk-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Description</th>
                      <th>Credit Hours</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.slice(coursePage * COURSES_PER_PAGE, (coursePage + 1) * COURSES_PER_PAGE).map((course) => (
                      <tr key={course._id} className={busyCourseId === course._id ? 'is-busy' : undefined} aria-busy={busyCourseId === course._id ? 'true' : undefined}>
                        <td>{course.code}</td>
                        <td>{course.name}</td>
                        <td>{[...new Set(courseOfferings.filter((o) => String(o.courseId?._id ?? o.courseId) === String(course._id) && o.department?.name).map((o) => o.department.name))].join(', ') || <span className="muted-cell">Not offered yet</span>}</td>
                        <td className="description-cell">{course.description}</td>
                        <td>{course.creditHours}</td>
                        <td>
                          <span className={`status-badge ${course.isActive ? 'active' : 'inactive'}`}>
                            {course.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="action-buttons">
                          <button 
                            className="toggle-btn"
                            onClick={() => handleToggleStatus(course._id, course.isActive)}
                            title={course.isActive ? "Deactivate Course" : "Activate Course"}
                            disabled={busyCourseId === course._id}
                          >
                            {busyCourseId === course._id ? <Spinner /> : course.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                          </button>
                          <button 
                            className="edit-btn"
                            onClick={() => handleEditCourse(course)}
                            title="Edit Course"
                            disabled={busyCourseId === course._id}
                          >
                            <FiEdit2 />
                          </button>
                          <button 
                            className="delete-btn"
                            onClick={() => handleDeleteCourse(course)}
                            title="Delete Course"
                            disabled={busyCourseId === course._id}
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {filteredCourses.length > COURSES_PER_PAGE && (
              <div className="courses-pager" role="navigation" aria-label="Course pages">
                <span>{coursePage * COURSES_PER_PAGE + 1}–{Math.min(filteredCourses.length, (coursePage + 1) * COURSES_PER_PAGE)} of {filteredCourses.length} courses</span>
                <div>
                  <button type="button" onClick={() => setCoursePage((p) => Math.max(0, p - 1))} disabled={coursePage === 0}>Previous</button>
                  <button type="button" onClick={() => setCoursePage((p) => p + 1)} disabled={(coursePage + 1) * COURSES_PER_PAGE >= filteredCourses.length}>Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'offerings' && (
        <>
          {editingOffering && (
            <OfferingEditModal
              offering={editingOffering}
              departments={departments}
              programs={programs}
              saving={savingOffering}
              error={offeringEditError}
              onSubmit={handleOfferingEdit}
              onClose={closeOfferingEditor}
            />
          )}
          {justOffered ? (
            <div className="cintro is-done" role="status">
              <p><strong>{justOffered.course}</strong> is now offered{justOffered.term ? ` in ${justOffered.term}` : ""}. Next, give each of its sections a teacher.</p>
              <button type="button" className="cintro-btn" onClick={() => { setJustOffered(null); setActiveTab('assignments'); }}>Assign a teacher →</button>
            </div>
          ) : null}
        <div className="offerings-section">
          <div className="cr-split">
          <form className="offering-form" id="offering-form" onSubmit={handleOfferingSubmit}>
            <div className="of-form-head">
              <h2>Offer a course for a term</h2>
              <p>Fields marked * are required.</p>
            </div>

            <section className="of-block">
              <h3 className="of-block-title">Course</h3>
              <div className="of-field">
                <label htmlFor="of-course">Which course? *</label>
                <select id="of-course" name="courseId" value={courseOffering.courseId} onChange={handleOfferingChange} required>
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>{course.code} - {course.name}</option>
                  ))}
                </select>
                {offerDraft.course ? (
                  <p className="of-picked"><strong>{offerDraft.course.code}</strong> {offerDraft.course.name} · {offerDraft.course.creditHours} credit hour{Number(offerDraft.course.creditHours) === 1 ? '' : 's'}</p>
                ) : (
                  <small className="field-hint">Can't find it? It needs creating first, in step 1.</small>
                )}
              </div>
            </section>

            <section className="of-block">
              <h3 className="of-block-title">Where it belongs</h3>
              <p className="of-block-hint">The department and program that teach it, and the semester of that program it sits in.</p>
              <div className="of-grid">
                <div className="of-field">
                  <label htmlFor="of-department">Department *</label>
                  <select id="of-department" name="department" value={courseOffering.department} onChange={handleOfferingChange} required disabled={deptProgLoading}>
                    <option value="">Select department</option>
                    {departments.map(dept => (
                      <option key={dept._id} value={dept._id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div className="of-field">
                  <label htmlFor="of-program">Program *</label>
                  <select id="of-program" name="program" value={courseOffering.program} onChange={handleOfferingChange} required disabled={deptProgLoading}>
                    <option value="">Select program</option>
                    {programs.map(prog => (
                      <option key={prog._id} value={prog._id}>{prog.name}</option>
                    ))}
                  </select>
                </div>
                <div className="of-field">
                  <label htmlFor="of-semester">Semester *</label>
                  <select id="of-semester" name="semester" value={courseOffering.semester} onChange={handleOfferingChange} required>
                    {(() => {
                      const program = getProgramById(courseOffering.program);
                      const maxSemesters = program?.typicalDuration || 8;
                      return Array.from({ length: maxSemesters + 1 }, (_, i) => (
                        <option key={i} value={i}>{i === 0 ? 'Pre-semester (0)' : semesterLabel(i)}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>
            </section>

            <section className="of-block">
              <h3 className="of-block-title" id="of-term-title">Academic term *</h3>
              <p className="of-block-hint">When it will be taught. A term that isn't listed is added under Academic Years.</p>
              {academicYears.length === 0 ? (
                <p className="of-warn">No academic terms available yet. Add one in the Academic Years page first.</p>
              ) : (
                <div className="of-terms" role="radiogroup" aria-labelledby="of-term-title">
                  {academicYears.map(ay => {
                    const on = courseOffering.academicYearId === ay._id;
                    return (
                      <button
                        key={ay._id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        className={`of-term ${on ? 'is-on' : ''}`}
                        onClick={() => handleOfferingChange({ target: { name: 'academicYearId', value: ay._id } })}
                      >
                        {ay.displayName || `${ay.semesterType} ${ay.year}`}
                        {ay.isCurrent && <em>Current</em>}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

          </form>
          {offerPanel}
          </div>

          <div className="offerings-list">
            <div className="offerings-header">
              <h3>Current Course Offerings</h3>
              <div className="offerings-header-actions">
                <button
                  type="button"
                  className="deactivate-offerings-btn"
                  onClick={handleDeactivateAcademicYearOfferings}
                  disabled={deactivating || visibleCourseOfferings.filter((offering) => offering.isActive).length === 0}
                >
                  <BusyLabel busy={deactivating} busyText="Deactivating…" idle="Deactivate Year Offerings" />
                </button>
                <div className="group-by-controls">
                  <label>Group by:</label>
                  <div className="group-by-checkboxes">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={groupByOptions.department}
                        onChange={() => handleGroupByChange('department')}
                      />
                      Department
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={groupByOptions.program}
                        onChange={() => handleGroupByChange('program')}
                      />
                      Program
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={groupByOptions.semester}
                        onChange={() => handleGroupByChange('semester')}
                      />
                      Semester
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {visibleCourseOfferings.length > 0 && (
              <div className="offering-filters" role="group" aria-label="Filter course offerings">
                <select value={offeringDepartment} onChange={(e) => { setOfferingDepartment(e.target.value); setOfferingProgram(''); }} aria-label="Department">
                  <option value="">All departments</option>
                  {offeringDepartmentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={offeringProgram} onChange={(e) => setOfferingProgram(e.target.value)} aria-label="Program">
                  <option value="">All programs</option>
                  {offeringProgramOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
                <select value={offeringSemester} onChange={(e) => setOfferingSemester(e.target.value)} aria-label="Semester">
                  <option value="">All semesters</option>
                  {offeringSemesterOptions.map((n) => <option key={n} value={n}>{semesterLabel(n)}</option>)}
                </select>
                <input type="search" value={offeringQuery} onChange={(e) => setOfferingQuery(e.target.value)} placeholder="Search course code or name" aria-label="Search course offerings" />
                <span className="offering-count">{filteredOfferings.length === visibleCourseOfferings.length ? `${visibleCourseOfferings.length} offerings` : `${filteredOfferings.length} of ${visibleCourseOfferings.length} offerings`}</span>
              </div>
            )}

            {academicYearTabs.length > 0 && (
              <div className="academic-year-tabs">
                {academicYearTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`academic-year-tab ${selectedOfferingAcademicYear === tab.key ? 'active' : ''}`}
                    onClick={() => setSelectedOfferingAcademicYear(tab.key)}
                  >
                    {tab.label}
                    {tab.isCurrent ? ' (Current)' : ''}
                  </button>
                ))}
              </div>
            )}
            
              <div className="content-section">
                {firstLoad ? (
                  <Loading variant="table" rows={6} label="Loading course offerings" />
                ) : visibleCourseOfferings.length === 0 || filteredOfferings.length === 0 ? (
                  <NoResultsFound 
                    title="No Course Offerings Found"
                    message="No course offerings exist for the selected academic year yet."
                    icon="filter"
                  />
                ) : (
                  <Refreshing active={refreshing}>
                    <div className="offerings-container">
                      {Object.entries(groupOfferings()).map(([groupName, offerings]) =>
                        renderOfferingsTable(groupName, offerings)
                      )}
                    </div>
                  </Refreshing>
            )}
          </div>
        </div>
          </div>
        </>
      )}

      {activeTab === 'assignments' && (
        <>
          <div className="cintro">
            <p>Choose a course, add its sections (for example A26-F), and pick a teacher for each. Course missing? Offer it for the term first.</p>
            <button type="button" className="cintro-link" onClick={() => setActiveTab('offerings')}>Go to step 2</button>
          </div>
          <TeacherAssignmentPage />
        </>
      )}
      {confirmDialog}
    </div>
  );
};

export default CoursePage;
