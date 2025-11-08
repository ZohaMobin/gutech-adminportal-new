import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import './ClassSchedule.css';

const ClassSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [formData, setFormData] = useState({
    sectionId: '',
    courseId: '',
    teacherId: '',
    day: 'Monday',
    timeSlot: {
      startTime: '',
      endTime: '',
      room: ''
    },
    semester: '',
    academicYear: ''
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00'
  ];

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/section-schedules');
      setSchedules(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch schedules');
      toast.error('Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedSchedule) {
        await axios.put(`/api/section-schedules/${selectedSchedule._id}`, formData);
        toast.success('Schedule updated successfully');
      } else {
        await axios.post('/api/section-schedules', formData);
        toast.success('Schedule created successfully');
      }
      setShowModal(false);
      fetchSchedules();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save schedule');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await axios.delete(`/api/section-schedules/${id}`);
        toast.success('Schedule deleted successfully');
        fetchSchedules();
      } catch (err) {
        toast.error('Failed to delete schedule');
      }
    }
  };

  const openModal = (schedule = null) => {
    if (schedule) {
      setSelectedSchedule(schedule);
      setFormData({
        sectionId: schedule.sectionId,
        courseId: schedule.courseId,
        teacherId: schedule.teacherId,
        day: schedule.day,
        timeSlot: schedule.timeSlot,
        semester: schedule.semester,
        academicYear: schedule.academicYear
      });
    } else {
      setSelectedSchedule(null);
      setFormData({
        sectionId: '',
        courseId: '',
        teacherId: '',
        day: 'Monday',
        timeSlot: {
          startTime: '',
          endTime: '',
          room: ''
        },
        semester: '',
        academicYear: ''
      });
    }
    setShowModal(true);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="class-schedule-container">
      <div className="header">
        <h1>Class Schedule Management</h1>
        <button className="add-button" onClick={() => openModal()}>
          Add New Schedule
        </button>
      </div>

      <div className="schedule-grid">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Room</th>
              <th>Section</th>
              <th>Course</th>
              <th>Teacher</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule._id}>
                <td>{schedule.day}</td>
                <td>{`${schedule.timeSlot.startTime} - ${schedule.timeSlot.endTime}`}</td>
                <td>{schedule.timeSlot.room}</td>
                <td>{schedule.sectionId}</td>
                <td>{schedule.courseId}</td>
                <td>{schedule.teacherId}</td>
                <td>
                  <button onClick={() => openModal(schedule)}>Edit</button>
                  <button onClick={() => handleDelete(schedule._id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>{selectedSchedule ? 'Edit Schedule' : 'Add New Schedule'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Day:</label>
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  required
                >
                  {days.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Start Time:</label>
                <select
                  value={formData.timeSlot.startTime}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeSlot: { ...formData.timeSlot, startTime: e.target.value },
                    })
                  }
                  required
                >
                  <option value="">Select start time</option>
                  {timeSlots.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>End Time:</label>
                <select
                  value={formData.timeSlot.endTime}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeSlot: { ...formData.timeSlot, endTime: e.target.value },
                    })
                  }
                  required
                >
                  <option value="">Select end time</option>
                  {timeSlots.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Room:</label>
                <input
                  type="text"
                  value={formData.timeSlot.room}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeSlot: { ...formData.timeSlot, room: e.target.value },
                    })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Section ID:</label>
                <input
                  type="text"
                  value={formData.sectionId}
                  onChange={(e) =>
                    setFormData({ ...formData, sectionId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Course ID:</label>
                <input
                  type="text"
                  value={formData.courseId}
                  onChange={(e) =>
                    setFormData({ ...formData, courseId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Teacher ID:</label>
                <input
                  type="text"
                  value={formData.teacherId}
                  onChange={(e) =>
                    setFormData({ ...formData, teacherId: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Semester:</label>
                <input
                  type="number"
                  value={formData.semester}
                  onChange={(e) =>
                    setFormData({ ...formData, semester: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label>Academic Year:</label>
                <input
                  type="text"
                  value={formData.academicYear}
                  onChange={(e) =>
                    setFormData({ ...formData, academicYear: e.target.value })
                  }
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit">
                  {selectedSchedule ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassSchedule; 