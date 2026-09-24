import Loading, { BusyLabel, Refreshing } from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { ConfirmModal, Modal } from "../Administrators/AdminModals";
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ProgramsPage.css";

const EMPTY_FORM = { code: "", name: "", level: "undergraduate", typicalDuration: 8, description: "", isActive: true };

const ProgramsPage = () => {
  const [programs, setPrograms] = useState([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDeactivate, setToDeactivate] = useState(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first load shows placeholders; later reloads (after a save) only dim the table, so the page never blanks.
  const fetchPrograms = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${API_BASE_URL}/api/programs?includeInactive=true`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setPrograms(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch programs");
    } finally {
      setRefreshing(false);
      setFirstLoad(false);
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
      setSaving(true);
      setFormError("");
      if (editingProgram) {
        await axios.put(`${API_BASE_URL}/api/programs/${editingProgram._id}`, formData, { headers: { Authorization: `Bearer ${adminToken}` } });
      } else {
        await axios.post(`${API_BASE_URL}/api/programs`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
      showToast(editingProgram ? "Program updated" : "Program created", TOAST_TYPES.SUCCESS);
      handleCloseModal();
      fetchPrograms();
    } catch (err) {
      setFormError(err.response?.data?.error || "Failed to save program");
    } finally {
      setSaving(false);
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
    setFormError("");
    setShowModal(true);
  };

  const confirmDeactivate = async () => {
    try {
      setDeactivating(true);
      setDeactivateError("");
      await axios.delete(`${API_BASE_URL}/api/programs/${toDeactivate._id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      showToast(`${toDeactivate.name} deactivated`, TOAST_TYPES.SUCCESS);
      setToDeactivate(null);
      fetchPrograms();
    } catch (err) {
      setDeactivateError(err.response?.data?.error || "Failed to deactivate program");
    } finally {
      setDeactivating(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(EMPTY_FORM);
    setEditingProgram(null);
    setFormError("");
  };

  if (firstLoad) {
    return <div className="programs-page page-shell"><PageHeader title="Programs" /><Loading variant="table" rows={6} label="Loading programs" /></div>;
  }

  return (
    <div className="programs-page page-shell">
      <PageHeader
        title="Programs"
        actions={<button className="btn-primary" onClick={() => setShowModal(true)}>+ Add Program</button>}
      />

      {error && <div className="error-message" role="alert">{error}</div>}

      <Refreshing active={refreshing}>
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
                    <span className={`status-badge ${program.isActive ? "active" : "inactive"}`}>{program.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="row-btn" onClick={() => handleEdit(program)} aria-label={`Edit ${program.name}`}>
                        Edit
                      </button>
                      {program.isActive && (
                        <button className="row-btn row-btn--danger" onClick={() => { setDeactivateError(""); setToDeactivate(program); }} aria-label={`Deactivate ${program.name}`}>
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
          title={editingProgram ? "Edit program" : "Add program"}
          onClose={handleCloseModal}
          busy={saving}
          footer={
            <>
              <button type="button" className="am-btn" onClick={handleCloseModal} disabled={saving}>Cancel</button>
              <button type="submit" form="program-form" className="am-btn am-btn-primary" disabled={saving}>
                <BusyLabel busy={saving} busyText="Saving…" idle={editingProgram ? "Save changes" : "Create program"} />
              </button>
            </>
          }
        >
          <form id="program-form" onSubmit={handleSubmit}>
            <label className="am-field">
              <span>Code</span>
              <input type="text" name="code" value={formData.code} onChange={handleInputChange} required placeholder="e.g., BSCS" disabled={!!editingProgram || saving} />
            </label>
            <label className="am-field">
              <span>Name</span>
              <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g., Bachelor of Science in Computer Science" disabled={saving} />
            </label>
            <label className="am-field">
              <span>Level</span>
              <select name="level" value={formData.level} onChange={handleInputChange} required disabled={saving}>
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate</option>
                <option value="doctoral">Doctoral</option>
              </select>
            </label>
            <label className="am-field">
              <span>Typical duration (semesters)</span>
              <input type="number" name="typicalDuration" value={formData.typicalDuration} onChange={handleInputChange} required min="1" max="20" placeholder="e.g., 8" disabled={saving} />
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
          title="Deactivate program"
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

export default ProgramsPage;
