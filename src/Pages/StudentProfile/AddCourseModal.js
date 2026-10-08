import React, { useEffect, useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import Loading from "../../Components/Loading/Loading";
import { messageOf } from "../../utils/apiMessage";
import { Modal } from "../Administrators/AdminModals";
import { getCourseOptions, plural } from "../ManageEnrollment/enrollmentApi";

const isFull = (s) => s.capacity !== null && s.capacity !== undefined && s.taken >= s.capacity;
const seatsText = (s) => (s.capacity === null || s.capacity === undefined ? `${s.taken} enrolled` : `${s.taken} of ${s.capacity} seats`);

// Pick a course offered this semester, then its section. The student's own program's courses come first.
const AddCourseModal = ({ studentId, studentName, exclude, onAdd, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);
  const [section, setSection] = useState(null);

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

  const picked = [...own, ...others].find((o) => String(o.courseOfferingId) === String(openId));

  const Course = ({ option }) => {
    const open = String(option.courseOfferingId) === String(openId);
    return (
      <li className={`me-pick ${open ? "is-open" : ""}`}>
        <button type="button" className="me-pick-row" onClick={() => { setOpenId(open ? null : option.courseOfferingId); setSection(null); }} aria-expanded={open}>
          <span className="me-code">{option.course.code || "—"}</span>
          <span className="me-pick-text">
            <strong>{option.course.name}</strong>
            <small>{plural(option.course.creditHours, "credit")} · {plural(option.sections.length, "section")}{option.program && !option.ownProgram ? ` · ${option.program.code || option.program.name}` : ""}</small>
          </span>
        </button>
        {open && (
          <div className="me-sections me-pick-sections">
            {option.sections.map((s) => {
              const full = isFull(s);
              return (
                <label key={s.id} className={`me-section ${section?.id === s.id ? "is-on" : ""} ${full ? "is-full" : ""}`}>
                  <input type="radio" name="me-add-section" disabled={full} checked={section?.id === s.id} onChange={() => setSection(s)} />
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

  return (
    <Modal
      title="Add a course"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="am-btn am-btn-primary" disabled={!picked || !section} onClick={() => onAdd({ courseOfferingId: picked.courseOfferingId, course: picked.course, section })}>
            Add to changes
          </button>
        </>
      }
    >
      <p className="am-confirm-text">Courses offered {data?.term?.label ? `in ${data.term.label}` : "this semester"} that {studentName.split(" ")[0]} isn't taking.</p>
      <label className="me-search me-search-small">
        <FiSearch aria-hidden="true" />
        <input type="search" placeholder="Search by course code or name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search courses" autoFocus />
      </label>
      {error ? <div className="am-error" role="alert">{error}</div>
        : !data ? <Loading variant="list" rows={4} label="Loading courses" />
        : own.length + others.length === 0 ? <p className="me-empty-note">{query ? "No course matches that." : "No other course is offered this semester."}</p>
        : (
          <div className="me-pick-scroll">
            {own.length > 0 && <><p className="me-group">Their program</p><ul className="me-pick-list">{own.map((o) => <Course key={o.courseOfferingId} option={o} />)}</ul></>}
            {others.length > 0 && <><p className="me-group">Other programs</p><ul className="me-pick-list">{others.map((o) => <Course key={o.courseOfferingId} option={o} />)}</ul></>}
          </div>
        )}
    </Modal>
  );
};

export default AddCourseModal;
