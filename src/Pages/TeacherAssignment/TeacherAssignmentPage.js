import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import { semesters } from '../../config/academicConfig';
import { FiX, FiCheck, FiPlus, FiEdit2 } from 'react-icons/fi';
import './TeacherAssignmentPage.css';

const getAssignedTeacherIds = (section) => {
  if (Array.isArray(section.teachers) && section.teachers.length > 0) {
    return section.teachers.map((teacher) => teacher.id);
  }

  if (section.teacher?.id) {
    return [section.teacher.id];
  }

  return [];
};

const formatTeacherNames = (teachersList = []) => {
  if (!Array.isArray(teachersList) || teachersList.length === 0) {
    return 'Unassigned';
  }

  return teachersList.map((teacher) => teacher.name || 'Unknown Teacher').join(', ');
};

const TeacherPicker = ({ teachers, selectedTeacherIds, onAddTeacher, onRemoveTeacher, emptyLabel }) => {
  const [pendingTeacherId, setPendingTeacherId] = useState('');

  const availableTeachers = useMemo(
    () => teachers.filter((teacher) => !selectedTeacherIds.includes(teacher._id)),
    [teachers, selectedTeacherIds]
  );

  useEffect(() => {
    if (availableTeachers.length === 0) {
      setPendingTeacherId('');
      return;
    }

    if (!pendingTeacherId || !availableTeachers.some((teacher) => teacher._id === pendingTeacherId)) {
      setPendingTeacherId(availableTeachers[0]._id);
    }
  }, [availableTeachers, pendingTeacherId]);

  const selectedTeachers = teachers.filter((teacher) => selectedTeacherIds.includes(teacher._id));

  return (
    <div className="teacher-picker">
      <div className="teacher-chip-list">
        {selectedTeachers.length > 0 ? (
          selectedTeachers.map((teacher) => {
            const teacherName = teacher.userId?.name || teacher.userId?.email || 'Unknown Teacher';

            return (
              <div key={teacher._id} className="teacher-chip">
                <div className="teacher-chip-copy">
                  <span className="teacher-chip-name">{teacherName}</span>
                  <span className="teacher-chip-meta">{teacher.employeeId || 'N/A'}</span>
                </div>
                <button
                  type="button"
                  className="teacher-chip-remove"
                  onClick={() => onRemoveTeacher(teacher._id)}
                  aria-label={`Remove ${teacherName}`}
                >
                  <FiX />
                </button>
              </div>
            );
          })
        ) : (
          <div className="teacher-picker-empty">{emptyLabel}</div>
        )}
      </div>

      <div className="teacher-picker-actions">
        <select
          value={pendingTeacherId}
          onChange={(e) => setPendingTeacherId(e.target.value)}
          className="teacher-select"
          disabled={availableTeachers.length === 0}
        >
          {availableTeachers.length > 0 ? (
            availableTeachers.map((teacher) => (
              <option key={teacher._id} value={teacher._id}>
                {(teacher.userId?.name || teacher.userId?.email || 'Unknown Teacher')} ({teacher.employeeId || 'N/A'})
              </option>
            ))
          ) : (
            <option value="">No more teachers available</option>
          )}
        </select>
        <button
          type="button"
          className="add-teacher-btn"
          onClick={() => pendingTeacherId && onAddTeacher(pendingTeacherId)}
          disabled={!pendingTeacherId || availableTeachers.length === 0}
        >
          <FiPlus />
          Add Teacher
        </button>
      </div>
    </div>
  );
};

const arraysEqual = (left = [], right = []) => {
  if (left.length !== right.length) return false;

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();

  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
};

// Create a separate component for each section to ensure isolation
const SectionItem = ({ section, teachers, onAssign, loading }) => {
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  
  // Initialize with current teachers if available
  useEffect(() => {
    setSelectedTeacherIds(getAssignedTeacherIds(section));
    setIsEditing(false);
  }, [section]);

  const initialTeacherIds = getAssignedTeacherIds(section);
  const hasChanges = !arraysEqual(selectedTeacherIds, initialTeacherIds);
  const assignedTeachers = teachers.filter((teacher) => selectedTeacherIds.includes(teacher._id));
  
  const handleAddTeacher = (teacherId) => {
    setSelectedTeacherIds((prev) => (prev.includes(teacherId) ? prev : [...prev, teacherId]));
  };

  const handleRemoveTeacher = (teacherId) => {
    setSelectedTeacherIds((prev) => prev.filter((id) => id !== teacherId));
  };

  const handleAssign = () => {
    onAssign(section, selectedTeacherIds);
  };

  const handleCancel = () => {
    setSelectedTeacherIds(initialTeacherIds);
    setIsEditing(false);
  };
  
  return (
    <div className={`section-item ${isEditing ? 'editing' : ''}`}>
      <div className="section-details">
        <span className="assignment-section-name">{section.section}</span>
        <span className="assignment-teacher-label">{selectedTeacherIds.length} assigned</span>
      </div>
      <div className="section-actions">
        {!isEditing ? (
          <>
            <div className="section-summary">
              {assignedTeachers.length > 0 ? (
                assignedTeachers.map((teacher) => {
                  const teacherName = teacher.userId?.name || teacher.userId?.email || 'Unknown Teacher';
                  return (
                    <div key={teacher._id} className="teacher-chip compact">
                      <div className="teacher-chip-copy">
                        <span className="teacher-chip-name">{teacherName}</span>
                        <span className="teacher-chip-meta">{teacher.employeeId || 'N/A'}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="teacher-picker-empty">No teachers assigned yet</div>
              )}
            </div>
            <div className="section-action-row">
              <button type="button" className="edit-assignees-btn" onClick={() => setIsEditing(true)}>
                <FiEdit2 />
                Edit
              </button>
            </div>
          </>
        ) : (
          <>
            <TeacherPicker
              teachers={teachers}
              selectedTeacherIds={selectedTeacherIds}
              onAddTeacher={handleAddTeacher}
              onRemoveTeacher={handleRemoveTeacher}
              emptyLabel="No teachers assigned yet"
            />
            <div className="section-action-row">
              <button type="button" className="secondary-action-btn" onClick={handleCancel}>
                Cancel
              </button>
              {hasChanges && (
                <button
                  className="assign-btn"
                  onClick={handleAssign}
                  disabled={selectedTeacherIds.length === 0 || loading}
                >
                  {loading ? 'Saving...' : 'Save Assignees'}
                </button>
              )}
            </div>
          </>
        )}
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
  const [newSection, setNewSection] = useState({ section: '', teacherIds: [] });

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

  const toggleNewSectionTeacher = (teacherId) => {
    setNewSection((prev) => ({
      ...prev,
      teacherIds: prev.teacherIds.includes(teacherId)
        ? prev.teacherIds.filter((id) => id !== teacherId)
        : [...prev.teacherIds, teacherId],
    }));
  };

  const addNewSectionTeacher = (teacherId) => {
    setNewSection((prev) => ({
      ...prev,
      teacherIds: prev.teacherIds.includes(teacherId) ? prev.teacherIds : [...prev.teacherIds, teacherId],
    }));
  };

  const removeNewSectionTeacher = (teacherId) => {
    setNewSection((prev) => ({
      ...prev,
      teacherIds: prev.teacherIds.filter((id) => id !== teacherId),
    }));
  };

  const handleAssign = async (section, teacherIds) => {
    if (!teacherIds || teacherIds.length === 0) {
      setError('Please select at least one teacher');
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
          teacherId: teacherIds[0],
          teacherIds,
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
          teacherId: teacherIds[0],
          teacherIds,
          section: newSection.section
        }, {
          headers: { 'x-auth-token': token }
        });
        setSuccess('Section added successfully');
        setNewSection({ section: '', teacherIds: [] });
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
    
    if (!newSection.teacherIds || newSection.teacherIds.length === 0) {
      setError('Please select at least one teacher');
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
        teacherId: newSection.teacherIds[0],
        teacherIds: newSection.teacherIds,
        section: newSection.section
      }, {
        headers: { 'x-auth-token': token }
      });
      setSuccess('Section added successfully');
      setNewSection({ section: '', teacherIds: [] });
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
          <p>Assign one or more teachers to each section. Use Add Teacher when a course should appear for multiple teachers.</p>
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
                  </div>
                  <div className="new-section-teachers">
                    <label className="new-section-label">Assigned teachers</label>
                    <TeacherPicker
                      teachers={teachers}
                      selectedTeacherIds={newSection.teacherIds}
                      onAddTeacher={addNewSectionTeacher}
                      onRemoveTeacher={removeNewSectionTeacher}
                      emptyLabel="No teachers selected yet"
                    />
                  </div>
                  <div className="new-section-actions">
                    <button
                      className="assign-btn"
                      onClick={handleAddSection}
                      disabled={!newSection.teacherIds.length || !newSection.section || loading}
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
