import React, { useEffect, useRef, useState } from "react";
import { Modal } from "../Administrators/AdminModals";
import { BusyLabel } from "../../Components/Loading/Loading";

const idOf = (value) => String(value?._id ?? value ?? "");
const termLabel = (offering) => (offering.academicYearId && typeof offering.academicYearId === "object"
  ? offering.academicYearId.displayName || `${offering.academicYearId.semesterType} ${offering.academicYearId.year}`
  : offering.semesterType && offering.year ? `${offering.semesterType} ${offering.year}` : "");

// Change where an existing offering is given. The course and the term are fixed (offer a course again to change those);
// the server also locks department, program and semester once students are enrolled through the offering.
const OfferingEditModal = ({ offering, departments, programs, saving, error, onSubmit, onClose }) => {
  const initial = {
    department: idOf(offering.department),
    program: idOf(offering.program),
    semester: String(offering.semester ?? 0),
    isActive: Boolean(offering.isActive),
  };
  const [form, setForm] = useState(initial);
  const first = useRef(null);
  useEffect(() => first.current?.focus(), []);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const program = programs.find((p) => p._id === form.program);
  // Never drop the value it already has from the list, even if an older record sits beyond the program's length.
  const lastSemester = Math.max(program?.typicalDuration ?? 8, Number(form.semester) || 0);
  const changed = Object.keys(initial).some((key) => initial[key] !== form[key]);
  const valid = form.department && form.program;

  return (
    <Modal
      title="Edit course offering"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="offering-edit-form" className="am-btn am-btn-primary" disabled={saving || !changed || !valid}>
            <BusyLabel busy={saving} busyText="Saving…" idle="Save changes" />
          </button>
        </>
      }
    >
      <form id="offering-edit-form" onSubmit={(e) => { e.preventDefault(); if (changed && valid) onSubmit(form); }}>
        <p className="oem-summary">
          <strong>{offering.courseId?.code}</strong> {offering.courseId?.name}
          {termLabel(offering) && <span> · {termLabel(offering)}</span>}
        </p>
        <label className="am-field">
          <span>Department</span>
          <select ref={first} name="department" value={form.department} onChange={change} disabled={saving}>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </label>
        <label className="am-field">
          <span>Program</span>
          <select name="program" value={form.program} onChange={change} disabled={saving}>
            {programs.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
        </label>
        <label className="am-field">
          <span>Semester</span>
          <select name="semester" value={form.semester} onChange={change} disabled={saving}>
            {Array.from({ length: lastSemester + 1 }, (_, i) => (
              <option key={i} value={String(i)}>{i === 0 ? "Not placed in a semester (0)" : `Semester ${i}`}</option>
            ))}
          </select>
        </label>
        <label className="am-check">
          <input type="checkbox" name="isActive" checked={form.isActive} onChange={change} disabled={saving} />
          <span>Active <em>(inactive offerings don't appear for enrolment)</em></span>
        </label>
        {error && <div className="am-error" role="alert">{error}</div>}
      </form>
    </Modal>
  );
};

export default OfferingEditModal;
