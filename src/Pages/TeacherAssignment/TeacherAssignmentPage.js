import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import { semesters } from '../../config/academicConfig';
import { FiInfo, FiX, FiCheck, FiSearch, FiFilter } from 'react-icons/fi';
import './TeacherAssignmentPage.css';

// Create a separate component for each section to ensure isolation
const SectionItem = ({ section, teachers, onAssign, loading }) => {
  const [selectedTeacher, setSelectedTeacher] = useState('');
  
  // Initialize with current teacher if available
  useEffect(() => {
    if (section.teacher && section.teacher.id) {
      setSelectedTeacher(section.teacher.id);
    }
  }, [section]);
  
  const handleTeacherChange = (e) => {
    setSelectedTeacher(e.target.value);
  };
  
  const handleAssign = () => {
    onAssign(section, selectedTeacher);
  };
  
  return (
    <div className="section-item">
      <div className="section-details">
        <span className="assignment-section-name">{section.section}</span>
        <span className="assignment-teacher-name">
          {section.teacher?.name || 'Unassigned'}
        </span>
      </div>
      <div className="section-actions">
        <select
          value={selectedTeacher}
          onChange={handleTeacherChange}
          className="teacher-select"
        >
          <option value="">Select Teacher</option>
          {teachers.length > 0 ? (
            teachers.map((teacher) => (
            <option key={teacher._id} value={teacher._id}>
                {teacher.userId?.name || teacher.userId?.email || 'Unknown Teacher'} ({teacher.employeeId || 'N/A'})
            </option>
            ))
          ) : (
            <option value="" disabled>No teachers available</option>
          )}
        </select>
        <button
          className="assign-btn"
          onClick={handleAssign}
          disabled={!selectedTeacher || loading}
        >
          {loading ? 'Assigning...' : 'Assign'}
        </button>
      </div>
    </div>
  );
};

const TeacherAssignmentPage = () => {
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSection, setSelectedSection] = useState(null);
  const [showHelp, setShowHelp] = useState(true);
  const [newSection, setNewSection] = useState({ section: '', teacherId: '' });
  const [sectionTeachers, setSectionTeachers] = useState({});

  const apiUrl = process.env.REACT_APP_BACKEND_URL;

  // Add axios interceptor for handling connection errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.code === 'ECONNRESET' || error.code === 'ECONNABORTED') {
          setError('Connection to server was lost. Please try again.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  // Clear success message when filters change
  useEffect(() => {
    setSuccess(null);
  }, [selectedDepartment, selectedProgram, selectedSemester, selectedCourse]);

  // Auto-clear success message after 5 seconds
  useEffect(() => {
    let timer;
    if (success) {
      timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [success]);

  useEffect(() => {
    if (selectedDepartment && selectedProgram && selectedSemester) {
      fetchCourses();
      fetchTeachers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartment, selectedProgram, selectedSemester]);

  useEffect(() => {
    if (selectedCourse) {
      fetchSections();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedSection) {
      setError(null);
      fetchStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const encodedDepartment = encodeURIComponent(selectedDepartment);
      const encodedProgram = encodeURIComponent(selectedProgram);
      const encodedSemester = encodeURIComponent(selectedSemester);
      
      const token = sessionStorage.getItem('adminToken');
      const response = await axios.get(`${apiUrl}/api/courses/department/${encodedDepartment}/program/${encodedProgram}/semester/${encodedSemester}`, {
        headers: { 'x-auth-token': token }
      });
      setCourses(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch courses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async () => {
    try {
      const token = sessionStorage.getItem('adminToken');
      const response = await axios.get(`${apiUrl}/api/teachers`, {
        headers: { 'x-auth-token': token }
      });
      
      // Show all teachers regardless of department
      setTeachers(response.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch teachers. Please try again.');
    }
  };

  const fetchSections = async () => {
    if (!selectedCourse) return;
    
    try {
      setLoading(true);
      const token = sessionStorage.getItem('adminToken');
      const response = await axios.get(`${apiUrl}/api/sections/course/${selectedCourse}`, {
        headers: { 'x-auth-token': token }
      });
      
      setSections(response.data);
      
      // Initialize sectionTeachers with current teacher assignments
      const initialSectionTeachers = {};
      response.data.forEach(section => {
        if (section.teacher && section.teacher.id) {
          initialSectionTeachers[section._id] = section.teacher.id;
        }
      });
      setSectionTeachers(initialSectionTeachers);
      
    } catch (err) {
      console.error('Error fetching sections:', err);
      setError(err.response?.data?.message || 'Failed to fetch sections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    if (!selectedSection) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const token = sessionStorage.getItem('adminToken');
      await axios.get(`${apiUrl}/api/course-registrations/getStudents/${selectedSection}`, {
        headers: { 'x-auth-token': token }
      });
    } catch (error) {
      if (error.response?.status === 404) {
        setError('No students are currently enrolled in this section');
      } else {
        setError(error.response?.data?.message || 'Failed to fetch students');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (section, teacherId) => {
    if (!teacherId) {
      setError('Please select a teacher');
      return;
    }

    try {
      setLoading(true);
      const token = sessionStorage.getItem('adminToken');
      
      // If section is provided, update existing section
      if (section) {
        const sectionId = section._id || section.id;
        
        if (!sectionId) {
          console.error('No section ID found in section:', section);
          throw new Error('Invalid section ID');
        }
        
        // Update existing section
        await axios.put(`${apiUrl}/api/sections/${sectionId}`, {
          teacherId: teacherId,
          section: section.section
        }, {
          headers: { 'x-auth-token': token }
        });
        setSuccess('Teacher assigned successfully');
      } else {
        // Add new section
        if (!selectedCourse) {
          setError('Please select a course');
          return;
        }
        
        // Make section name mandatory for new sections
        if (!newSection.section || newSection.section.trim() === '') {
          setError('Please enter a section name');
          return;
        }
        
        await axios.post(`${apiUrl}/api/sections/addSection`, {
          courseId: selectedCourse,
          teacherId: teacherId,
          section: newSection.section
        }, {
          headers: { 'x-auth-token': token }
        });
        setSuccess('Section added successfully');
        setNewSection({ section: '', teacherId: '' });
      }
      
      fetchSections();
    } catch (err) {
      console.error('Error in handleAssign:', err);
      setError(err.response?.data?.message || err.message || 'Failed to assign teacher. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSection = async () => {
    if (!selectedCourse) {
      setError('Please select a course');
      return;
    }
    
    if (!newSection.teacherId) {
      setError('Please select a teacher');
      return;
    }
    
    // Make section name mandatory for new sections
    if (!newSection.section || newSection.section.trim() === '') {
      setError('Please enter a section name');
      return;
    }
    
    try {
      setLoading(true);
      const token = sessionStorage.getItem('adminToken');
      
      await axios.post(`${apiUrl}/api/sections/addSection`, {
        courseId: selectedCourse,
        teacherId: newSection.teacherId,
        section: newSection.section
      }, {
        headers: { 'x-auth-token': token }
      });
      setSuccess('Section added successfully');
      setNewSection({ section: '', teacherId: '' });
      fetchSections();
    } catch (err) {
      console.error('Error adding section:', err);
      setError(err.response?.data?.message || err.message || 'Failed to add section. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedDepartment('');
    setSelectedProgram('');
    setSelectedSemester('');
    setSelectedCourse('');
    setCourses([]);
    setTeachers([]);
    setSections([]);
    setSuccess(null);
  };

  return (
    <div className="teacher-assignment-container">
      {showHelp && (
        <div className="course-important-note">
          <p>In case, no sections exist. Create a new section.</p>
          <button className="course-close-note-btn" onClick={() => setShowHelp(false)}>×</button>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button className="dismiss-btn" onClick={() => setError(null)}>
            <FiX />
          </button>
        </div>
      )}

      {success && (
        <div className="success-message">
          <FiCheck className="success-icon" />
          {success}
          <button className="dismiss-btn" onClick={() => setSuccess(null)}>
            <FiX />
          </button>
        </div>
      )}

      <div className="filters-section">
        <div className="filters-header">
          <h3>Filter Courses</h3>
          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
        <div className="filters-grid">
          <div className="filter-group">
            <label>Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className={selectedDepartment ? 'selected' : ''}
              disabled={deptProgLoading}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Program</label>
            <select
              value={selectedProgram}
              onChange={(e) => setSelectedProgram(e.target.value)}
              disabled={!selectedDepartment || deptProgLoading}
              className={selectedProgram ? 'selected' : ''}
            >
              <option value="">Select Program</option>
              {programs.map((prog) => (
                <option key={prog._id} value={prog._id}>{prog.name}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              disabled={!selectedProgram}
              className={selectedSemester ? 'selected' : ''}
            >
              <option value="">Select Semester</option>
              {semesters.map((sem) => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              disabled={!selectedSemester}
              className={selectedCourse ? 'selected' : ''}
            >
              <option value="">Select Course</option>
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedCourse && (
        <div className="assignment-section">
          <div className="course-info">
            <h4>Selected Course</h4>
            <p>{courses.find(c => c._id === selectedCourse)?.code} - {courses.find(c => c._id === selectedCourse)?.name}</p>
          </div>

          <div className="section-info">
            <h4>Current Sections</h4>
            {loading ? (
              <div className="loading-spinner">Loading sections...</div>
            ) : (
              <>
                <div className="sections-list">
                  {sections.length > 0 ? (
                    sections.map((section) => (
                      <SectionItem 
                        key={section._id || section.id}
                        section={section}
                        teachers={teachers}
                        onAssign={handleAssign}
                        loading={loading}
                      />
                    ))
                  ) : (
                    <p className="no-sections">No sections available for this course. Create a section to proceed.</p>
                  )}
                </div>

                <div className="add-section-form">
                  <h4>Add New Section</h4>
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Section Name (required)"
                      value={newSection.section}
                      onChange={(e) => setNewSection({ ...newSection, section: e.target.value })}
                      className="section-input"
                      required
                    />
                    <select
                      value={newSection.teacherId}
                      onChange={(e) => setNewSection({ ...newSection, teacherId: e.target.value })}
                      className="teacher-select"
                    >
                      <option value="">Select Teacher</option>
                      {teachers.length > 0 ? (
                        teachers.map((teacher) => (
                        <option key={teacher._id} value={teacher._id}>
                            {teacher.userId?.name || teacher.userId?.email || 'Unknown Teacher'} ({teacher.employeeId || 'N/A'})
                        </option>
                        ))
                      ) : (
                        <option value="" disabled>No teachers available for this department</option>
                      )}
                    </select>
                    <button
                      className="assign-btn"
                      onClick={handleAddSection}
                      disabled={!newSection.teacherId || !newSection.section || loading}
                    >
                      {loading ? 'Adding...' : 'Add Section'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAssignmentPage; 