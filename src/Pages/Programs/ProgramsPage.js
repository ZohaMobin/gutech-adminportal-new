import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ProgramsPage.css";

const ProgramsPage = () => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    level: "undergraduate",
    typicalDuration: 8,
    description: "",
    isActive: true,
  });

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5001";

  useEffect(() => {
    fetchPrograms();
  }, []);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/programs?includeInactive=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setPrograms(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch programs");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      if (editingProgram) {
        await axios.put(
          `${API_BASE_URL}/api/programs/${editingProgram._id}`,
          formData,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
      } else {
        await axios.post(`${API_BASE_URL}/api/programs`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
      setShowModal(false);
      resetForm();
      fetchPrograms();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save program");
    }
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
    setFormData({
      code: program.code,
      name: program.name,
      level: program.level,
      typicalDuration: program.typicalDuration,
      description: program.description || "",
      isActive: program.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this program?")) {
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/api/programs/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      fetchPrograms();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete program");
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      level: "undergraduate",
      typicalDuration: 8,
      description: "",
      isActive: true,
    });
    setEditingProgram(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return <div className="programs-page loading">Loading programs...</div>;
  }

  return (
    <div className="programs-page">
      <div className="page-header">
        <h1>Programs Management</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Program
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="programs-table-container">
        <table className="programs-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Level</th>
              <th>Duration (Semesters)</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {programs.length === 0 ? (
              <tr>
                <td colSpan="7" className="empty-state">
                  No programs found. Add your first program!
                </td>
              </tr>
            ) : (
              programs.map((program) => (
                <tr key={program._id} className={!program.isActive ? "inactive" : ""}>
                  <td>{program.code}</td>
                  <td>{program.name}</td>
                  <td>
                    <span className="level-badge">{program.level}</span>
                  </td>
                  <td>{program.typicalDuration}</td>
                  <td>{program.description || "-"}</td>
                  <td>
                    <span className={`status-badge ${program.isActive ? "active" : "inactive"}`}>
                      {program.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(program)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(program._id)}
                      >
                        Deactivate
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProgram ? "Edit Program" : "Add Program"}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="program-form">
              <div className="form-group">
                <label>
                  Code <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., BSC"
                  disabled={!!editingProgram}
                />
              </div>
              <div className="form-group">
                <label>
                  Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Bachelor of Science"
                />
              </div>
              <div className="form-group">
                <label>
                  Level <span className="required">*</span>
                </label>
                <select
                  name="level"
                  value={formData.level}
                  onChange={handleInputChange}
                  required
                >
                  <option value="undergraduate">Undergraduate</option>
                  <option value="graduate">Graduate</option>
                  <option value="doctoral">Doctoral</option>
                </select>
              </div>
              <div className="form-group">
                <label>
                  Typical Duration (Semesters) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  name="typicalDuration"
                  value={formData.typicalDuration}
                  onChange={handleInputChange}
                  required
                  min="1"
                  max="20"
                  placeholder="e.g., 8"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Optional description"
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={formData.isActive}
                    onChange={handleInputChange}
                  />
                  Active
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingProgram ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgramsPage;

