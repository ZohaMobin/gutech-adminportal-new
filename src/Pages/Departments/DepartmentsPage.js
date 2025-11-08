import React, { useState, useEffect } from "react";
import axios from "axios";
import "./DepartmentsPage.css";

const DepartmentsPage = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    isActive: true,
  });

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/departments?includeInactive=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setDepartments(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch departments");
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
      if (editingDepartment) {
        await axios.put(
          `${API_BASE_URL}/api/departments/${editingDepartment._id}`,
          formData,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
      } else {
        await axios.post(`${API_BASE_URL}/api/departments`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
      setShowModal(false);
      resetForm();
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save department");
    }
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    setFormData({
      code: department.code,
      name: department.name,
      description: department.description || "",
      isActive: department.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to deactivate this department?")) {
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/api/departments/${id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      fetchDepartments();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete department");
    }
  };

  const resetForm = () => {
    setFormData({
      code: "",
      name: "",
      description: "",
      isActive: true,
    });
    setEditingDepartment(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return <div className="departments-page loading">Loading departments...</div>;
  }

  return (
    <div className="departments-page">
      <div className="page-header">
        <h1>Departments Management</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          + Add Department
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="departments-table-container">
        <table className="departments-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Description</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-state">
                  No departments found. Add your first department!
                </td>
              </tr>
            ) : (
              departments.map((dept) => (
                <tr key={dept._id} className={!dept.isActive ? "inactive" : ""}>
                  <td>{dept.code}</td>
                  <td>{dept.name}</td>
                  <td>{dept.description || "-"}</td>
                  <td>
                    <span className={`status-badge ${dept.isActive ? "active" : "inactive"}`}>
                      {dept.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-edit"
                        onClick={() => handleEdit(dept)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(dept._id)}
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
              <h2>{editingDepartment ? "Edit Department" : "Add Department"}</h2>
              <button className="modal-close" onClick={handleCloseModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="department-form">
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
                  placeholder="e.g., CS"
                  disabled={!!editingDepartment}
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
                  placeholder="e.g., Computer Science"
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
                  {editingDepartment ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentsPage;

