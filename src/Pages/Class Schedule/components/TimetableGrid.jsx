import React from 'react';
import { formatSectionTeachers } from '../../../utils/sectionTeachers';
import { buildPeriods, periodIndexOf } from '../../../utils/timetablePeriods';
import './TimetableGrid.css';

const TimetableGrid = ({
  filteredSchedules,
  sections,
  teachers,
  getSectionColor,
  handleEditSchedule,
  handleDeleteSchedule,
  filters,
  clearFilters
}) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  // Whole-hour rows only when nothing is scheduled yet; otherwise the rows are the real class windows (08:30-09:55, ...).
  const emptyHours = Array.from({ length: 9 }, (_, i) => ({ start: `${String(8 + i).padStart(2, '0')}:00`, end: `${String(9 + i).padStart(2, '0')}:00` }));
  const built = buildPeriods(filteredSchedules);
  const periods = built.length ? built : emptyHours;

  return (
    <div className="timetable-grid">
      <div className="filters-summary">
        {Object.values(filters).some(v => v) ? (
          <div className="applied-filters">
            <span>Filtered by: </span>
            {filters.department && <span className="filter-badge">Department: {filters.department}</span>}
            {filters.program && <span className="filter-badge">Program: {filters.program}</span>}
            {filters.day && <span className="filter-badge">Day: {filters.day}</span>}
            {filters.teacher && (
              <span className="filter-badge">
                Teacher: {teachers.find(t => t._id === filters.teacher)?.userId?.name}
              </span>
            )}
            {filters.section && (
              <span className="filter-badge">
                Section: {sections.find(s => s._id === filters.section)?.section}
              </span>
            )}
            <button className="clear-filters-small" onClick={clearFilters}>×</button>
          </div>
        ) : (
          <div className="all-schedules-notice">
            Showing all schedules
          </div>
        )}
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Time</th>
            {days.map(day => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((period, rowIndex) => (
            <tr key={`${period.start}-${period.end}`}>
              <td>{`${period.start} - ${period.end}`}</td>
              {days.map(day => {
                // Every class of this day that belongs in this row, each showing its own times.
                const schedules = filteredSchedules
                  .filter(s => s.day === day && periodIndexOf(s, periods) === rowIndex)
                  .sort((x, y) => x.timeSlot.startTime.localeCompare(y.timeSlot.startTime) || String(x.timeSlot.room).localeCompare(String(y.timeSlot.room)));

                if (schedules.length === 0) {
                  return <td key={day}></td>;
                }

                return (
                  <td key={day} className="scheduled">
                    <div className="schedule-container">
                      {schedules.map(schedule => {
                        // Find the corresponding section data
                        const sectionData = sections.find(s => s._id === schedule?.sectionId?._id);

                        return (
                          <div
                            key={schedule._id}
                            className="schedule-cell"
                            style={{ backgroundColor: getSectionColor(schedule) }}
                          >
                            <div className="schedule-info">
                              <p className="course-name">
                                {sectionData?.courseId?.name || schedule.courseId?.name || "Unknown Course"}
                                <span className="timetable-section-name">
                                  {' '}(Section {sectionData?.section || schedule.sectionId?.section || '-'})
                                </span>
                              </p>
                              <p className="timetable-teacher-name">
                                Teachers: {formatSectionTeachers(sectionData)}
                              </p>
                              <p className="course-details">
                                {sectionData?.courseId?.department && `${typeof sectionData.courseId.department === 'object' ? sectionData.courseId.department.name : sectionData.courseId.department}`}
                                {sectionData?.courseId?.department && sectionData.courseId?.program && ' | '}
                                {sectionData?.courseId?.program && `${typeof sectionData.courseId.program === 'object' ? sectionData.courseId.program.name : sectionData.courseId.program}`}
                              </p>
                              <p className="time-duration">
                                {schedule.timeSlot.startTime} - {schedule.timeSlot.endTime}
                              </p>
                              <p className="room-info">
                                Room: {schedule.timeSlot.room}
                              </p>
                            </div>
                            <div className="schedule-actions">
                              <button type="button" className="row-btn" onClick={() => handleEditSchedule(schedule)}>Edit</button>
                              <button type="button" className="row-btn row-btn--danger" onClick={() => handleDeleteSchedule(schedule._id)}>Delete</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid; 
