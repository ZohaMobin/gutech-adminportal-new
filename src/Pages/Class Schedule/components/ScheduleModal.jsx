import React from 'react';
import './ScheduleModal.css';

const ScheduleModal = ({
  showAddModal,
  setShowAddModal,
  selectedSchedule,
  setSelectedSchedule,
  newSchedule,
  setNewSchedule,
  handleAddSchedule,
  handleUpdateSchedule,
  selectedSection,
  formatTeacherName,
  rooms,
  teachers
}) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  if (!showAddModal) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <h2>{selectedSchedule ? 'Edit Schedule' : 'Add New Schedule'}</h2>
        <div className="form-group">
          <label>Day:</label>
          <select
            value={newSchedule.day}
            onChange={(e) => setNewSchedule({...newSchedule, day: e.target.value})}
          >
            {days.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Start Time:</label>
          <select
            value={newSchedule.timeSlot.startTime}
            onChange={(e) => setNewSchedule({
              ...newSchedule,
              timeSlot: {...newSchedule.timeSlot, startTime: e.target.value}
            })}
          >
            <option value="">Select start time...</option>
            {timeSlots.map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>End Time:</label>
          <select
            value={newSchedule.timeSlot.endTime}
            onChange={(e) => setNewSchedule({
              ...newSchedule,
              timeSlot: {...newSchedule.timeSlot, endTime: e.target.value}
            })}
          >
            <option value="">Select end time...</option>
            {timeSlots.filter(time => time > newSchedule.timeSlot.startTime).map(time => (
              <option key={time} value={time}>{time}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Room:</label>
          <select
            value={newSchedule.timeSlot.room}
            onChange={(e) => setNewSchedule({
              ...newSchedule,
              timeSlot: {...newSchedule.timeSlot, room: e.target.value}
            })}
          >
            <option value="">Select room...</option>
            {rooms.map(room => (
              <option key={room} value={room}>{room}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Teacher:</label>
          <select
            value={newSchedule.teacherId || ''}
            onChange={(e) => setNewSchedule({
              ...newSchedule,
              teacherId: e.target.value
            })}
          >
            <option value="">Select teacher...</option>
            {teachers.map(teacher => (
              <option key={teacher._id} value={teacher._id}>
                {formatTeacherName(teacher)}
              </option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button onClick={() => {
            setShowAddModal(false);
            setSelectedSchedule(null);
          }}>
            Cancel
          </button>
          <button 
            onClick={selectedSchedule ? handleUpdateSchedule : handleAddSchedule}
            disabled={
              !newSchedule.day ||
              !newSchedule.timeSlot.startTime ||
              !newSchedule.timeSlot.endTime ||
              !newSchedule.timeSlot.room ||
              !newSchedule.teacherId ||
              !selectedSection
            }
          >
            {selectedSchedule ? 'Update' : 'Add'} Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal; 