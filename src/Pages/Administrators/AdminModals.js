import React, { useEffect, useRef, useState } from "react";

// A small accessible modal: dialog role, closes on Escape or a click on the backdrop.
export const Modal = ({ title, onClose, children, footer, busy = false }) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div className="am-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="am-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="am-modal-header">
          <h2>{title}</h2>
          <button type="button" className="am-icon-btn" aria-label="Close" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>
        <div className="am-modal-body">{children}</div>
        {footer && <div className="am-modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

// Add or edit an administrator. Email is only editable when adding: it is the login.
export const AdminFormModal = ({ admin, saving, error, onSubmit, onClose }) => {
  const editing = Boolean(admin);
  const [form, setForm] = useState({
    name: admin?.name || "",
    email: admin?.email || "",
    employeeId: admin?.employeeId || "",
  });
  const first = useRef(null);
  useEffect(() => first.current?.focus(), []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const valid = form.name.trim() && form.employeeId.trim() && (editing || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()));

  return (
    <Modal
      title={editing ? "Edit administrator" : "Add administrator"}
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="admin-form" className="am-btn am-btn-primary" disabled={saving || !valid}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add administrator"}
          </button>
        </>
      }
    >
      <form
        id="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(form);
        }}
      >
        <label className="am-field">
          <span>Full name</span>
          <input ref={first} name="name" value={form.name} onChange={change} disabled={saving} autoComplete="off" />
        </label>
        <label className="am-field">
          <span>Email {editing && <em>(used to sign in — cannot be changed)</em>}</span>
          <input name="email" type="email" value={form.email} onChange={change} disabled={saving || editing} autoComplete="off" />
        </label>
        <label className="am-field">
          <span>Employee ID</span>
          <input name="employeeId" value={form.employeeId} onChange={change} disabled={saving} autoComplete="off" />
        </label>
        {!editing && (
          <p className="am-hint">
            A temporary password is generated and shown once, so you can pass it on. They can change it any time from the profile menu.
          </p>
        )}
        {error && <div className="am-error" role="alert">{error}</div>}
      </form>
    </Modal>
  );
};

// Confirmation for anything with consequences, with the consequence spelled out.
export const ConfirmModal = ({ title, body, confirmLabel, danger = false, busy, error, onConfirm, onClose }) => (
  <Modal
    title={title}
    onClose={onClose}
    busy={busy}
    footer={
      <>
        <button type="button" className="am-btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={`am-btn ${danger ? "am-btn-danger" : "am-btn-primary"}`} onClick={onConfirm} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </>
    }
  >
    <p className="am-confirm-text">{body}</p>
    {error && <div className="am-error" role="alert">{error}</div>}
  </Modal>
);

// Shows a temporary password exactly once. It is not stored anywhere readable after this.
export const CredentialModal = ({ name, email, temporaryPassword, heading, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Modal
      title={heading}
      onClose={onClose}
      footer={
        <button type="button" className="am-btn am-btn-primary" onClick={onClose}>
          I have saved it
        </button>
      }
    >
      <p className="am-confirm-text">
        Give <strong>{name}</strong> ({email}) this temporary password. It works straight away, and they can change it whenever they like.
      </p>
      <div className="am-credential">
        <code data-testid="temporary-password">{temporaryPassword}</code>
        <button type="button" className="am-btn" onClick={copy}>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <p className="am-warning">This is the only time it will be shown. It cannot be looked up later, but you can reset it.</p>
    </Modal>
  );
};
