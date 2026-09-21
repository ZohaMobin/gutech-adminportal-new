import Loading, { Refreshing } from '../../Components/Loading/Loading';
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  const [filter, setFilter] = useState("all");      // all | attention | running
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setRefreshing(true);
      const { data } = await axios.get(`${apiUrl}/api/course-registrations/bulk-enroll`, { params: { limit: 20 }, headers: headers() });
      setItems(data.items || []);
    } catch (err) {
      setError(messageOf(err, "The enrolment history could not be loaded."));
      setItems((current) => current || []);
    } finally {
      setRefreshing(false);
    }
  }, [apiUrl, headers]);
  useEffect(() => { load(); }, [load, refreshKey]);

  // While an upload is still running, keep the list fresh (gently, and not while the tab is hidden).
  const anyRunning = (items || []).some((i) => i.status === "queued" || i.status === "running");
  useEffect(() => {
    if (!anyRunning) return undefined;
    const timer = setInterval(() => { if (!document.hidden) load(); }, 3000);
    return () => clearInterval(timer);
  }, [anyRunning, load]);

  const totals = useMemo(() => {
    const list = items || [];
    return {
      uploads: list.length,
      enrolled: list.reduce((n, i) => n + (i.registered || 0), 0),
      attention: list.filter((i) => i.failed > 0 || i.status === "failed").length,
      running: list.filter((i) => i.status === "queued" || i.status === "running").length,
    };
  }, [items]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (items || []).filter((i) => {
      if (filter === "attention" && !(i.failed > 0 || i.status === "failed")) return false;
      if (filter === "running" && !(i.status === "queued" || i.status === "running")) return false;
      if (!needle) return true;
      return `${i.course?.code || ""} ${i.course?.name || ""} ${i.fileName || ""} ${i.by?.name || ""} ${i.term || ""}`.toLowerCase().includes(needle);
    });
  }, [items, filter, query]);

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

      {items && items.length > 0 && (
        <>
          <div className="enh-stats">
            <div><span>Recent uploads</span><strong>{totals.uploads}</strong></div>
            <div><span>Students enrolled</span><strong>{totals.enrolled}</strong></div>
            <div className={totals.attention ? "is-warn" : ""}><span>Need attention</span><strong>{totals.attention}</strong></div>
            <div className={totals.running ? "is-live" : ""}><span>Running now</span><strong>{totals.running}</strong></div>
          </div>
          <div className="enh-tools">
            <div className="enh-filters" role="group" aria-label="Show">
              {[["all", "All"], ["attention", "Need attention"], ["running", "Running"]].map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? "is-on" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
            <input id="enh-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search course, file or person" aria-label="Search uploads" />
          </div>
        </>
      )}

      {error && <p className="enh-error" role="alert">{error}</p>}
      {items === null ? (
        <div className="enh-skeleton" aria-busy="true"><span /><span /><span /></div>
      ) : items.length === 0 ? (
        <p className="enh-empty">Nothing has been uploaded yet. Each list you enroll appears here.</p>
      ) : shown.length === 0 ? (
        <p className="enh-empty">No upload matches that.</p>
      ) : (
        <Refreshing active={refreshing}>
        <ul className="enh-list">
          {shown.map((item) => {
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
                    {(item.status === "queued" || item.status === "running") && item.total > 0 && <span className="enh-bar"><i style={{ width: `${Math.round((item.processed / item.total) * 100)}%` }} /></span>}
                    {item.leftOut > 0 && <small className="enh-left">{plural(item.leftOut, "row")} of the file left out</small>}
                  </span>
                  <svg className="enh-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
                </button>
                {open && (
                  <div className="enh-report">
                    {report === "loading" || !report ? <Loading variant="table" rows={4} label="Loading the report" />
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
        </Refreshing>
      )}
    </section>
  );
};

export default EnrollmentHistory;
