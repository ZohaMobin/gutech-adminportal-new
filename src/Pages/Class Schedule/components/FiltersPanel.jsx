import React from 'react';
import { useDepartmentsAndPrograms } from '../../../hooks/useDepartmentsAndPrograms';
import './FiltersPanel.css';

// The filters and the "add a class" control, laid out as one toolbar above the timetable so the timetable gets the full
// page width (a side panel left room for only three of the five days).
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
  const legend = Object.entries(sectionColors)
    .map(([sectionId, color]) => ({ sectionId, color, section: sections.find(s => s._id === sectionId) }))
    .filter(item => item.section);

  return (
    <div className="cs-toolbar">
      <section className="cs-card" aria-label="Filter the timetable">
        <div className="cs-filters">
          <label>
            <span>Department</span>
            <select value={filters.department} onChange={(e) => handleFilterChange('department', e.target.value)} disabled={deptProgLoading}>
              <option value="">All departments</option>
              {departments.map(dept => <option key={dept._id} value={dept._id}>{dept.name}</option>)}
            </select>
          </label>
          <label>
            <span>Program</span>
            <select value={filters.program} onChange={(e) => handleFilterChange('program', e.target.value)} disabled={deptProgLoading}>
              <option value="">All programs</option>
              {programs.map(prog => <option key={prog._id} value={prog._id}>{prog.name}</option>)}
            </select>
          </label>
          <label>
            <span>Day</span>
            <select value={filters.day} onChange={(e) => handleFilterChange('day', e.target.value)}>
              <option value="">All days</option>
              {days.map(day => <option key={day} value={day}>{day}</option>)}
            </select>
          </label>
          <label>
            <span>Teacher</span>
            <select value={filters.teacher} onChange={(e) => handleFilterChange('teacher', e.target.value)}>
              <option value="">All teachers</option>
              {teachers.map(teacher => <option key={teacher._id} value={teacher._id}>{formatTeacherName(teacher)}</option>)}
            </select>
          </label>
          <label>
            <span>Section</span>
            <select value={filters.section} onChange={(e) => handleFilterChange('section', e.target.value)}>
              <option value="">All sections</option>
              {sections.map(section => <option key={section._id} value={section._id}>{formatSectionName(section)}</option>)}
            </select>
          </label>
          <button type="button" className="cs-btn" onClick={clearFilters}>Clear</button>
        </div>

        <div className="cs-add">
          <label>
            <span>Add a class to</span>
            <select
              value={selectedSection?._id || ''}
              onChange={(e) => setSelectedSection(sections.find(s => s._id === e.target.value))}
            >
              <option value="">Select a section…</option>
              {sections.map(section => <option key={section._id} value={section._id}>{formatSectionName(section)}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="cs-btn cs-btn-primary"
            onClick={() => { setSelectedSchedule(null); setShowAddModal(true); }}
            disabled={!selectedSection}
          >
            + Add schedule
          </button>
        </div>
      </section>

      {legend.length > 0 && (
        <ul className="cs-legend" aria-label="Section colours">
          {legend.map(({ sectionId, color, section }) => (
            <li key={sectionId}>
              <span className="cs-swatch" style={{ backgroundColor: color }} />
              {section.section} - {section.courseId?.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FiltersPanel;
