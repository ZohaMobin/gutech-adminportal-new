import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../Programs/ProgramsPage.css";
import "./AdministratorsPage.css";

const EMPTY_FORM = { name: "", email: "", employeeId: "" };

// Administrator accounts exist only because an existing administrator adds them here (or, for
// the very first one, scripts/create-admin.js). The new person chooses their own password with
// "Forgot your password?" on the login page.
const AdministratorsPage = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;
  const adminToken = sessionStorage.getItem("adminToken");
  const headers = { Authorization: `Bearer ${adminToken}` };
  const me = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("adminUser"))?.userId;
    } catch {
      return undefined;
    }
  })();

  const fetchAdmins = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/users/admins`, { headers });
      setAdmins(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load administrators");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL, adminToken]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setNotice("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.employeeId.trim()) {
      setError("Name, email and employee ID are all required");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const response = await axios.post(`${API_BASE_URL}/api/users/admins`, form, { headers });
      setNotice(response.data.message);
      setForm(EMPTY_FORM);
      fetchAdmins();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add administrator");
    } finally {
      setSaving(false);
    }
  };

  const endSessions = async (admin) => {
    if (!window.confirm(`End all sessions for ${admin.name}? They will be signed out everywhere and must log in again.`)) return;
    try {
      setBusyId(admin._id);
      setError("");
      await axios.post(`${API_BASE_URL}/api/users/${admin._id}/revoke-sessions`, {}, { headers });
      setNotice(`${admin.name} has been signed out everywhere.`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to end sessions");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="programs-page">
      <div className="page-header">
        <h1>Administrators</h1>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      <form className="admin-add-form" onSubmit={handleAdd}>
        <h3>Add an administrator</h3>
        <p className="admin-add-help">
          They will use “Forgot your password?” on the admin login page with this email to choose their own password.
        </p>
        <div className="admin-add-fields">
          <input name="name" placeholder="Full name" value={form.name} onChange={handleChange} disabled={saving} />
          <input name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} disabled={saving} />
          <input name="employeeId" placeholder="Employee ID" value={form.employeeId} onChange={handleChange} disabled={saving} />
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Adding..." : "Add administrator"}
          </button>
        </div>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="programs-table-container">
          <table className="programs-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Employee ID</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin._id}>
                  <td>
                    {admin.name}
                    {admin._id === me && <span className="you-badge">You</span>}
                  </td>
                  <td>{admin.email}</td>
                  <td>{admin.employeeId || "-"}</td>
                  <td>{new Date(admin.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn-secondary"
                      disabled={busyId === admin._id || admin._id === me}
                      title={admin._id === me ? "Use Logout to end your own session" : "Sign this administrator out everywhere"}
                      onClick={() => endSessions(admin)}
                    >
                      End sessions
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdministratorsPage;
