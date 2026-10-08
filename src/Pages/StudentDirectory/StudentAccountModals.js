import React, { useEffect, useState } from "react";
import axios from "axios";
import { FiLogOut, FiBookOpen, FiLock, FiArchive } from "react-icons/fi";
import Loading, { BusyLabel } from "../../Components/Loading/Loading";
import { messageOf } from "../../utils/apiMessage";
import { ConfirmModal, Modal } from "../Administrators/AdminModals";
import "../Administrators/AdministratorsPage.css";
import "./StudentAccount.css";

const API = process.env.REACT_APP_BACKEND_URL;
const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` });

export const REASONS = [
  { id: "withdrew", label: "Withdrew", hint: "Left their studies" },
  { id: "left", label: "Left the university", hint: "Transferred or moved on" },
  { id: "suspended", label: "Suspended", hint: "Temporary; keeps their courses" },
  { id: "other", label: "Other", hint: "Explain in the note" },
];

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
const courseList = (courses) => courses.map((c) => [c.code, c.name].filter(Boolean).join(" ")).join(", ");

// Deactivate: why (one of four), an optional note, and what will happen, then confirm.
export const DeactivateModal = ({ student, onDone, onClose }) => {
  const [preview, setPreview] = useState(null);
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    axios.get(`${API}/api/students/${student._id}/deactivate`, { headers: headers() })
      .then(({ data }) => live && setPreview(data))
      .catch((err) => live && setError(messageOf(err, "Could not check this student's courses.")));
    return () => { live = false; };
  }, [student._id]);

  const ready = category && (category !== "other" || note.trim().length >= 3) && preview && !busy;
  const confirm = async () => {
    try {
      setBusy(true);
      setError("");
      const { data } = await axios.post(`${API}/api/students/${student._id}/deactivate`, { category, note: note.trim() }, { headers: headers() });
      onDone(data.message);
    } catch (err) {
      setError(messageOf(err, "Could not deactivate this student."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Deactivate student"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="am-btn am-btn-danger" onClick={confirm} disabled={!ready}>
            <BusyLabel busy={busy} busyText="Deactivating…" idle="Deactivate student" />
          </button>
        </>
      }
    >
      <div className="sda-who">
        <span className="sda-avatar" aria-hidden="true">{initials(student.name)}</span>
        <div><strong>{student.name}</strong><small>{student.rollNumber}{student.program?.code || student.program?.name ? ` · ${student.program.code || student.program.name}` : ""}</small></div>
      </div>

      <p className="sda-label" id="sda-why">Why?</p>
      <div className="sda-reasons" role="radiogroup" aria-labelledby="sda-why">
        {REASONS.map((r) => (
          <label key={r.id} className={`sda-reason ${category === r.id ? "is-on" : ""}`}>
            <input type="radio" name="sda-reason" checked={category === r.id} onChange={() => setCategory(r.id)} />
            <span><strong>{r.label}</strong><small>{r.hint}</small></span>
          </label>
        ))}
      </div>

      <label className="am-field sda-note">
        <span>Note {category === "other" ? <em>(required)</em> : <em>(optional)</em>}</span>
        <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Withdrawal letter dated 7 Oct, approved by the Registrar" />
      </label>

      <p className="sda-label">What happens</p>
      {!preview && !error ? <Loading variant="list" rows={2} label="Checking courses" /> : preview && (
        <ul className="sda-effects">
          <li><FiLogOut aria-hidden="true" /><span>Signed out straight away, and can't sign in until reactivated.</span></li>
          <li><FiBookOpen aria-hidden="true" /><span>
            {!preview.willDrop.length
              ? "Not enrolled in any course this semester, so no course is dropped."
              : category === "suspended"
                ? <>Stays enrolled in {courseList(preview.willDrop)}. Teachers see a "Suspended" tag, and everything is as it was when they're reactivated.</>
                : category
                  ? <>Dropped from {preview.willDrop.length === 1 ? "1 course" : `${preview.willDrop.length} courses`} this semester: {courseList(preview.willDrop)}.</>
                  : <>Choose a reason to see what happens to their {preview.willDrop.length === 1 ? "course" : `${preview.willDrop.length} courses`}: suspended students keep them, everyone else is dropped.</>}
          </span></li>
          {preview.lockedStay.length > 0 && category !== "suspended" && <li><FiLock aria-hidden="true" /><span>{courseList(preview.lockedStay)} {preview.lockedStay.length === 1 ? "has a locked result and stays" : "have locked results and stay"} as {preview.lockedStay.length === 1 ? "it is" : "they are"}.</span></li>}
          <li><FiArchive aria-hidden="true" /><span>Past results, transcript, attendance and marks are kept. This can be undone with Reactivate.</span></li>
        </ul>
      )}
      {error && <div className="am-error" role="alert">{error}</div>}
    </Modal>
  );
};

// Reactivate: sign-in comes back; dropped courses don't.
export const ReactivateModal = ({ student, onDone, onClose }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirm = async () => {
    try {
      setBusy(true);
      setError("");
      const { data } = await axios.post(`${API}/api/students/${student._id}/reactivate`, {}, { headers: headers() });
      onDone(data.message);
    } catch (err) {
      setError(messageOf(err, "Could not reactivate this student."));
      setBusy(false);
    }
  };
  return (
    <ConfirmModal
      title="Reactivate student"
      body={`${student.name} (${student.rollNumber}) will be able to sign in again with their current password.`}
      confirmLabel="Reactivate"
      busyText="Reactivating…"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onClose={onClose}
    >
      <p className="am-hint">Courses dropped when they were deactivated are not added back. Use Manage Enrollment to enroll them again if needed.</p>
    </ConfirmModal>
  );
};
