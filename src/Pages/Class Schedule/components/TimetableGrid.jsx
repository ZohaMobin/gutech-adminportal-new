import React from 'react';
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
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  // Helper function to calculate duration in hours
  const calculateDuration = (startTime, endTime) => {
    const start = timeSlots.indexOf(startTime);
    const end = timeSlots.indexOf(endTime);
    return end - start;
  };

  // Helper function to check if a time slot is part of a longer schedule
  const isPartOfLongerSchedule = (time, day, schedules) => {
    return schedules.some(s => 
      s.day === day && 
      s.timeSlot.startTime < time && 
      s.timeSlot.endTime > time
    );
  };

  // Helper function to find all schedules for a time slot
  const findSchedulesForTimeSlot = (time, day, schedules) => {
    return schedules.filter(s => 
      s.day === day && 
      s.timeSlot.startTime === time
    );
  };

  const formatTeacherNames = (sectionData) => {
    if (Array.isArray(sectionData?.teachers) && sectionData.teachers.length > 0) {
      return sectionData.teachers.map((teacher) => teacher.name || teacher.userId?.name || 'Unknown').join(', ');
    }

    if (Array.isArray(sectionData?.teacherIds) && sectionData.teacherIds.length > 0) {
      return sectionData.teacherIds
        .map((teacher) => teacher?.userId?.name || teacher?.name || teacher?.email)
        .filter(Boolean)
        .join(', ');
    }

    if (sectionData?.teacherId?.userId?.name) {
      return sectionData.teacherId.userId.name;
    }

    return 'No teacher assigned';
  };

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
          {timeSlots.map((time, i) => {
            const nextTime = timeSlots[i + 1];
            if (!nextTime) return null;

            return (
              <tr key={time}>
                <td>{`${time} - ${nextTime}`}</td>
                {days.map(day => {
                  // Skip rendering if this time slot is part of a longer schedule
                  if (isPartOfLongerSchedule(time, day, filteredSchedules)) {
                    return <td key={day}></td>;
                  }

                  // Find all schedules for this time slot and day
                  const schedules = findSchedulesForTimeSlot(time, day, filteredSchedules);

                  if (schedules.length === 0) {
                    return <td key={day}></td>;
                  }

                  // Calculate the maximum duration among all schedules in this cell
                  const maxDuration = Math.max(...schedules.map(s => 
                    calculateDuration(s.timeSlot.startTime, s.timeSlot.endTime)
                  ));

                  return (
                    <td 
                      key={day} 
                      className="scheduled"
                      rowSpan={maxDuration}
                    >
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
                                    (Section {sectionData?.section || schedule.sectionId?.section || '-'})
                                  </span>
                                </p>
                                <p className="timetable-teacher-name">
                                  Teachers: {formatTeacherNames(sectionData)}
                                </p>
                                <p className="course-details">
                                  {sectionData?.courseId?.department && `${typeof sectionData.courseId.department === 'object' ? sectionData.courseId.department.name : sectionData.courseId.department}`}
                                  {sectionData?.courseId?.department && sectionData.courseId?.program && ' | '}
                                  {sectionData?.courseId?.program && `${typeof sectionData.courseId.program === 'object' ? sectionData.courseId.program.name : sectionData.courseId.program}`}
                                </p>
                                <p className="time-duration">
                                  {schedule.timeSlot.startTime} - {schedule.timeSlot.endTime}
                                  {calculateDuration(schedule.timeSlot.startTime, schedule.timeSlot.endTime) > 1 && 
                                    ` (${calculateDuration(schedule.timeSlot.startTime, schedule.timeSlot.endTime)} hours)`}
                                </p>
                                <p className="room-info">
                                  Room: {schedule.timeSlot.room}
                                </p>
                              </div>
                              <div className="schedule-actions">
                                <button onClick={() => handleEditSchedule(schedule)}>Edit</button>
                                <button onClick={() => handleDeleteSchedule(schedule._id)}>Delete</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid; 
