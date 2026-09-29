import React from 'react';
import { Modal } from '../../Administrators/AdminModals';
import { BusyLabel } from '../../../Components/Loading/Loading';

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

// Add a class to a section, or edit one. The shared dialog, so it looks and behaves like every other one in the portal.
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
  teachers,
  saving = false,
}) => {
  if (!showAddModal) return null;

  const close = () => { setShowAddModal(false); setSelectedSchedule(null); };
  const setSlot = (field, value) => setNewSchedule({ ...newSchedule, timeSlot: { ...newSchedule.timeSlot, [field]: value } });
  const complete = Boolean(newSchedule.day && newSchedule.timeSlot.startTime && newSchedule.timeSlot.endTime && newSchedule.timeSlot.room && newSchedule.teacherId && selectedSection);
  const editing = Boolean(selectedSchedule);

  return (
    <Modal
      title={editing ? 'Edit schedule' : 'Add schedule'}
      onClose={close}
      busy={saving}
      footer={
        <>
          <button type="button" className="am-btn" onClick={close} disabled={saving}>Cancel</button>
          <button type="submit" form="schedule-form" className="am-btn am-btn-primary" disabled={!complete || saving}>
            <BusyLabel busy={saving} busyText="Saving…" idle={editing ? 'Update schedule' : 'Add schedule'} />
          </button>
        </>
      }
    >
      <form id="schedule-form" onSubmit={(e) => { e.preventDefault(); if (complete) (editing ? handleUpdateSchedule : handleAddSchedule)(); }}>
        {selectedSection && (
          <p className="am-hint" style={{ margin: '0 0 12px' }}>
            {selectedSection.courseId?.code} {selectedSection.courseId?.name} · Section {selectedSection.section}
          </p>
        )}
        <label className="am-field">
          <span>Day</span>
          <select value={newSchedule.day} onChange={(e) => setNewSchedule({ ...newSchedule, day: e.target.value })} disabled={saving}>
            {days.map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <label className="am-field">
          <span>Start time</span>
          <select value={newSchedule.timeSlot.startTime} onChange={(e) => setSlot('startTime', e.target.value)} disabled={saving}>
            <option value="">Select start time…</option>
            {timeSlots.map((time) => <option key={time} value={time}>{time}</option>)}
          </select>
        </label>
        <label className="am-field">
          <span>End time</span>
          <select value={newSchedule.timeSlot.endTime} onChange={(e) => setSlot('endTime', e.target.value)} disabled={saving}>
            <option value="">Select end time…</option>
            {timeSlots.filter((time) => time > newSchedule.timeSlot.startTime).map((time) => <option key={time} value={time}>{time}</option>)}
          </select>
        </label>
        <label className="am-field">
          <span>Room</span>
          <select value={newSchedule.timeSlot.room} onChange={(e) => setSlot('room', e.target.value)} disabled={saving}>
            <option value="">Select room…</option>
            {rooms.map((room) => <option key={room} value={room}>{room}</option>)}
          </select>
        </label>
        <label className="am-field">
          <span>Teacher</span>
          <select value={newSchedule.teacherId || ''} onChange={(e) => setNewSchedule({ ...newSchedule, teacherId: e.target.value })} disabled={saving}>
            <option value="">Select teacher…</option>
            {teachers.map((teacher) => <option key={teacher._id} value={teacher._id}>{formatTeacherName(teacher)}</option>)}
          </select>
        </label>
      </form>
    </Modal>
  );
};

export default ScheduleModal;
