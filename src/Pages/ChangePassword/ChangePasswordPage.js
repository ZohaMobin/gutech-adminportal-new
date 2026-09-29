import PageHeader from "../../Components/PageHeader/PageHeader";
import { BusyLabel } from '../../Components/Loading/Loading';
import React, { useState } from "react";
import axios from "axios";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import PasswordInput from "../../Components/PasswordInput";
import "../Administrators/AdministratorsPage.css"; // shared .am-* form and button styles

const API = process.env.REACT_APP_BACKEND_URL;
const EMPTY = { currentPassword: "", newPassword: "", confirm: "" };

// Any administrator can choose a password of their own, whenever they like. Nothing forces it:
// a temporary password handed over by the super admin keeps working until they decide to change it.
const ChangePasswordPage = () => {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const change = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const problem = () => {
    if (!form.currentPassword) return "Enter your current password";
    if (form.newPassword.length < 8) return "The new password must be at least 8 characters";
    if (form.newPassword === form.currentPassword) return "The new password must be different from the current one";
    if (form.newPassword !== form.confirm) return "The new passwords do not match";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    const message = problem();
    if (message) return setError(message);
    try {
      setSaving(true);
      await axios.post(
        `${API}/api/auth/change-password`,
        { currentPassword: form.currentPassword, newPassword: form.newPassword },
        { headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` } }
      );
      setForm(EMPTY);
      showToast("Your password was changed", TOAST_TYPES.SUCCESS);
    } catch (err) {
      setError(err.response?.data?.message || "Could not change the password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="am-page page-shell">
      <PageHeader title="Change Password" subtitle="Choose a password only you know. You stay signed in on this device." />

      <form className="am-credential-card" onSubmit={submit} style={{ background: "#fff", border: "1px solid #e6e6e6", borderRadius: 12, padding: 22, maxWidth: 560 }}>
        <label className="am-field">
          <span>Current password</span>
          <PasswordInput name="currentPassword" autoComplete="current-password" value={form.currentPassword} onChange={change} disabled={saving} />
        </label>
        <label className="am-field">
          <span>New password <em>(at least 8 characters)</em></span>
          <PasswordInput name="newPassword" autoComplete="new-password" value={form.newPassword} onChange={change} disabled={saving} />
        </label>
        <label className="am-field">
          <span>Repeat new password</span>
          <PasswordInput name="confirm" autoComplete="new-password" value={form.confirm} onChange={change} disabled={saving} />
        </label>
        {error && <div className="am-error" role="alert">{error}</div>}
        <div style={{ marginTop: 16 }}>
          <button type="submit" className="am-btn am-btn-primary" disabled={saving}>
            <BusyLabel busy={saving} busyText="Saving…" idle="Change password" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChangePasswordPage;
