import Loading, { BusyLabel, Refreshing } from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { ConfirmModal, Modal } from "../Administrators/AdminModals";
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./DepartmentsPage.css";

const EMPTY_FORM = { code: "", name: "", description: "", isActive: true };

const DepartmentsPage = () => {
  const [departments, setDepartments] = useState([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDeactivate, setToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchDepartments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first load shows placeholders; later reloads (after a save) only dim the table, so the page never blanks.
  const fetchDepartments = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${API_BASE_URL}/api/departments?includeInactive=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setDepartments(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch departments");
    } finally {
      setRefreshing(false);
      setFirstLoad(false);
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
      setSaving(true);
      setFormError("");
      if (editingDepartment) {
        await axios.put(`${API_BASE_URL}/api/departments/${editingDepartment._id}`, formData, { headers: { Authorization: `Bearer ${adminToken}` } });
      } else {
        await axios.post(`${API_BASE_URL}/api/departments`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
      showToast(editingDepartment ? "Department updated" : "Department created", TOAST_TYPES.SUCCESS);
      handleCloseModal();
      fetchDepartments();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to save department");
    } finally {
      setSaving(false);
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
    setFormError("");
    setShowModal(true);
  };

  const confirmDeactivate = async () => {
    try {
      setDeactivating(true);
      setDeactivateError("");
      await axios.delete(`${API_BASE_URL}/api/departments/${toDeactivate._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      showToast(`${toDeactivate.name} deactivated`, TOAST_TYPES.SUCCESS);
      setToDeactivate(null);
      fetchDepartments();
    } catch (err) {
      setDeactivateError(err.response?.data?.error || "Failed to deactivate department");
    } finally {
      setDeactivating(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(EMPTY_FORM);
    setEditingDepartment(null);
    setFormError("");
  };

  if (firstLoad) {
    return <div className="departments-page page-shell"><PageHeader title="Departments" /><Loading variant="table" rows={6} label="Loading departments" /></div>;
  }

  return (
    <div className="departments-page page-shell">
      <PageHeader
        title="Departments"
        actions={<button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Department</button>}
      />

      {error && <div className="error-message" role="alert">{error}</div>}

      <Refreshing active={refreshing}>
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
                    <span className={`status-badge ${dept.isActive ? "active" : "inactive"}`}>{dept.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="row-btn" onClick={() => handleEdit(dept)} aria-label={`Edit ${dept.name}`}>
                        Edit
                      </button>
                      {dept.isActive && (
                        <button className="row-btn row-btn--danger" onClick={() => { setDeactivateError(""); setToDeactivate(dept); }} aria-label={`Deactivate ${dept.name}`}>
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
      </Refreshing>

      {showModal && (
        <Modal
          title={editingDepartment ? "Edit department" : "Add department"}
          onClose={handleCloseModal}
          busy={saving}
          footer={
            <>
              <button type="button" className="am-btn" onClick={handleCloseModal} disabled={saving}>Cancel</button>
              <button type="submit" form="department-form" className="am-btn am-btn-primary" disabled={saving}>
                <BusyLabel busy={saving} busyText="Saving…" idle={editingDepartment ? "Save changes" : "Create department"} />
              </button>
            </>
          }
        >
          <form id="department-form" onSubmit={handleSubmit}>
            <label className="am-field">
              <span>Code</span>
              <input type="text" name="code" value={formData.code} onChange={handleInputChange} required placeholder="e.g., CS" disabled={!!editingDepartment || saving} />
            </label>
            <label className="am-field">
              <span>Name</span>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Computer Science" disabled={saving} />
            </label>
            <label className="am-field">
              <span>Description <em>(optional)</em></span>
              <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" disabled={saving} />
            </label>
            <label className="am-check">
              <input type="checkbox" name="isActive" checked={formData.isActive} onChange={handleInputChange} disabled={saving} />
              Active
            </label>
            {formError && <div className="am-error" role="alert">{formError}</div>}
          </form>
        </Modal>
      )}

      {toDeactivate && (
        <ConfirmModal
          title="Deactivate department"
          body={`Deactivate ${toDeactivate.name} (${toDeactivate.code})? It stays in the records but is marked inactive. You can turn it back on by editing it.`}
          confirmLabel="Deactivate"
          busyText="Deactivating…"
          danger
          busy={deactivating}
          error={deactivateError}
          onConfirm={confirmDeactivate}
          onClose={() => setToDeactivate(null)}
        />
      )}
    </div>
  );
};

export default DepartmentsPage;
