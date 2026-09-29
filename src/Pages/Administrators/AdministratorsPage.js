import PageHeader from "../../Components/PageHeader/PageHeader";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { AdminFormModal, ConfirmModal, CredentialModal } from "./AdminModals";
import { initialsOf, countByStatus, visibleAdmins, formatDate } from "./adminListUtils";
import "./AdministratorsPage.css";

const API = process.env.REACT_APP_BACKEND_URL;

// Managing administrators is the super admin's job. Removing someone means deactivating them:
// they are signed out everywhere and cannot log in, but the account (which grades and approvals
// point back to) is kept, and they can be reactivated.
const AdministratorsPage = () => {
  const token = sessionStorage.getItem("adminToken");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [me, setMe] = useState(null); // { userId, isSuperAdmin }
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [modal, setModal] = useState(null); // { type, admin?, ... }
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");
      const profile = await axios.get(`${API}/api/users/me`, { headers });
      setMe(profile.data);
      if (profile.data.isSuperAdmin) {
        const list = await axios.get(`${API}/api/users/admins`, { headers });
        setAdmins(list.data);
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || "Could not load administrators");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  // Close the row menu on any outside click.
  useEffect(() => {
    if (!menuFor) return undefined;
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuFor(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

  const counts = countByStatus(admins);
  const rows = visibleAdmins(admins, { status: tab, query });

  const closeModal = () => {
    setModal(null);
    setModalError("");
    setBusy(false);
  };

  // Runs one API call for the open modal, keeping it open with the message on failure.
  const run = async (request, onDone) => {
    try {
      setBusy(true);
      setModalError("");
      const response = await request();
      await onDone(response.data);
    } catch (err) {
      setModalError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = (form) =>
    run(() => axios.post(`${API}/api/users/admins`, form, { headers }), async (data) => {
      await load();
      setModal({ type: "credential", heading: "Administrator added", name: data.user.name, email: data.user.email, temporaryPassword: data.temporaryPassword });
    });

  const submitEdit = (form) =>
    run(() => axios.patch(`${API}/api/users/admins/${modal.admin._id}`, { name: form.name, employeeId: form.employeeId }, { headers }), async () => {
      await load();
      closeModal();
      showToast("Administrator updated", TOAST_TYPES.SUCCESS);
    });

  const confirmReset = () =>
    run(() => axios.post(`${API}/api/users/admins/${modal.admin._id}/reset-password`, {}, { headers }), async (data) => {
      setModal({ type: "credential", heading: "Password reset", name: modal.admin.name, email: modal.admin.email, temporaryPassword: data.temporaryPassword });
    });

  const confirmSimple = (path, message) =>
    run(() => axios.post(`${API}${path}`, {}, { headers }), async () => {
      await load();
      closeModal();
      showToast(message, TOAST_TYPES.SUCCESS);
    });

  const isSelf = (admin) => admin._id === me?.userId;

  // ---------- states ----------
  if (loading && !me) {
    return (
      <div className="am-page page-shell">
        <div className="am-skeleton" />
        <div className="am-skeleton" />
        <div className="am-skeleton" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="am-page page-shell">
        <div className="am-empty">
          <h2>Could not load administrators</h2>
          <p>{loadError}</p>
          <button className="am-btn am-btn-primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  if (!me?.isSuperAdmin) {
    return (
      <div className="am-page page-shell">
        <PageHeader title="Administrators" />
        <div className="am-empty">
          <div className="am-empty-icon" aria-hidden="true">🔒</div>
          <h2>Only the super admin can manage administrators</h2>
          <p>Ask the super admin if you need someone added, changed or removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="am-page page-shell">

      <PageHeader
        title="Administrators"
        subtitle="People who can manage everything in this portal. Only you, as super admin, can add or change them."
        actions={<button className="am-btn am-btn-primary" onClick={() => setModal({ type: "add" })}>+ Add administrator</button>}
      />

      <div className="am-toolbar">
        <input
          className="am-search"
          type="search"
          placeholder="Search by name, email or employee ID"
          aria-label="Search administrators"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="am-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "active"} className={`am-tab ${tab === "active" ? "is-active" : ""}`} onClick={() => setTab("active")}>
            Active <span className="am-count">{counts.active}</span>
          </button>
          <button role="tab" aria-selected={tab === "deactivated"} className={`am-tab ${tab === "deactivated" ? "is-active" : ""}`} onClick={() => setTab("deactivated")}>
            Deactivated <span className="am-count">{counts.deactivated}</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="am-empty am-empty-inline">
          <p>
            {query
              ? "No administrators match your search."
              : tab === "active"
              ? "No active administrators."
              : "Nobody has been deactivated."}
          </p>
        </div>
      ) : (
        <ul className="am-list">
          {rows.map((admin) => (
            <li key={admin._id} className={`am-row ${admin.status === "deactivated" ? "is-deactivated" : ""}`}>
              <div className="am-avatar" aria-hidden="true">{initialsOf(admin.name)}</div>

              <div className="am-identity">
                <div className="am-name">
                  {admin.name}
                  {admin.isSuperAdmin && <span className="am-badge am-badge-super">Super admin</span>}
                  {isSelf(admin) && <span className="am-badge am-badge-you">You</span>}
                  {admin.status === "deactivated" && <span className="am-badge am-badge-off">Deactivated</span>}
                </div>
                <div className="am-email">{admin.email}</div>
              </div>

              <div className="am-meta">
                <span className="am-meta-label">Employee ID</span>
                <span>{admin.employeeId || "—"}</span>
              </div>

              <div className="am-meta am-meta-wide">
                <span className="am-meta-label">{admin.status === "deactivated" ? "Deactivated" : "Added"}</span>
                <span>
                  {formatDate(admin.status === "deactivated" ? admin.deactivatedAt : admin.createdAt)}
                  {admin.status === "active" && admin.createdByName ? ` · by ${admin.createdByName}` : ""}
                </span>
              </div>

              <div className="am-actions">
                {admin.status === "active" ? (
                  <>
                    <button className="am-btn am-btn-small" onClick={() => setModal({ type: "edit", admin })}>Edit</button>
                    {!isSelf(admin) && !admin.isSuperAdmin && (
                      <button className="am-btn am-btn-small" onClick={() => setModal({ type: "reset", admin })}>Reset password</button>
                    )}
                    {!isSelf(admin) && !admin.isSuperAdmin && (
                      <div className="am-menu" ref={menuFor === admin._id ? menuRef : null}>
                        <button className="am-icon-btn" aria-label={`More actions for ${admin.name}`} aria-haspopup="menu" aria-expanded={menuFor === admin._id} onClick={() => setMenuFor(menuFor === admin._id ? null : admin._id)}>
                          ⋯
                        </button>
                        {menuFor === admin._id && (
                          <div className="am-menu-list" role="menu">
                            <button role="menuitem" onClick={() => { setMenuFor(null); setModal({ type: "sessions", admin }); }}>Sign out everywhere</button>
                            <button role="menuitem" className="is-danger" onClick={() => { setMenuFor(null); setModal({ type: "deactivate", admin }); }}>Deactivate…</button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <button className="am-btn am-btn-small" onClick={() => setModal({ type: "reactivate", admin })}>Reactivate</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal?.type === "add" && <AdminFormModal saving={busy} error={modalError} onSubmit={submitAdd} onClose={closeModal} />}
      {modal?.type === "edit" && <AdminFormModal admin={modal.admin} saving={busy} error={modalError} onSubmit={submitEdit} onClose={closeModal} />}
      {modal?.type === "credential" && (
        <CredentialModal heading={modal.heading} name={modal.name} email={modal.email} temporaryPassword={modal.temporaryPassword} onClose={closeModal} />
      )}
      {modal?.type === "reset" && (
        <ConfirmModal
          title="Reset password"
          body={`Create a new temporary password for ${modal.admin.name}? They will be signed out everywhere and their old password stops working immediately.`}
          confirmLabel="Reset password"
          busy={busy}
          error={modalError}
          onConfirm={confirmReset}
          onClose={closeModal}
        />
      )}
      {modal?.type === "sessions" && (
        <ConfirmModal
          title="Sign out everywhere"
          body={`Sign ${modal.admin.name} out of every device? They can sign back in with their current password.`}
          confirmLabel="Sign out"
          busy={busy}
          error={modalError}
          onConfirm={() => confirmSimple(`/api/users/${modal.admin._id}/revoke-sessions`, `${modal.admin.name} was signed out everywhere`)}
          onClose={closeModal}
        />
      )}
      {modal?.type === "deactivate" && (
        <ConfirmModal
          title="Deactivate administrator"
          body={`${modal.admin.name} will be signed out everywhere and will not be able to log in. Their account and history are kept, and you can reactivate them later.`}
          confirmLabel="Deactivate"
          danger
          busy={busy}
          error={modalError}
          onConfirm={() => confirmSimple(`/api/users/admins/${modal.admin._id}/deactivate`, `${modal.admin.name} was deactivated`)}
          onClose={closeModal}
        />
      )}
      {modal?.type === "reactivate" && (
        <ConfirmModal
          title="Reactivate administrator"
          body={`${modal.admin.name} will be able to log in again with their existing password.`}
          confirmLabel="Reactivate"
          busy={busy}
          error={modalError}
          onConfirm={() => confirmSimple(`/api/users/admins/${modal.admin._id}/reactivate`, `${modal.admin.name} can log in again`)}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default AdministratorsPage;
