import Loading from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { showToast, TOAST_TYPES } from '../../Components/Toast/Toast';
import './StudentDirectoryPage.css';
import { FiSearch, FiFilter, FiX, FiChevronRight } from 'react-icons/fi'; // Import icons
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import NoResultsFound from '../../Components/NoResultsFound';
import { semesterLabel } from "../../utils/semester";
import "../Administrators/AdministratorsPage.css";
import "./StudentAccount.css";

const shortDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

const StudentDirectoryPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  // Filters, search and the Active / Inactive tab live in the address, so coming back from a student's profile
  // shows the same list.
  const [urlParams, setUrlParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(() => urlParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(() => ({
    department: urlParams.get('department') || '',
    program: urlParams.get('program') || '',
    semester: urlParams.get('semester') || '',
    search: urlParams.get('search') || ''
  }));
  const [semesters, setSemesters] = useState([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [status, setStatus] = useState(() => (urlParams.get('status') === 'inactive' ? 'inactive' : 'active'));
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    const next = Object.fromEntries(Object.entries({ ...filters, status: status === 'inactive' ? 'inactive' : '' }).filter(([, v]) => v));
    setUrlParams(next, { replace: true });
  }, [filters, status, setUrlParams]);

  const openStudent = (student) => navigate(`/students/${student._id}`, { state: { from: `${location.pathname}${location.search}` } });

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('adminToken');
      
      if (!token) {
        showToast('Authentication required. Please login again.', TOAST_TYPES.ERROR);
        return;
      }

      const queryParams = { status };
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
      setCounts(response.data.counts || null);
    } catch (error) {
      console.error('Error fetching students:', error);
      if (error.response?.status === 401) {
        showToast('Session expired. Please login again.', TOAST_TYPES.ERROR);
      } else {
        showToast('Failed to fetch students. Please try again.', TOAST_TYPES.ERROR);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, apiUrl, status]);

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
    <div className="student-directory-container page-shell">
      <PageHeader
        title="Student Directory"
        subtitle="Manage and view student information across all departments"
        actions={
          <>
            <div className="search-bar">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search by name or roll number..."
                value={searchInput}
                onChange={handleSearchChange}
                onKeyPress={handleKeyPress}
                aria-label="Search students"
              />
              <button className="search-button" onClick={handleSearch}>
                Search
              </button>
            </div>
            <button className="filter-toggle" onClick={toggleFilters}>
              <FiFilter /> Filters
            </button>
          </>
        }
      />

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
                <option key={sem} value={sem}>{semesterLabel(sem)}</option>
              ))}
            </select>
          </div>

          <button className="sd-clear-btn" onClick={clearFilters}>
            Clear All Filters
          </button>
        </div>
      </div>

      <div className="content-section">
        <div className="results-header">
          <div className="results-summary">
            <h3>Student List</h3>
            <span className="results-count">{totalStudents} {status === 'inactive' ? 'inactive' : ''} student{totalStudents === 1 ? '' : 's'}</span>
            <div className="am-tabs sda-tabs" role="tablist" aria-label="Account status">
              {[['active', 'Active'], ['inactive', 'Inactive']].map(([key, label]) => (
                <button key={key} role="tab" aria-selected={status === key} className={`am-tab ${status === key ? 'is-active' : ''}`} onClick={() => setStatus(key)}>
                  {label}{counts && <span className="am-count">{counts[key]}</span>}
                </button>
              ))}
            </div>
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
          <Loading variant="table" rows={8} label="Loading students" />
        ) : (
          <div className="students-table-container">
            {students.length > 0 ? (
              <table className="pk-table">
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Program</th>
                    <th>Semester</th>
                    {status === 'inactive' ? <th>Deactivated</th> : <th>CGPA</th>}
                    <th className="sda-actions-col"><span className="sda-sr">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr
                      key={student._id}
                      className="sda-row"
                      tabIndex={0}
                      onClick={() => openStudent(student)}
                      onKeyDown={(e) => { if (e.key === 'Enter') openStudent(student); }}
                      aria-label={`Open ${student.name}`}
                    >
                      <td>{student.rollNumber}</td>
                      <td>{student.name || 'N/A'}</td>
                      <td>{student.email || 'N/A'}</td>
                      <td>{student.department?.name || student.department || 'N/A'}</td>
                      <td>{student.program?.name || student.program || 'N/A'}</td>
                      <td>{student.currentSemester ?? 'N/A'}</td>
                      {status === 'inactive' ? (
                        <td className="sda-status-cell">
                          <span className="sda-badge">{student.account?.categoryLabel || 'Inactive'}</span>
                          <small>{shortDate(student.account?.deactivatedAt)}{student.account?.note ? ` · ${student.account.note}` : ''}</small>
                        </td>
                      ) : (
                        <td className="cgpa-cell">
                          <span className={`cgpa-badge ${student.CGPA >= 3.5 ? 'high' : student.CGPA >= 2.5 ? 'medium' : 'low'}`}>
                            {student.CGPA?.toFixed(2) || 'N/A'}
                          </span>
                        </td>
                      )}
                      <td className="sda-actions-col"><FiChevronRight className="sda-open" aria-hidden="true" />                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              status === 'inactive' && !Object.values(filters).some(Boolean) ? (
              <div className="sda-empty">
                <strong>No inactive students</strong>
                <span>Students who withdraw, leave or are suspended appear here. Open a student and use the ⋯ menu to deactivate them.</span>
              </div>
              ) : <NoResultsFound 
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
