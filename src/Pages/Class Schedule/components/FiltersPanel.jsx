import React from 'react';
import { useDepartmentsAndPrograms } from '../../../hooks/useDepartmentsAndPrograms';
import { semesters } from '../../../config/academicConfig';
import './FiltersPanel.css';

const FiltersPanel = ({
  filters,
  handleFilterChange,
  clearFilters,
  sections,
  teachers,
  selectedSection,
  setSelectedSection,
  formatSectionName,
  formatTeacherName,
  setShowAddModal,
  setSelectedSchedule,
  sectionColors
}) => {
  const { departments, programs, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="schedule-filters-panel">
      <div className="panel-content">
        <h2 className="panel-title">Filters</h2>
        
        <div className="filter-group">
          <label>Department:</label>
          <select 
            value={filters.department} 
            onChange={(e) => handleFilterChange('department', e.target.value)}
            disabled={deptProgLoading}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept._id} value={dept._id}>{dept.name}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Program:</label>
          <select 
            value={filters.program} 
            onChange={(e) => handleFilterChange('program', e.target.value)}
            disabled={deptProgLoading}
          >
            <option value="">All Programs</option>
            {programs.map(prog => (
              <option key={prog._id} value={prog._id}>{prog.name}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Day:</label>
          <select 
            value={filters.day} 
            onChange={(e) => handleFilterChange('day', e.target.value)}
          >
            <option value="">All Days</option>
            {days.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Teacher:</label>
          <select 
            value={filters.teacher} 
            onChange={(e) => handleFilterChange('teacher', e.target.value)}
          >
            <option value="">All Teachers</option>
            {teachers.map(teacher => (
              <option key={teacher._id} value={teacher._id}>
                {formatTeacherName(teacher)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Section:</label>
          <select 
            value={filters.section} 
            onChange={(e) => handleFilterChange('section', e.target.value)}
          >
            <option value="">All Sections</option>
            {sections.map(section => (
              <option key={section._id} value={section._id}>
                {formatSectionName(section)}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className="clear-filters-btn"
          onClick={clearFilters}
        >
          Clear Filters
        </button>
        
        <div className="separator"></div>
        
        <h2 className="panel-title">Add Schedule</h2>
        
        <div className="filter-group">
          <label>Select Section:</label>
          <select 
            value={selectedSection?._id || ''} 
            onChange={(e) => {
              const section = sections.find(s => s._id === e.target.value);
              setSelectedSection(section);
            }}
          >
            <option value="">Select a section...</option>
            {sections.map(section => (
              <option key={section._id} value={section._id}>
                {formatSectionName(section)}
              </option>
            ))}
          </select>
        </div>
        
        <button 
          className="add-schedule-btn"
          onClick={() => {
            setSelectedSchedule(null);
            setShowAddModal(true);
          }}
          disabled={!selectedSection}
        >
          Add New Schedule
        </button>
        
        <div className="separator"></div>
        
        <div className="legend">
          <h3>Color Legend</h3>
          <div className="legend-items">
            {Object.entries(sectionColors).map(([sectionId, color]) => {
              const section = sections.find(s => s._id === sectionId);
              if (!section) return null;
              
              return (
                <div className="legend-item" key={sectionId}>
                  <div className="legend-color" style={{ backgroundColor: color }}></div>
                  <div className="legend-label">{section.section} - {section.courseId?.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiltersPanel; 