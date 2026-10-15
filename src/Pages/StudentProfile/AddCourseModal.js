import React, { useEffect, useMemo, useState } from "react";
import { FiCheck, FiSearch } from "react-icons/fi";
import Loading from "../../Components/Loading/Loading";
import { messageOf } from "../../utils/apiMessage";
import { Modal } from "../Administrators/AdminModals";
import { getCourseOptions, plural } from "../ManageEnrollment/enrollmentApi";

const isFull = (s) => s.capacity !== null && s.capacity !== undefined && s.taken >= s.capacity;
const seatsText = (s) => (s.capacity === null || s.capacity === undefined ? `${s.taken} enrolled` : `${s.taken} of ${s.capacity} seats`);

// Pick one or more courses offered this semester, each with a section, and add them to the pending changes together.
// The student's own program's courses come first. Nothing is saved here: the panel still checks and reviews everything.
const AddCourseModal = ({ studentId, studentName, exclude, currentCredits, onAdd, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [picks, setPicks] = useState({});   // courseOfferingId -> chosen section

  useEffect(() => {
    let live = true;
    getCourseOptions(studentId)
      .then((result) => live && setData(result))
      .catch((err) => live && setError(messageOf(err, "Could not load this semester's courses.")));
    return () => { live = false; };
  }, [studentId]);

  const { own, others } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (data?.options || [])
      .filter((o) => !exclude.has(String(o.course.id)))
      .filter((o) => !needle || `${o.course.code} ${o.course.name}`.toLowerCase().includes(needle));
    return { own: list.filter((o) => o.ownProgram), others: list.filter((o) => !o.ownProgram) };
  }, [data, query, exclude]);

  // Picks survive searching, so they are read from the full list, not the filtered one.
  const chosen = (data?.options || []).filter((o) => picks[String(o.courseOfferingId)]);
  const chosenCredits = chosen.reduce((sum, o) => sum + (o.course.creditHours || 0), 0);

  const setPick = (id, section) => setPicks((current) => {
    const next = { ...current };
    if (section) next[String(id)] = section; else delete next[String(id)];
    return next;
  });

  // The tick: off → on picks the only open section straight away (or opens the list to choose one); on → off clears it.
  const toggle = (option) => {
    const id = String(option.courseOfferingId);
    if (picks[id]) return setPick(id, null);
    const open = option.sections.filter((s) => !isFull(s));
    if (open.length === 1) return setPick(id, open[0]);
    setOpenId(option.courseOfferingId);
  };

  const renderCourse = (option) => {
    const id = String(option.courseOfferingId);
    const open = String(openId) === id;
    const pick = picks[id];
    const noSeat = option.sections.every(isFull);
    return (
      <li key={id} className={`me-pick ${open ? "is-open" : ""} ${pick ? "is-picked" : ""}`}>
        <div className="me-pick-head">
          <button type="button" className={`me-tick ${pick ? "is-on" : ""}`} role="checkbox" aria-checked={Boolean(pick)} aria-label={`Select ${option.course.code || option.course.name}`} disabled={noSeat} onClick={() => toggle(option)}>
            {pick && <FiCheck aria-hidden="true" />}
          </button>
          <button type="button" className="me-pick-row" onClick={() => setOpenId(open ? null : option.courseOfferingId)} aria-expanded={open}>
            <span className="me-code">{option.course.code || "—"}</span>
            <span className="me-pick-text">
              <strong>{option.course.name}</strong>
              <small>{plural(option.course.creditHours, "credit")} · {plural(option.sections.length, "section")}{option.program && !option.ownProgram ? ` · ${option.program.code || option.program.name}` : ""}{noSeat ? " · all full" : ""}</small>
            </span>
            {pick && <span className="me-pick-chip">Section {pick.name}</span>}
          </button>
        </div>
        {open && (
          <div className="me-sections me-pick-sections">
            {option.sections.map((s) => {
              const full = isFull(s);
              return (
                <label key={s.id} className={`me-section ${pick?.id === s.id ? "is-on" : ""} ${full ? "is-full" : ""}`}>
                  <input type="radio" name={`me-add-section-${id}`} disabled={full} checked={pick?.id === s.id} onChange={() => setPick(id, s)} />
                  <span className="me-section-name">Section {s.name}</span>
                  <span className="me-section-meta">{s.teachers.join(", ") || "No teacher yet"}</span>
                  <span className={`me-seats ${full ? "is-full" : ""}`}>{full ? "Full" : seatsText(s)}</span>
                </label>
              );
            })}
          </div>
        )}
      </li>
    );
  };

  const count = chosen.length;
  return (
    <Modal
      title="Add courses"
      onClose={onClose}
      footer={
        <>
          <span className="me-pick-summary" role="status" aria-live="polite">
            {count === 0 ? "Tick the courses to add" : `${plural(count, "course")} · ${plural(chosenCredits, "credit")}${currentCredits !== undefined ? ` · total ${currentCredits + chosenCredits}` : ""}`}
          </span>
          <button type="button" className="am-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="am-btn am-btn-primary" disabled={count === 0} onClick={() => onAdd(chosen.map((o) => ({ courseOfferingId: o.courseOfferingId, course: o.course, section: picks[String(o.courseOfferingId)] })))}>
            {count > 1 ? `Add ${count} to changes` : "Add to changes"}
          </button>
        </>
      }
    >
      <p className="am-confirm-text">Courses offered {data?.term?.label ? `in ${data.term.label}` : "this semester"} that {studentName.split(" ")[0]} isn't taking. Pick as many as you need, each with a section.</p>
      <label className="me-search me-search-small">
        <FiSearch aria-hidden="true" />
        <input type="search" placeholder="Search by course code or name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search courses" autoFocus />
      </label>
      {error ? <div className="am-error" role="alert">{error}</div>
        : !data ? <Loading variant="list" rows={4} label="Loading courses" />
        : own.length + others.length === 0 ? <p className="me-empty-note">{query ? "No course matches that." : "No other course is offered this semester."}</p>
        : (
          <div className="me-pick-scroll">
            {own.length > 0 && <><p className="me-group">Their program</p><ul className="me-pick-list">{own.map(renderCourse)}</ul></>}
            {others.length > 0 && <><p className="me-group">Other programs</p><ul className="me-pick-list">{others.map(renderCourse)}</ul></>}
          </div>
        )}
    </Modal>
  );
};

export default AddCourseModal;
