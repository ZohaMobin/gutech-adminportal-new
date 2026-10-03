import Loading, { Refreshing } from "../../Components/Loading/Loading";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { messageOf } from "../../utils/apiMessage";
import { downloadCsv } from "../../utils/csv";
import "../CourseRegistration/EnrollmentHistory.css";
import "./ImportHistory.css";

const when = (value) => (value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

// How an import came out, as one word and a colour.
export const outcomeOf = (item) => {
  if (item.failed === 0) return { label: "All added", tone: "ok" };
  if (item.created === 0) return { label: "None added", tone: "bad" };
  return { label: "Partly added", tone: "wait" };
};
export const resultText = (item) => {
  const parts = [`${item.created} added`];
  if (item.failed) parts.push(`${item.failed} not added`);
  return parts.join(" · ");
};

// The student imports so far, newest first: who ran each one, when, which file, and how it went. Opening one shows every
// row and why any were refused, which is what to check before fixing the file and uploading it again.
const ImportHistory = ({ apiUrl, headers, refreshKey }) => {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [reports, setReports] = useState({});          // importId -> { rows } | { error } | "loading"
  const [filter, setFilter] = useState("all");          // all | attention
  const [query, setQuery] = useState("");
  const [problemsOnly, setProblemsOnly] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setRefreshing(true);
      const { data } = await axios.get(`${apiUrl}/api/students/bulk/history`, { params: { limit: 20 }, headers: headers() });
      setItems(data.items || []);
    } catch (err) {
      setError(messageOf(err, "The import history could not be loaded."));
      setItems((current) => current || []);
    } finally {
      setRefreshing(false);
    }
  }, [apiUrl, headers]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const totals = useMemo(() => {
    const list = items || [];
    return { imports: list.length, added: list.reduce((n, i) => n + (i.created || 0), 0), attention: list.filter((i) => i.failed > 0).length };
  }, [items]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (items || []).filter((i) => {
      if (filter === "attention" && !(i.failed > 0)) return false;
      if (!needle) return true;
      return `${i.fileName || ""} ${i.by?.name || ""}`.toLowerCase().includes(needle);
    });
  }, [items, filter, query]);

  const toggle = async (item) => {
    if (openId === item.importId) { setOpenId(null); return; }
    setOpenId(item.importId);
    setProblemsOnly(item.failed > 0);
    if (reports[item.importId]?.rows) return;
    setReports((current) => ({ ...current, [item.importId]: "loading" }));
    try {
      const { data } = await axios.get(`${apiUrl}/api/students/bulk/history/${item.importId}`, { headers: headers() });
      setReports((current) => ({ ...current, [item.importId]: { rows: data.rows || [], truncated: data.truncated } }));
    } catch (err) {
      setReports((current) => ({ ...current, [item.importId]: { error: messageOf(err, "The report could not be loaded.") } }));
    }
  };

  const downloadProblems = (item, rows) => {
    const base = (item.fileName || "import").replace(/\.[^.]+$/, "");
    downloadCsv(`${base}-not-added.csv`, [["Roll number", "Name", "Email", "Reason"], ...rows.filter((r) => r.status === "failed").map((r) => [r.rollNumber, r.name, r.email, r.message])]);
  };

  return (
    <section className="enh imh" aria-labelledby="imh-title">
      <header className="enh-head">
        <div>
          <h2 id="imh-title">Import history</h2>
          <p>Every import is kept here: who ran it, when, which file, and what happened to each student.</p>
        </div>
        <button type="button" className="enh-refresh" onClick={load}>Refresh</button>
      </header>

      {items && items.length > 0 && (
        <>
          <div className="enh-stats imh-stats">
            <div><span>Recent imports</span><strong>{totals.imports}</strong></div>
            <div><span>Students added</span><strong>{totals.added}</strong></div>
            <div className={totals.attention ? "is-warn" : ""}><span>Had problems</span><strong>{totals.attention}</strong></div>
          </div>
          <div className="enh-tools">
            <div className="enh-filters" role="group" aria-label="Show">
              {[["all", "All"], ["attention", "Had problems"]].map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? "is-on" : ""} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
              ))}
            </div>
            <input id="imh-search" className="imh-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search file or person" aria-label="Search imports" />
          </div>
        </>
      )}

      {error && <p className="enh-error" role="alert">{error}</p>}
      {items === null ? (
        <div className="enh-skeleton" aria-busy="true"><span /><span /><span /></div>
      ) : items.length === 0 ? (
        <p className="enh-empty">Nothing has been imported yet. Each file you import appears here.</p>
      ) : shown.length === 0 ? (
        <p className="enh-empty">No import matches that.</p>
      ) : (
        <Refreshing active={refreshing}>
          <ul className="enh-list">
            {shown.map((item) => {
              const open = openId === item.importId;
              const report = reports[item.importId];
              const outcome = outcomeOf(item);
              const rows = report?.rows || [];
              const visibleRows = problemsOnly ? rows.filter((r) => r.status === "failed") : rows;
              return (
                <li key={item.importId} className={`enh-item ${open ? "is-open" : ""}`}>
                  <button type="button" className="enh-row imh-row" onClick={() => toggle(item)} aria-expanded={open}>
                    <span className="enh-main">
                      <strong>{item.fileName || "Imported file"}</strong>
                      <small>{item.rowsInFile} {item.rowsInFile === 1 ? "row" : "rows"} in the file</small>
                    </span>
                    <span className="enh-who">
                      <span>{item.by?.name || "Unknown"}</span>
                      <small>{when(item.createdAt)}</small>
                    </span>
                    <span className="enh-result">
                      <span className={`enh-pill ${outcome.tone}`}>{outcome.label}</span>
                      <small>{resultText(item)}</small>
                    </span>
                    <svg className="enh-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={open ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
                  </button>
                  {open && (
                    <div className="enh-report">
                      {report === "loading" || !report ? <Loading variant="table" rows={4} label="Loading the report" />
                        : report.error ? <p className="enh-error imh-inline-error" role="alert">{report.error}</p>
                        : (
                          <>
                            {item.failed > 0 && (
                              <div className="imh-report-tools">
                                <label className="imh-check">
                                  <input type="checkbox" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
                                  Show only the {item.failed} not added
                                </label>
                                <button type="button" className="enh-refresh" onClick={() => downloadProblems(item, rows)}>Download not-added rows (CSV)</button>
                              </div>
                            )}
                            <div className="enh-table imh-table">
                              <table>
                                <thead><tr><th>Roll number</th><th>Name</th><th>Email</th><th>Result</th><th>Details</th></tr></thead>
                                <tbody>
                                  {visibleRows.map((row, index) => (
                                    <tr key={`${row.rollNumber}-${index}`}>
                                      <td>{row.rollNumber ?? "–"}</td>
                                      <td>{row.name || "–"}</td>
                                      <td>{row.email || "–"}</td>
                                      <td><span className={`enh-tag ${row.status === "created" ? "ok" : "bad"}`}>{row.status === "created" ? "Added" : "Not added"}</span></td>
                                      <td>{row.message || ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {report.truncated && <p className="enh-error imh-inline-error">This import was very large, so only the first rows are kept in the history.</p>}
                          </>
                        )}
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

export default ImportHistory;
