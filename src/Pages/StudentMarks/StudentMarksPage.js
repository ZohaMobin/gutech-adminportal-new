import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import { semesters } from '../../config/academicConfig';
import './StudentMarksPage.css';
import { FiSearch, FiFilter, FiDownload } from 'react-icons/fi';
import LoadingSpinner from '../../Components/LoadingSpinner';
import NoResultsFound from '../../Components/NoResultsFound';

const StudentMarksPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001';
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [marksData, setMarksData] = useState([]);
  const [filters, setFilters] = useState({
    department: '',
    program: '',
    semester: '',
    course: '',
    section: ''
  });
  const [availableFilters, setAvailableFilters] = useState({
    courses: [],
    sections: []
  });
  const [showHelp, setShowHelp] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Get auth token from session storage
  const getAuthToken = () => {
    return sessionStorage.getItem('adminToken');
  };

  // Fetch courses data when department, program, and semester are selected
  useEffect(() => {
    const fetchCourses = async () => {
      if (!filters.department || !filters.program || !filters.semester) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Use the correct API endpoint for courses with auth token
        const courseRes = await axios.get(
          `${apiUrl}/api/courses/department/${encodeURIComponent(filters.department)}/program/${encodeURIComponent(filters.program)}/semester/${filters.semester}`,
          {
            headers: {
              'x-auth-token': getAuthToken()
            }
          }
        );
        
        setAvailableFilters(prev => ({
          ...prev,
          courses: courseRes.data
        }));
      } catch (err) {
        setError('Failed to load courses. Please try again.');
        console.error('Error loading courses:', err);
        // Keep existing courses if available
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [filters.department, filters.program, filters.semester, apiUrl]);

  // Fetch sections data when course is selected
  useEffect(() => {
    const fetchSections = async () => {
      if (!filters.course) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Use the correct API endpoint for sections with auth token
        // Make sure we're using the course ID, not the course name
        const sectionRes = await axios.get(
          `${apiUrl}/api/sections/course-enrollment/${filters.course}`,
          {
            headers: {
              'x-auth-token': getAuthToken()
            }
          }
        );

        // Update to handle the new response structure
        setAvailableFilters(prev => ({
          ...prev,
          sections: sectionRes.data.sections || []
        }));
      } catch (err) {
        setError('Failed to load sections. Please try again.');
        console.error('Error loading sections:', err);
        // Keep existing sections if available
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [filters.course, apiUrl]);

  // Fetch marks data when all filters are selected
  useEffect(() => {
    const fetchMarksData = async () => {
      // Only proceed if all required filters are selected
      if (!filters.department || !filters.program || !filters.semester || !filters.course || !filters.section) return;

      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${apiUrl}/api/student-marks`, {
          params: filters,
          headers: {
            'x-auth-token': getAuthToken()
          }
        });
        setMarksData(response.data.data || []);
      } catch (err) {
        setError('Failed to load marks data. Please try again.');
        console.error('Error loading marks data:', err);
        setMarksData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMarksData();
  }, [filters.department, filters.program, filters.semester, filters.course, filters.section, apiUrl]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value,
      // Reset dependent filters
      ...(filterType === 'department' && { program: '', semester: '', course: '', section: '' }),
      ...(filterType === 'program' && { semester: '', course: '', section: '' }),
      ...(filterType === 'semester' && { course: '', section: '' }),
      ...(filterType === 'course' && { section: '' })
    }));
  };

  const clearFilters = () => {
    setFilters({
      department: '',
      program: '',
      semester: '',
      course: '',
      section: ''
    });
    setError(null);
  };

  const calculateTotalMarks = (student) => {
    if (!student.assessmentTypes) return 0;
    
    return student.assessmentTypes.reduce((total, type) => {
      // Skip calculation if maxMarks is zero to avoid division by zero
      if (type.totalMaxMarks === 0) return total;
      
      const weightedMarks = (type.totalObtainedMarks / type.totalMaxMarks) * type.totalWeightage;
      return total + weightedMarks;
    }, 0);
  };

  // Filter marks data based on search query
  const filteredMarksData = marksData.filter(student => 
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.rollNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="student-marks-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Student Marks</h1>
          <p>View and manage student marks for different courses and sections</p>
        </div>
      </div>

      {showHelp && (
        <div className="help-text">
          <p>Once all filters are selected, the marks table will be displayed below.</p>
          <button 
            className="close-help" 
            onClick={() => setShowHelp(false)}
            aria-label="Close help text"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)} className="dismiss-error-btn">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              disabled={deptProgLoading}
            >
              <option value="">Select Department</option>
              {departments.map(dept => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="program">Program</label>
            <select
              id="program"
              value={filters.program}
              onChange={(e) => handleFilterChange('program', e.target.value)}
              disabled={!filters.department || deptProgLoading}
            >
              <option value="">Select Program</option>
              {programs.map(prog => (
                <option key={prog._id} value={prog._id}>{prog.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="semester">Semester</label>
            <select
              id="semester"
              value={filters.semester}
              onChange={(e) => handleFilterChange('semester', e.target.value)}
              disabled={!filters.program}
            >
              <option value="">Select Semester</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="course">Course</label>
            <select
              id="course"
              value={filters.course}
              onChange={(e) => handleFilterChange('course', e.target.value)}
              disabled={!filters.semester || loading}
            >
              <option value="">Select Course</option>
              {availableFilters.courses.map(course => (
                <option key={course._id} value={course._id}>{course.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="section">Section</label>
            <select
              id="section"
              value={filters.section}
              onChange={(e) => handleFilterChange('section', e.target.value)}
              disabled={!filters.course || loading}
            >
              <option value="">Select Section</option>
              {availableFilters.sections.map(section => (
                <option key={section.id} value={section.id}>
                  Section {section.section} - {section.teacher?.userId?.name || 'No teacher assigned'}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button className="clear-filters-btn" onClick={clearFilters}>
          Clear Filters
        </button>
      </div>

      {/* Marks Table Section */}
      <div className="marks-table-section">
        <div className="table-header">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        <div className="table-container">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading marks data...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <p>{error}</p>
            </div>
          ) : filteredMarksData.length === 0 ? (
            <div className="no-data-container">
              <p>No marks data found</p>
            </div>
          ) : (
            <table className="marks-table">
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Student Name</th>
                  {filteredMarksData.length > 0 && filteredMarksData[0].assessmentTypes?.map((type, index) => (
                    <th key={index}>
                      {type.type.charAt(0).toUpperCase() + type.type.slice(1)} ({type.totalWeightage}%)
                    </th>
                  ))}
                  <th>Total (100%)</th>
                </tr>
              </thead>
              <tbody>
                {filteredMarksData.map(student => (
                  <tr key={student.id}>
                    <td>{student.rollNumber}</td>
                    <td>{student.name}</td>
                    {student.assessmentTypes && student.assessmentTypes.map((type, index) => (
                      <td key={index} className="marks-cell">
                        {type.totalObtainedMarks.toFixed(2)} / {type.totalMaxMarks}
                      </td>
                    ))}
                    <td className="total-marks">
                      {calculateTotalMarks(student).toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentMarksPage; 