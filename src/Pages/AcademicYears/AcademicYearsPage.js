import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AcademicYearsPage.css";

const AcademicYearsPage = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] = useState(null);
  const [formData, setFormData] = useState({
    semesterType: "Fall",
    year: new Date().getFullYear(),
    startDate: "",
    endDate: "",
    isCurrent: false,
  });

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

  useEffect(() => {
    fetchAcademicYears();
  }, []);

  const fetchAcademicYears = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/academic-years`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setAcademicYears(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch academic years");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccess("");

      // Validate dates
      const startDate = new Date(formData.startDate);
      const endDate = new Date(formData.endDate);
      
      if (endDate <= startDate) {
        setError("End date must be after start date");
        return;
      }

      if (editingAcademicYear) {
        await axios.put(
          `${API_BASE_URL}/api/academic-years/${editingAcademicYear._id}`,
          formData,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        setSuccess("Academic year updated successfully");
      } else {
        await axios.post(`${API_BASE_URL}/api/academic-years`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        setSuccess("Academic year created successfully");
      }
      
      setShowModal(false);
      resetForm();
      fetchAcademicYears();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save academic year");
    }
  };

  const handleEdit = (academicYear) => {
    setEditingAcademicYear(academicYear);
    setFormData({
      semesterType: academicYear.semesterType,
      year: academicYear.year,
      startDate: academicYear.startDate ? new Date(academicYear.startDate).toISOString().split('T')[0] : "",
      endDate: academicYear.endDate ? new Date(academicYear.endDate).toISOString().split('T')[0] : "",
      isCurrent: academicYear.isCurrent || false,
    });
    setShowModal(true);
  };

  const handleSetCurrent = async (id) => {
    if (!window.confirm("Set this as the current academic year? This will unmark any other current academic year.")) {
      return;
    }
    try {
      setError("");
      await axios.put(
        `${API_BASE_URL}/api/academic-years/${id}/set-current`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      setSuccess("Current academic year updated successfully");
      fetchAcademicYears();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to set current academic year");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this academic year?")) {
      return;
    }
    try {
      setError("");
      await axios.delete(`${API_BASE_URL}/api/academic-years/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setSuccess("Academic year deactivated successfully");
      fetchAcademicYears();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete academic year");
    }
  };

  const resetForm = () => {
    setFormData({
      semesterType: "Fall",
      year: new Date().getFullYear(),
      startDate: "",
      endDate: "",
      isCurrent: false,
    });
    setEditingAcademicYear(null);
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      upcoming: "status-upcoming",
      active: "status-active",
      completed: "status-completed",
    };
    return (
      <span className={`status-badge ${statusColors[status] || ""}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="academic-years-page">
        <div className="loading">Loading academic years...</div>
      </div>
    );
  }

  return (
    <div className="academic-years-page">
      <div className="page-header">
        <h1>Academic Years</h1>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          + Add Academic Year
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="academic-years-table-container">
        <table className="academic-years-table">
          <thead>
            <tr>
              <th>Semester Type</th>
              <th>Year</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Status</th>
              <th>Current</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {academicYears.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">No academic years found</td>
              </tr>
            ) : (
              academicYears.map((ay) => (
                <tr key={ay._id} className={ay.isCurrent ? "current-row" : ""}>
                  <td>{ay.semesterType}</td>
                  <td>{ay.year}</td>
                  <td>{new Date(ay.startDate).toLocaleDateString()}</td>
                  <td>{new Date(ay.endDate).toLocaleDateString()}</td>
                  <td>{getStatusBadge(ay.status)}</td>
                  <td>
                    {ay.isCurrent ? (
                      <span className="current-badge">Current</span>
                    ) : (
                      <button
                        className="btn-set-current"
                        onClick={() => handleSetCurrent(ay._id)}
                      >
                        Set Current
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(ay)}
                      >
                        Edit
                      </button>
                      {ay.isActive && (
                        <button
                          className="btn-delete"
                          onClick={() => handleDelete(ay._id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAcademicYear ? "Edit Academic Year" : "Add Academic Year"}</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); resetForm(); }}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="semesterType">Semester Type *</label>
                <select
                  id="semesterType"
                  name="semesterType"
                  value={formData.semesterType}
                  onChange={handleInputChange}
                  required
                >
                  <option value="Fall">Fall</option>
                  <option value="Spring">Spring</option>
                  <option value="Summer">Summer</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="year">Year *</label>
                <input
                  type="number"
                  id="year"
                  name="year"
                  value={formData.year}
                  onChange={handleInputChange}
                  min="2000"
                  max="2100"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="startDate">Start Date *</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="endDate">End Date *</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="isCurrent"
                    checked={formData.isCurrent}
                    onChange={handleInputChange}
                  />
                  Set as Current Academic Year
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => { setShowModal(false); resetForm(); }}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingAcademicYear ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicYearsPage;

