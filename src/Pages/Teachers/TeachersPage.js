import Loading from "../../Components/Loading/Loading";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { messageOf } from "../../utils/apiMessage";
import { ConfirmModal, Modal } from "../Administrators/AdminModals";
import { initialsOf, formatDate } from "../Administrators/adminListUtils";
import { countByStatus, visibleTeachers, sectionsText } from "./teacherListUtils";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import axios from "axios";
import "../Administrators/AdministratorsPage.css";
import "./TeachersPage.css";

const API = process.env.REACT_APP_BACKEND_URL;

// Deleting asks the server first whether the teacher has any records. One with none can be removed for good; one with
// any is explained, and revoking access is offered instead.
const DeleteModal = ({ teacher, headers, busy, error, onConfirm, onRevoke, onClose }) => {
  const [check, setCheck] = useState(null); // null while checking, then { canDelete, summary } or { failed }
  useEffect(() => {
    let live = true;
    axios.get(`${API}/api/users/teachers/${teacher._id}/deletable`, { headers })
      .then(({ data }) => live && setCheck(data))
      .catch((err) => live && setCheck({ failed: messageOf(err, "Could not check this teacher's records.") }));
    return () => { live = false; };
  }, [teacher._id, headers]);

  if (check === null) {
    return <Modal title="Delete teacher" onClose={onClose}><p className="am-confirm-text">Checking {teacher.name}'s records…</p></Modal>;
  }
  if (check.failed) {
    return <Modal title="Delete teacher" onClose={onClose} footer={<button type="button" className="am-btn" onClick={onClose}>Close</button>}><div className="am-error" role="alert">{check.failed}</div></Modal>;
  }
  if (!check.canDelete) {
    return (
      <Modal
        title="This teacher can't be deleted"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="am-btn" onClick={onClose}>Close</button>
            {teacher.status === "active" && <button type="button" className="am-btn am-btn-primary" onClick={onRevoke}>Revoke access instead</button>}
          </>
        }
      >
        <p className="am-confirm-text"><strong>{teacher.name}</strong> has records in the system: {check.summary}. Deleting them would leave that history with no teacher.</p>
        <p className="am-hint">Revoking access stops them signing in and keeps everything. You can restore it at any time.</p>
      </Modal>
    );
  }
  return (
    <ConfirmModal
      title="Delete teacher"
      body={`Delete ${teacher.name} permanently? They have no sections, attendance or marks, so nothing else is affected. This cannot be undone. Their email can be used to register again.`}
      confirmLabel="Delete permanently"
      busyText="Deleting…"
      danger
      busy={busy}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};

// The Teachers tab of Manage access. The page around it (header, tabs, super-admin check) is ManageAccessPage.
const TeachersPanel = () => {
  const token = sessionStorage.getItem("adminToken");
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [teachers, setTeachers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState("");
  const [menuFor, setMenuFor] = useState(null);
  const [modal, setModal] = useState(null); // { type: revoke | restore | signout | delete, teacher }
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const { data } = await axios.get(`${API}/api/users/teachers`, { headers });
      setTeachers(data);
    } catch (err) {
      setLoadError(messageOf(err, "Could not load teachers."));
      setTeachers((current) => current || []);
    }
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!menuFor) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuFor(null); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuFor]);

  const closeModal = () => { setModal(null); setModalError(""); setBusy(false); };

  const act = async (request, doneMessage) => {
    try {
      setBusy(true);
      setModalError("");
      await request();
      await load();
      closeModal();
      showToast(doneMessage, TOAST_TYPES.SUCCESS);
    } catch (err) {
      setModalError(messageOf(err, "Something went wrong. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const list = teachers || [];
  const counts = countByStatus(list);
  const rows = visibleTeachers(list, { status: tab, query });
  const t = modal?.teacher;

  return (
    <div className="am-page tm-page">
      <p className="am-panel-intro">Control who can sign in as a teacher. Revoking access keeps their sections, attendance and marks, and can be undone.</p>

      <div className="am-toolbar">
        <input className="am-search" type="search" placeholder="Search by name, email, employee ID or department" aria-label="Search teachers" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="am-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "active"} className={`am-tab ${tab === "active" ? "is-active" : ""}`} onClick={() => setTab("active")}>Active <span className="am-count">{counts.active}</span></button>
          <button role="tab" aria-selected={tab === "deactivated"} className={`am-tab ${tab === "deactivated" ? "is-active" : ""}`} onClick={() => setTab("deactivated")}>Access revoked <span className="am-count">{counts.deactivated}</span></button>
        </div>
      </div>

      {loadError && <div className="error-message" role="alert">{loadError} <button type="button" className="am-btn am-btn-small" onClick={load}>Try again</button></div>}

      {teachers === null ? (
        <Loading variant="list" rows={4} label="Loading teachers" />
      ) : rows.length === 0 ? (
        <div className="am-empty am-empty-inline">
          <p>{query ? "No teachers match your search." : tab === "active" ? "No active teachers." : "Nobody's access has been revoked."}</p>
        </div>
      ) : (
        <ul className="am-list">
          {rows.map((teacher) => {
            const revoked = teacher.status === "deactivated";
            return (
              <li key={teacher._id} className={`am-row ${revoked ? "is-deactivated" : ""}`}>
                <div className="am-avatar" aria-hidden="true">{initialsOf(teacher.name)}</div>
                <div className="am-identity">
                  <div className="am-name">{teacher.name}{revoked && <span className="am-badge am-badge-off">Access revoked</span>}</div>
                  <div className="am-email">{teacher.email}</div>
                </div>
                <div className="am-meta">
                  <span className="am-meta-label">Employee ID</span>
                  <span>{teacher.employeeId || "—"}</span>
                </div>
                <div className="am-meta">
                  <span className="am-meta-label">Department</span>
                  <span>{teacher.department || "—"}</span>
                </div>
                <div className="am-meta am-meta-wide">
                  <span className="am-meta-label">{revoked ? "Revoked" : "Teaching"}</span>
                  <span>
                    {revoked ? `${formatDate(teacher.deactivatedAt)}${teacher.deactivatedByName ? ` · by ${teacher.deactivatedByName}` : ""}` : sectionsText(teacher.sections)}
                    {revoked && teacher.sections > 0 && <span className="tm-warn"> · still on {sectionsText(teacher.sections)}</span>}
                  </span>
                </div>
                <div className="am-actions">
                  {revoked ? (
                    <button className="am-btn am-btn-small" onClick={() => setModal({ type: "restore", teacher })}>Restore access</button>
                  ) : (
                    <button className="am-btn am-btn-small tm-revoke" onClick={() => setModal({ type: "revoke", teacher })}>Revoke access…</button>
                  )}
                  <div className="am-menu" ref={menuFor === teacher._id ? menuRef : null}>
                    <button className="am-icon-btn" aria-label={`More actions for ${teacher.name}`} aria-haspopup="menu" aria-expanded={menuFor === teacher._id} onClick={() => setMenuFor(menuFor === teacher._id ? null : teacher._id)}>⋯</button>
                    {menuFor === teacher._id && (
                      <div className="am-menu-list" role="menu">
                        {!revoked && <button role="menuitem" onClick={() => { setMenuFor(null); setModal({ type: "signout", teacher }); }}>Sign out everywhere</button>}
                        <button role="menuitem" className="is-danger" onClick={() => { setMenuFor(null); setModal({ type: "delete", teacher }); }}>Delete…</button>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal?.type === "revoke" && (
        <ConfirmModal
          title="Revoke access"
          body={`${t.name} will be signed out everywhere and will not be able to log in. Their account, attendance and marks are kept, and you can restore access later.`}
          confirmLabel="Revoke access"
          busyText="Revoking…"
          danger
          busy={busy}
          error={modalError}
          onConfirm={() => act(() => axios.post(`${API}/api/users/teachers/${t._id}/deactivate`, {}, { headers }), `${t.name}'s access was revoked`)}
          onClose={closeModal}
        >
          {t.sections > 0 && <p className="tm-note">They are still assigned to {sectionsText(t.sections)}. Those stay as they are until you assign another teacher in Teacher Assignment.</p>}
        </ConfirmModal>
      )}
      {modal?.type === "restore" && (
        <ConfirmModal
          title="Restore access"
          body={`${t.name} will be able to log in again with their existing password.`}
          confirmLabel="Restore access"
          busyText="Restoring…"
          busy={busy}
          error={modalError}
          onConfirm={() => act(() => axios.post(`${API}/api/users/teachers/${t._id}/reactivate`, {}, { headers }), `${t.name} can log in again`)}
          onClose={closeModal}
        />
      )}
      {modal?.type === "signout" && (
        <ConfirmModal
          title="Sign out everywhere"
          body={`Sign ${t.name} out of every device? They can sign back in with their current password.`}
          confirmLabel="Sign out"
          busyText="Signing out…"
          busy={busy}
          error={modalError}
          onConfirm={() => act(() => axios.post(`${API}/api/users/teachers/${t._id}/sign-out`, {}, { headers }), `${t.name} was signed out everywhere`)}
          onClose={closeModal}
        />
      )}
      {modal?.type === "delete" && (
        <DeleteModal
          teacher={t}
          headers={headers}
          busy={busy}
          error={modalError}
          onConfirm={() => act(() => axios.delete(`${API}/api/users/teachers/${t._id}`, { headers }), `${t.name} was deleted`)}
          onRevoke={() => setModal({ type: "revoke", teacher: t })}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default TeachersPanel;
