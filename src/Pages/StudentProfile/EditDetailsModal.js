import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";
import { BusyLabel } from "../../Components/Loading/Loading";
import { messageOf } from "../../utils/apiMessage";
import { semesterLabel } from "../../utils/semester";
import { useDepartmentsAndPrograms } from "../../hooks/useDepartmentsAndPrograms";
import { Modal } from "../Administrators/AdminModals";

const API = process.env.REACT_APP_BACKEND_URL;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idOf = (v) => (v && typeof v === "object" ? v._id || v.id : v) || "";

// Correct a student's name, email, roll number, department, program or semester. Only what changed is sent, and the
// change is recorded in their history with the old and new values.
const EditDetailsModal = ({ student, onDone, onClose }) => {
  const { departments, programs, loading } = useDepartmentsAndPrograms();
  const original = useMemo(() => ({
    name: student.name || "",
    email: student.email || "",
    rollNumber: student.rollNumber || "",
    department: String(idOf(student.departmentId)),
    program: String(idOf(student.programId)),
    currentSemester: student.currentSemester === null || student.currentSemester === undefined ? "" : String(student.currentSemester),
  }), [student]);
  const [form, setForm] = useState(original);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const first = useRef(null);
  useEffect(() => first.current?.focus(), []);

  const change = (e) => { setForm((f) => ({ ...f, [e.target.name]: e.target.value })); setError(""); };
  const program = programs.find((p) => String(p._id) === form.program);
  const semesters = Array.from({ length: (program?.typicalDuration || 8) + 1 }, (_, i) => i);

  const changes = {};
  if (form.name.trim().replace(/\s+/g, " ") !== original.name) changes.name = form.name.trim();
  if (form.email.trim().toLowerCase() !== original.email.toLowerCase()) changes.email = form.email.trim();
  if (form.rollNumber.trim().toUpperCase() !== original.rollNumber.toUpperCase()) changes.rollNumber = form.rollNumber.trim();
  if (form.department !== original.department) changes.department = form.department;
  if (form.program !== original.program) changes.program = form.program;
  if (form.currentSemester !== original.currentSemester && form.currentSemester !== "") changes.currentSemester = Number(form.currentSemester);
  const dirty = Object.keys(changes).length > 0;
  const valid = form.name.trim().length >= 2 && EMAIL.test(form.email.trim()) && form.rollNumber.trim().length >= 3;

  const save = async (e) => {
    e.preventDefault();
    if (!dirty || !valid) return;
    try {
      setBusy(true);
      setError("");
      const { data } = await axios.patch(`${API}/api/students/${student.id}/details`, { ...changes, ...(note.trim() && { note: note.trim() }) }, { headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` } });
      onDone(data.message);
    } catch (err) {
      setError(messageOf(err, "Could not save these details."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Edit details"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="pf-edit" className="am-btn am-btn-primary" disabled={busy || !dirty || !valid}>
            <BusyLabel busy={busy} busyText="Saving…" idle="Save changes" />
          </button>
        </>
      }
    >
      <form id="pf-edit" onSubmit={save} className="pf-edit">
        <label className="am-field">
          <span>Full name</span>
          <input ref={first} name="name" value={form.name} onChange={change} disabled={busy} autoComplete="off" />
        </label>
        <div className="pf-edit-row">
          <label className="am-field">
            <span>Roll number <em>(sign-in)</em></span>
            <input name="rollNumber" value={form.rollNumber} onChange={change} disabled={busy} autoComplete="off" className="pf-mono" />
          </label>
          <label className="am-field">
            <span>Email</span>
            <input name="email" type="email" value={form.email} onChange={change} disabled={busy} autoComplete="off" />
          </label>
        </div>
        <div className="pf-edit-row pf-edit-row-3">
          <label className="am-field">
            <span>Department</span>
            <select name="department" value={form.department} onChange={change} disabled={busy || loading}>
              {!form.department && <option value="">Choose…</option>}
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </label>
          <label className="am-field">
            <span>Program</span>
            <select name="program" value={form.program} onChange={change} disabled={busy || loading}>
              {!form.program && <option value="">Choose…</option>}
              {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </label>
          <label className="am-field">
            <span>Semester</span>
            <select name="currentSemester" value={form.currentSemester} onChange={change} disabled={busy}>
              {form.currentSemester === "" && <option value="">Choose…</option>}
              {semesters.map((n) => <option key={n} value={n}>{semesterLabel(n)}</option>)}
            </select>
          </label>
        </div>

        {changes.rollNumber && <p className="pf-edit-warn"><FiAlertTriangle aria-hidden="true" /> They'll be signed out and must sign in with the new roll number. Let them know.</p>}
        {changes.program && <p className="pf-edit-info"><FiInfo aria-hidden="true" /> Their courses this semester stay as they are. Check them in the Courses tab.</p>}

        {dirty && (
          <label className="am-field">
            <span>Note <em>(optional, saved in their history)</em></span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} disabled={busy} placeholder="Registrar correction, 8 Oct" />
          </label>
        )}
        {error && <div className="am-error" role="alert">{error}</div>}
      </form>
    </Modal>
  );
};

export default EditDetailsModal;
