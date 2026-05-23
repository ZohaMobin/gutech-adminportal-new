import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import './StudentDirectoryPage.css';
import { FiSearch, FiFilter, FiX } from 'react-icons/fi'; // Import icons
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import LoadingSpinner from '../../Components/LoadingSpinner';
import NoResultsFound from '../../Components/NoResultsFound';

const StudentDirectoryPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    department: '',
    program: '',
    semester: '',
    search: ''
  });
  const [semesters, setSemesters] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('adminToken');
      
      if (!token) {
        toast.error('Authentication required. Please login again.');
        return;
      }

      const queryParams = {};
      if (filters.department) queryParams.department = filters.department;
      if (filters.program) queryParams.program = filters.program;
      if (filters.semester) queryParams.semester = filters.semester;
      if (filters.search) queryParams.search = filters.search;
      
      const response = await axios.get(`${apiUrl}/api/students`, {
        params: queryParams,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setStudents(response.data.students);
      setTotalStudents(response.data.total);
    } catch (error) {
      console.error('Error fetching students:', error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to fetch students. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, apiUrl]);

  // Fetch semesters when program is selected
  useEffect(() => {
    const fetchSemesters = async () => {
      if (filters.program) {
        try {
          const response = await axios.get(`${apiUrl}/api/student-directory/semesters`, {
            params: { program: filters.program },
          });
          setSemesters(response.data.semesters || []);
        } catch (err) {
          setSemesters([]);
        }
      } else {
        setSemesters([]);
      }
    };
    fetchSemesters();
  }, [filters.program, apiUrl]);

  useEffect(() => {
    fetchStudents();
  }, [filters, fetchStudents]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'department') {
      setFilters(prev => ({
        ...prev,
        department: value,
        program: '',
        semester: ''
      }));
    } else if (name === 'program') {
      setFilters(prev => ({
        ...prev,
        program: value,
        semester: ''
      }));
    } else {
      setFilters(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSearchChange = (e) => {
    setSearchInput(e.target.value);
  };

  const handleSearch = () => {
    setFilters(prev => ({
      ...prev,
      search: searchInput
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({
      department: '',
      program: '',
      semester: '',
      search: ''
    });
    setSearchInput('');
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  return (
    <div className="student-directory-container">
      <div className="page-header">
        <div className="header-content">
          <h1>Student Directory</h1>
          <p>Manage and view student information across all departments</p>
        </div>
        <div className="header-actions">
          <div className="search-bar">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search by name or roll number..."
              value={searchInput}
              onChange={handleSearchChange}
              onKeyPress={handleKeyPress}
            />
            <button className="search-button" onClick={handleSearch}>
              Search
            </button>
          </div>
          <button className="filter-toggle" onClick={toggleFilters}>
            <FiFilter /> Filters
          </button>
        </div>
      </div>

      <div className={`filters-panel ${showFilters ? 'show' : ''}`}>
        <div className="filters-header">
          <h3>Filter Students</h3>
          <button className="close-filters" onClick={toggleFilters}>
            <FiX />
          </button>
        </div>
        <div className="filters-content">
          <div className="filter-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              name="department"
              value={filters.department}
              onChange={handleFilterChange}
              disabled={deptProgLoading}
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="program">Program</label>
            <select
              id="program"
              name="program"
              value={filters.program}
              onChange={handleFilterChange}
              disabled={!filters.department || deptProgLoading}
            >
              <option value="">All Programs</option>
              {programs.map(prog => (
                <option key={prog._id} value={prog._id}>{prog.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="semester">Semester</label>
            <select
              id="semester"
              name="semester"
              value={filters.semester}
              onChange={handleFilterChange}
              disabled={!filters.program || semesters.length === 0}
            >
              <option value="">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>

          <button className="clear-filters-btn" onClick={clearFilters}>
            Clear All Filters
          </button>
        </div>
      </div>

      <div className="content-section">
        <div className="results-header">
          <div className="results-summary">
            <h3>Student List</h3>
            <span className="results-count">{totalStudents} students found</span>
          </div>
          {Object.values(filters).some(filter => filter) && (
            <div className="active-filters">
              {filters.department && (
                <span className="filter-tag">
                  Department: {departments.find(d => d._id === filters.department)?.name || filters.department}
                  <button onClick={() => handleFilterChange({ target: { name: 'department', value: '' } })}>
                    <FiX />
                  </button>
                </span>
              )}
              {filters.program && (
                <span className="filter-tag">
                  Program: {programs.find(p => p._id === filters.program)?.name || filters.program}
                  <button onClick={() => handleFilterChange({ target: { name: 'program', value: '' } })}>
                    <FiX />
                  </button>
                </span>
              )}
              {filters.semester && (
                <span className="filter-tag">
                  Semester: {filters.semester}
                  <button onClick={() => handleFilterChange({ target: { name: 'semester', value: '' } })}>
                    <FiX />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading students...</p>
          </div>
        ) : (
          <div className="students-table-container">
            {students.length > 0 ? (
              <table className="students-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Program</th>
                    <th>Semester</th>
                    <th>CGPA</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student._id}>
                      <td>{student.rollNumber}</td>
                      <td>{student.name || 'N/A'}</td>
                      <td>{student.email || 'N/A'}</td>
                      <td>{student.department?.name || student.department || 'N/A'}</td>
                      <td>{student.program?.name || student.program || 'N/A'}</td>
                      <td>{student.currentSemester ?? 'N/A'}</td>
                      <td className="cgpa-cell">
                        <span className={`cgpa-badge ${student.CGPA >= 3.5 ? 'high' : student.CGPA >= 2.5 ? 'medium' : 'low'}`}>
                          {student.CGPA?.toFixed(2) || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <NoResultsFound 
                title="No Students Found"
                message="No students match your current filter criteria. Try adjusting your filters or search terms."
                icon="search"
                actionButton={true}
                actionButtonText="Clear All Filters"
                onActionButtonClick={clearFilters}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDirectoryPage; 
