import Loading, { BusyLabel, Refreshing } from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { ConfirmModal, Modal } from "../Administrators/AdminModals";
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./AcademicYearsPage.css";

const EMPTY_FORM = () => ({ semesterType: "Fall", year: new Date().getFullYear(), startDate: "", endDate: "", isCurrent: false });
const yearName = (ay) => `${ay.semesterType} ${ay.year}`;

const AcademicYearsPage = () => {
  const [academicYears, setAcademicYears] = useState([]);
  const [firstLoad, setFirstLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  // One confirmation at a time: { kind: "current" | "deactivate", year }
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

  useEffect(() => {
    fetchAcademicYears();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The first load shows placeholders; later reloads (after a save) only dim the table, so the page never blanks.
  const fetchAcademicYears = async () => {
    try {
      setRefreshing(true);
      const response = await axios.get(`${API_BASE_URL}/api/academic-years`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setAcademicYears(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch academic years");
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
    setFormError("");
    if (new Date(formData.endDate) <= new Date(formData.startDate)) {
      setFormError("End date must be after start date");
      return;
    }
    try {
      setSaving(true);
      if (editingAcademicYear) {
        await axios.put(`${API_BASE_URL}/api/academic-years/${editingAcademicYear._id}`, formData, { headers: { Authorization: `Bearer ${adminToken}` } });
      } else {
        await axios.post(`${API_BASE_URL}/api/academic-years`, formData, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      }
      showToast(editingAcademicYear ? "Academic year updated" : "Academic year created", TOAST_TYPES.SUCCESS);
      handleCloseModal();
      fetchAcademicYears();
    } catch (err) {
      setFormError(err.response?.data?.message || "Failed to save academic year");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (academicYear) => {
    setEditingAcademicYear(academicYear);
    setFormData({
      semesterType: academicYear.semesterType,
      year: academicYear.year,
      startDate: academicYear.startDate ? new Date(academicYear.startDate).toISOString().split("T")[0] : "",
      endDate: academicYear.endDate ? new Date(academicYear.endDate).toISOString().split("T")[0] : "",
      isCurrent: academicYear.isCurrent || false,
    });
    setFormError("");
    setShowModal(true);
  };

  const openConfirm = (kind, year) => {
    setConfirmError("");
    setConfirm({ kind, year });
  };

  const runConfirm = async () => {
    const { kind, year } = confirm;
    try {
      setConfirming(true);
      setConfirmError("");
      if (kind === "current") {
        await axios.put(`${API_BASE_URL}/api/academic-years/${year._id}/set-current`, {}, { headers: { Authorization: `Bearer ${adminToken}` } });
        showToast(`${yearName(year)} is now the current academic year`, TOAST_TYPES.SUCCESS);
      } else {
        await axios.delete(`${API_BASE_URL}/api/academic-years/${year._id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
        showToast(`${yearName(year)} deactivated`, TOAST_TYPES.SUCCESS);
      }
      setConfirm(null);
      fetchAcademicYears();
    } catch (err) {
      setConfirmError(err.response?.data?.message || (kind === "current" ? "Failed to set current academic year" : "Failed to deactivate academic year"));
    } finally {
      setConfirming(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData(EMPTY_FORM());
    setEditingAcademicYear(null);
    setFormError("");
  };

  const getStatusBadge = (status) => {
    const statusColors = {
      upcoming: "status-upcoming",
      active: "status-active",
      closed: "status-completed",
      archived: "status-completed",
      completed: "status-completed",
    };
    const statusLabels = {
      upcoming: "Upcoming",
      active: "Active",
      closed: "Closed",
      archived: "Archived",
      completed: "Closed",
    };
    return <span className={`status-badge ${statusColors[status] || ""}`}>{statusLabels[status] || status}</span>;
  };

  if (firstLoad) {
    return (
      <div className="academic-years-page page-shell">
        <PageHeader title="Academic Years" />
        <Loading variant="table" rows={5} label="Loading academic years" />
      </div>
    );
  }

  return (
    <div className="academic-years-page page-shell">
      <PageHeader
        title="Academic Years"
        actions={
          <button className="btn-primary" onClick={() => { setFormData(EMPTY_FORM()); setShowModal(true); }}>
            + Add Academic Year
          </button>
        }
      />

      {error && <div className="error-message" role="alert">{error}</div>}

      <Refreshing active={refreshing}>
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
                <td colSpan="7" className="no-data">
                  No academic years found
                </td>
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
                      <button className="row-btn" onClick={() => openConfirm("current", ay)} aria-label={`Make ${yearName(ay)} the current academic year`}>
                        Set current
                      </button>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="row-btn" onClick={() => handleEdit(ay)} aria-label={`Edit ${yearName(ay)}`}>
                        Edit
                      </button>
                      {ay.isActive && (
                        <button className="row-btn row-btn--danger" onClick={() => openConfirm("deactivate", ay)} aria-label={`Deactivate ${yearName(ay)}`}>
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
          title={editingAcademicYear ? "Edit academic year" : "Add academic year"}
          onClose={handleCloseModal}
          busy={saving}
          footer={
            <>
              <button type="button" className="am-btn" onClick={handleCloseModal} disabled={saving}>Cancel</button>
              <button type="submit" form="academic-year-form" className="am-btn am-btn-primary" disabled={saving}>
                <BusyLabel busy={saving} busyText="Saving…" idle={editingAcademicYear ? "Save changes" : "Create academic year"} />
              </button>
            </>
          }
        >
          <form id="academic-year-form" onSubmit={handleSubmit}>
            <label className="am-field">
              <span>Semester type</span>
              <select name="semesterType" value={formData.semesterType} onChange={handleInputChange} required disabled={saving}>
                <option value="Fall">Fall</option>
                <option value="Spring">Spring</option>
                <option value="Summer">Summer</option>
              </select>
            </label>
            <label className="am-field">
              <span>Year</span>
              <input type="number" name="year" value={formData.year} onChange={handleInputChange} min="2000" max="2100" required disabled={saving} />
            </label>
            <label className="am-field">
              <span>Start date</span>
              <input type="date" name="startDate" value={formData.startDate} onChange={handleInputChange} required disabled={saving} />
            </label>
            <label className="am-field">
              <span>End date</span>
              <input type="date" name="endDate" value={formData.endDate} onChange={handleInputChange} required disabled={saving} />
            </label>
            <label className="am-check">
              <input type="checkbox" name="isCurrent" checked={formData.isCurrent} onChange={handleInputChange} disabled={saving} />
              Set as the current academic year
            </label>
            {formError && <div className="am-error" role="alert">{formError}</div>}
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === "current" ? "Set current academic year" : "Deactivate academic year"}
          body={
            confirm.kind === "current"
              ? `Make ${yearName(confirm.year)} the current academic year? Whichever year is current now will stop being current.`
              : `Deactivate ${yearName(confirm.year)}? It stays in the records but is marked inactive.`
          }
          confirmLabel={confirm.kind === "current" ? "Set as current" : "Deactivate"}
          busyText={confirm.kind === "current" ? "Updating…" : "Deactivating…"}
          danger={confirm.kind === "deactivate"}
          busy={confirming}
          error={confirmError}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default AcademicYearsPage;
