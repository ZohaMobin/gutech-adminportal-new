import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiEye, FiEyeOff, FiCopy, FiCheck, FiRefreshCw, FiKey, FiDownload, FiCheckCircle, FiLock } from "react-icons/fi";
import { BusyLabel } from "../../Components/Loading/Loading";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { messageOf } from "../../utils/apiMessage";
import { ConfirmModal, Modal } from "../Administrators/AdminModals";
import { viewPassword, issuePassword, groupPassword, copyText } from "./passwordApi";

// How long a revealed password stays on screen, in case the computer is left unattended.
export const REVEAL_MS = 30000;

const IconButton = ({ label, onClick, disabled, children }) => (
  <button type="button" className="sp-icon" aria-label={label} title={label} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

// One student's password in the directory: hidden by default, revealed on request for 30 seconds, copied in one click.
export const PasswordCell = ({ student, onIssued }) => {
  const [password, setPassword] = useState(null);   // only while revealed
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef(null);

  const issued = Boolean(student.passwordIssuedAt);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (value) => {
    setPassword(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPassword(null), REVEAL_MS);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setPassword(null);
  };

  const fetchPassword = async () => {
    setLoading(true);
    try {
      return (await viewPassword(student._id)).password;
    } catch (err) {
      showToast(messageOf(err, "Could not load this password."), TOAST_TYPES.ERROR);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (password) return hide();
    const value = await fetchPassword();
    if (value) show(value);
  };

  const copy = async () => {
    const value = password || (await fetchPassword());
    if (!value) return;
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      showToast(`Password for ${student.name} copied`, TOAST_TYPES.SUCCESS);
    } else {
      show(value);
      showToast("Couldn't copy automatically. The password is shown so you can copy it.", TOAST_TYPES.WARNING);
    }
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await issuePassword(student._id);
      setConfirming(false);
      onIssued(student._id, data.issuedAt);
      show(data.password);
      showToast(issued ? `New password ready for ${student.name}` : `Password ready for ${student.name}`, TOAST_TYPES.SUCCESS);
    } catch (err) {
      const message = messageOf(err, "Could not generate a password.");
      if (confirming) setError(message);
      else showToast(message, TOAST_TYPES.ERROR);
    } finally {
      setBusy(false);
    }
  };

  if (!issued) {
    return (
      <div className="sp-cell">
        <span className="sp-missing" title="No password has been given out from this page yet. Generate one to give them a password you can look up.">No password</span>
        <button type="button" className="sp-generate" onClick={generate} disabled={busy}>
          <BusyLabel busy={busy} busyText="Generating…" idle="Generate" />
        </button>
      </div>
    );
  }

  return (
    <div className="sp-cell">
      <span className={`sp-secret ${password ? "is-revealed" : ""}`} aria-live="polite">
        {password ? (
          <>
            <code aria-label={`Password: ${password.split("").join(" ")}`}>{groupPassword(password)}</code>
            <i className="sp-timer" style={{ animationDuration: `${REVEAL_MS}ms` }} aria-hidden="true" />
          </>
        ) : (
          <span className="sp-dots" aria-label="Password hidden">••••&#8202;••••</span>
        )}
      </span>
      <IconButton label={password ? "Hide password" : "Show password"} onClick={toggle} disabled={loading}>
        {loading ? <span className="sp-spin" aria-hidden="true" /> : password ? <FiEyeOff /> : <FiEye />}
      </IconButton>
      <IconButton label={copied ? "Copied" : "Copy password"} onClick={copy} disabled={loading}>
        {copied ? <FiCheck className="sp-ok" /> : <FiCopy />}
      </IconButton>
      <IconButton label="Generate a new password" onClick={() => setConfirming(true)}>
        <FiRefreshCw />
      </IconButton>

      {/* Portalled out of the table cell, so the cell's no-wrap and overflow don't reach the dialog. */}
      {confirming && createPortal(
        <ConfirmModal
          title="Generate a new password?"
          body={`${student.name} (${student.rollNumber}) gets a new password. Their current one stops working straight away and they are signed out everywhere.`}
          confirmLabel="Generate new password"
          busyText="Generating…"
          busy={busy}
          error={error}
          onConfirm={generate}
          onClose={() => { setConfirming(false); setError(""); }}
        />,
        document.body
      )}
    </div>
  );
};

// The strip above the table: how many students in the current list have a password, and what to do about it.
export const PasswordsBar = ({ total, missing, scope, onGenerate, onDownload, downloading }) => {
  if (!total) return null;
  const done = total - missing;
  const percent = Math.round((done / total) * 100);
  return (
    <section className={`sp-bar ${missing ? "" : "is-complete"}`} aria-label="Student passwords">
      <div className="sp-bar-icon" aria-hidden="true">{missing ? <FiKey /> : <FiCheckCircle />}</div>
      <div className="sp-bar-text">
        <strong>
          {missing
            ? `${missing} student${missing === 1 ? " doesn't" : "s don't"} have a password yet`
            : `Every student here has a password`}
        </strong>
        <span>{done} of {total} in {scope} have one · hand each one over privately</span>
        <div className="sp-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Students with a password">
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="sp-bar-actions">
        {missing > 0 && (
          <button type="button" className="sp-btn sp-btn-primary" onClick={onGenerate}>
            <FiKey /> {missing === total ? "Generate for all" : `Generate for ${missing}`}
          </button>
        )}
        <button type="button" className="sp-btn" onClick={onDownload} disabled={downloading || done === 0}>
          <FiDownload /> <BusyLabel busy={downloading} busyText="Preparing…" idle="Download CSV" />
        </button>
      </div>
    </section>
  );
};

// Before anything with passwords leaves the screen as a file.
export const DownloadModal = ({ count, scope, busy, error, onConfirm, onClose }) => (
  <Modal
    title="Download passwords"
    onClose={onClose}
    busy={busy}
    footer={
      <>
        <button type="button" className="am-btn" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="am-btn am-btn-primary" onClick={onConfirm} disabled={busy}>
          <BusyLabel busy={busy} busyText="Preparing…" idle="Download CSV" />
        </button>
      </>
    }
  >
    <div className="sp-modal-lead">
      <span className="sp-modal-icon" aria-hidden="true"><FiLock /></span>
      <p>A spreadsheet of <strong>{count} student{count === 1 ? "" : "s"}</strong> in {scope}: roll number, name, email, program, semester and password.</p>
    </div>
    <ul className="sp-tips">
      <li>Keep the file private and delete it once the passwords are handed out.</li>
      <li>Students without a password are listed as “No password”.</li>
      <li>This download is recorded in the audit log.</li>
    </ul>
    {error && <div className="am-error" role="alert">{error}</div>}
  </Modal>
);

// Bulk generate: one confirm, then the passwords are issued and the CSV of the whole list downloads by itself, so an
// admin who imported in several batches ends up with a single file. The "done" screen can download it again.
export const GenerateModal = ({ missing, total, scope, result, busy, error, downloading, onConfirm, onDownload, onClose }) => {
  if (result) {
    return (
      <Modal
        title="Passwords ready"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="am-btn sp-inline" onClick={onDownload} disabled={downloading}>
              <FiDownload aria-hidden="true" /> <BusyLabel busy={downloading} busyText="Preparing…" idle={result.fileName ? "Download again" : "Download CSV"} />
            </button>
            <button type="button" className="am-btn am-btn-primary" onClick={onClose}>Done</button>
          </>
        }
      >
        <div className="sp-success">
          <span className="sp-success-icon" aria-hidden="true"><FiCheck /></span>
          <p><strong>{result.issued} student{result.issued === 1 ? "" : "s"}</strong> now {result.issued === 1 ? "has" : "have"} a password.</p>
          {result.skipped > 0 && <small>{result.skipped} already had one and kept it.</small>}
        </div>
        {result.fileName ? (
          <div className="sp-file">
            <FiDownload aria-hidden="true" />
            <div>
              <strong>{result.fileName}</strong>
              <span>Downloaded · all {total} student{total === 1 ? "" : "s"} in {scope}, with their passwords</span>
            </div>
          </div>
        ) : (
          <div className="am-error" role="alert">{result.downloadError || "The CSV didn't download."} Try “Download CSV” below.</div>
        )}
        <p className="am-hint">Keep the file private and delete it once the passwords are handed out.</p>
      </Modal>
    );
  }
  return (
    <ConfirmModal
      title="Generate passwords"
      body={`${missing} student${missing === 1 ? "" : "s"} in ${scope} ${missing === 1 ? "doesn't" : "don't"} have a password yet. Each gets a new 8-character password, and a CSV of all ${total} student${total === 1 ? "" : "s"} downloads straight after.`}
      confirmLabel="Generate and download"
      busyText="Generating…"
      busy={busy}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    >
      <p className="am-hint">Students who already have a password keep it. This can take a few seconds for a large class.</p>
    </ConfirmModal>
  );
};
