import React from "react";
import { Link } from "react-router-dom";
import { dateTime } from "../ManageEnrollment/enrollmentApi";

const courseTitle = (c) => [c.code, c.name].filter(Boolean).join(" · ");

// Everything recorded for one student, newest first: course changes and account changes, each with who and why.
const HistoryList = ({ history, firstName }) => (
  <section className="me-card">
    <header className="me-card-head">
      <div>
        <h3>History</h3>
        <p>{history.length ? `Every change recorded for ${firstName}, newest first.` : `Nothing has been changed for ${firstName} yet.`}</p>
      </div>
      <Link className="sp-btn" to="/manage-enrollment?tab=log">Full change log</Link>
    </header>
    {history.length > 0 && (
      <ol className="me-timeline">
        {history.map((h) => (
          <li key={h.id}>
            <span className={`me-dot ${h.action.split(".")[1]}`} aria-hidden="true" />
            <div>
              <strong>{h.label}</strong> {h.course ? courseTitle(h.course) : ""}
              {(h.fromSection || h.toSection) && <span className="me-sec"> · {h.fromSection && h.toSection ? `Section ${h.fromSection} → ${h.toSection}` : `Section ${h.toSection || h.fromSection}`}</span>}
              {h.reason && <p className="me-why">“{h.reason}”</p>}
              <small>{dateTime(h.at)}{h.by ? ` · ${h.by}` : ""}</small>
            </div>
          </li>
        ))}
      </ol>
    )}
  </section>
);

export default HistoryList;
