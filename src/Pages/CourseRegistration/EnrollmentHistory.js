import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { messageOf } from "../../utils/apiMessage";
import "./EnrollmentHistory.css";

const STATUS = {
  done: { label: "Finished", tone: "ok" },
  running: { label: "Running", tone: "wait" },
  queued: { label: "Waiting to start", tone: "wait" },
  failed: { label: "Stopped", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "bad" },
};
const ROW_LABEL = { registered: "Enrolled", "already-registered": "Already enrolled", failed: "Not enrolled", pending: "Not processed" };
const ROW_TONE = { registered: "ok", "already-registered": "muted", failed: "bad", pending: "wait" };

const when = (value) => (value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What an upload came to, in a few words: "35 enrolled · 2 already enrolled · 2 not enrolled".
export const resultText = (item) => {
  if (item.status === "queued" || item.status === "running") return `${item.processed} of ${item.total} done so far`;
  const parts = [`${item.registered} enrolled`];
  if (item.alreadyRegistered) parts.push(`${item.alreadyRegistered} already enrolled`);
  if (item.failed) parts.push(`${item.failed} not enrolled`);
  return parts.join(" · ");
};

// The recent uploads, newest first: who uploaded which file for which course, when, and what came of it. Selecting one
// opens its full report (every student and what happened), loaded only then.
const EnrollmentHistory = ({ apiUrl, headers, refreshKey }) => {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reports, setReports] = useState({});     // jobId -> { rows } | { error } | "loading"

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await axios.get(`${apiUrl}/api/course-registrations/bulk-enroll`, { params: { limit: 20 }, headers: headers() });
      setItems(data.items || []);
    } catch (err) {
      setError(messageOf(err, "The enrolment history could not be loaded."));
      setItems((current) => current || []);
    }
  }, [apiUrl, headers]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const toggle = async (item) => {
    if (openId === item.jobId) { setOpenId(null); return; }
    setOpenId(item.jobId);
    if (reports[item.jobId]?.rows) return;
    setReports((current) => ({ ...current, [item.jobId]: "loading" }));
    try {
      const { data } = await axios.get(`${apiUrl}/api/course-registrations/bulk-enroll/${item.jobId}`, { headers: headers() });
      setReports((current) => ({ ...current, [item.jobId]: { rows: data.rows || [] } }));
    } catch (err) {
      setReports((current) => ({ ...current, [item.jobId]: { error: messageOf(err, "The report could not be loaded.") } }));
    }
  };

  return (
    <section className="enh" aria-labelledby="enh-title">
      <header className="enh-head">
        <div>
          <h2 id="enh-title">Enrollment history</h2>
          <p>Recent uploads: who added a class list, when, and what happened to each student.</p>
        </div>
        <button type="button" className="enh-refresh" onClick={load}>Refresh</button>
      </header>

      {error && <p className="enh-error" role="alert">{error}</p>}
      {items === null ? (
        <div className="enh-skeleton" aria-busy="true"><span /><span /><span /></div>
      ) : items.length === 0 ? (
        <p className="enh-empty">Nothing has been uploaded yet. Each list you enroll appears here.</p>
      ) : (
        <ul className="enh-list">
          {items.map((item) => {
            const open = openId === item.jobId;
            const report = reports[item.jobId];
            const status = STATUS[item.status] || STATUS.queued;
            return (
              <li key={item.jobId} className={`enh-item ${open ? "is-open" : ""}`}>
                <button type="button" className="enh-row" onClick={() => toggle(item)} aria-expanded={open}>
                  <span className="enh-main">
                    <strong>{item.course ? `${item.course.code} ${item.course.name}` : "Course no longer available"}</strong>
                    <small>{[item.term, item.semester !== null ? `Semester ${item.semester}` : null, item.fileName].filter(Boolean).join(" · ")}</small>
                  </span>
                  <span className="enh-who">
                    <span>{item.by?.name || "Unknown"}</span>
                    <small>{when(item.createdAt)}</small>
                  </span>
                  <span className="enh-result">
                    <span className={`enh-pill ${status.tone}`}>{status.label}</span>
                    <small>{resultText(item)}</small>
                    {item.leftOut > 0 && <small className="enh-left">{plural(item.leftOut, "row")} of the file left out</small>}
                  </span>
                  <svg className="enh-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
                </button>
                {open && (
                  <div className="enh-report">
                    {report === "loading" || !report ? <p className="enh-muted">Loading the report…</p>
                      : report.error ? <p className="enh-error" role="alert">{report.error}</p>
                      : (
                        <div className="enh-table">
                          <table>
                            <thead><tr><th>Roll number</th><th>Section</th><th>Result</th><th>Details</th></tr></thead>
                            <tbody>
                              {report.rows.map((row, index) => (
                                <tr key={`${row.rollNumber}-${index}`}>
                                  <td>{row.rollNumber}</td>
                                  <td>{row.section || "–"}</td>
                                  <td><span className={`enh-tag ${ROW_TONE[row.status] || "muted"}`}>{ROW_LABEL[row.status] || row.status}</span></td>
                                  <td>{row.message || ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    {item.note && <p className="enh-error">{item.note}</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default EnrollmentHistory;
