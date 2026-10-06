import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiSearch, FiX, FiUsers, FiList } from "react-icons/fi";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { messageOf } from "../../utils/apiMessage";
import StudentWorkspace from "./StudentWorkspace";
import ChangeLog from "./ChangeLog";
import { searchStudents, initialsOf } from "./enrollmentApi";
import "../Administrators/AdministratorsPage.css";
import "../StudentPasswords/StudentPasswordsPage.css";
import "./ManageEnrollmentPage.css";

// Find a student, then change their courses. Requests usually arrive with a roll number, so the page opens on search.
const StudentSearch = ({ onPick }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(null); setError(""); return undefined; }
    let live = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      try {
        const list = await searchStudents(q);
        if (live) { setResults(list); setError(""); }
      } catch (err) {
        if (live) setError(messageOf(err, "Could not search students."));
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [query]);

  return (
    <section className="me-card me-finder">
      <div className="me-finder-icon" aria-hidden="true"><FiUsers /></div>
      <h2>Which student?</h2>
      <p>Search by roll number or name, then add, drop or move their courses.</p>
      <label className="me-search">
        <FiSearch aria-hidden="true" />
        <input type="search" placeholder="2622-6DSAI-023 or Muhammad Akif" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Find a student" autoFocus />
        {query && <button type="button" className="spp-search-clear" aria-label="Clear search" onClick={() => setQuery("")}><FiX /></button>}
      </label>
      {error && <div className="am-error" role="alert">{error}</div>}
      {results && (
        results.length === 0 ? <p className="me-empty-note">{busy ? "Searching…" : "No student matches that."}</p> : (
          <ul className="me-results" aria-busy={busy}>
            {results.map((s) => (
              <li key={s._id}>
                <button type="button" onClick={() => onPick(s._id)}>
                  <span className="me-avatar me-avatar-small" aria-hidden="true">{initialsOf(s.name)}</span>
                  <span className="me-result-text"><strong>{s.name}</strong><small>{[s.rollNumber, s.program?.code || s.program?.name, s.currentSemester !== undefined && s.currentSemester !== null ? `Semester ${s.currentSemester}` : null].filter(Boolean).join(" · ")}</small></span>
                  <span className="me-result-go">Open →</span>
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
};

const ManageEnrollmentPage = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "log" ? "log" : "students";
  const studentId = params.get("student");
  const top = useRef(null);

  const go = (next) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p);
    top.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="me page-shell" ref={top}>
      <PageHeader
        title="Manage Enrollment"
        subtitle="Add, drop or move a student's courses this semester. Each change is saved with a reason and recorded in the change log."
      />
      <div className="am-tabs me-tabs" role="tablist" aria-label="Manage Enrollment">
        <button role="tab" aria-selected={tab === "students"} className={`am-tab ${tab === "students" ? "is-active" : ""}`} onClick={() => go({ tab: null })}><FiUsers aria-hidden="true" /> Students</button>
        <button role="tab" aria-selected={tab === "log"} className={`am-tab ${tab === "log" ? "is-active" : ""}`} onClick={() => go({ tab: "log" })}><FiList aria-hidden="true" /> Change log</button>
      </div>
      {tab === "log" ? (
        <ChangeLog onOpenStudent={(id) => go({ tab: null, student: id })} />
      ) : studentId ? (
        <StudentWorkspace studentId={studentId} onClose={() => go({ student: null })} />
      ) : (
        <StudentSearch onPick={(id) => go({ student: id })} />
      )}
    </div>
  );
};

export default ManageEnrollmentPage;
