import React, { useCallback, useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import Loading, { BusyLabel } from "../../Components/Loading/Loading";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { messageOf } from "../../utils/apiMessage";
import { listChanges, downloadChangesCsv, dateTime } from "./enrollmentApi";

const TYPES = [["", "All changes"], ["added", "Added"], ["dropped", "Dropped"], ["mistake", "Removed by mistake"], ["section", "Section changed"], ["restored", "Restored"]];
const TONE = { "enrollment.added": "is-good", "enrollment.restored": "is-good", "enrollment.dropped": "is-bad", "enrollment.removed_by_mistake": "is-bad", "enrollment.upload_undone": "is-bad", "enrollment.section_changed": "is-info" };

// Every enrollment change, newest first: who changed what, for whom, and why. Filter, page through, or download.
const ChangeLog = ({ onOpenStudent }) => {
  const [filters, setFilters] = useState({ type: "", from: "", to: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const params = { ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), page, limit: 25 };
  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    try {
      setError("");
      setData(await listChanges(JSON.parse(key)));
    } catch (err) {
      setError(messageOf(err, "Could not load the change log."));
      setData((current) => current || { items: [], total: 0, pages: 1 });
    }
  }, [key]);
  useEffect(() => { load(); }, [load]);

  const setFilter = (name, value) => { setFilters((f) => ({ ...f, [name]: value })); setPage(1); };
  const download = async () => {
    try {
      setDownloading(true);
      const { page: _p, limit: _l, ...rest } = params;
      await downloadChangesCsv(rest);
      showToast("Change log downloaded", TOAST_TYPES.SUCCESS);
    } catch (err) {
      showToast(messageOf(err, "Could not download the change log."), TOAST_TYPES.ERROR);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="me-card me-log">
      <header className="me-card-head">
        <div>
          <h3>Change log</h3>
          <p>Every add, drop, section change and correction, with who made it and why. Entries can't be edited or deleted.</p>
        </div>
        <button type="button" className="sp-btn" onClick={download} disabled={downloading || !data?.total}><FiDownload aria-hidden="true" /> <BusyLabel busy={downloading} busyText="Preparing…" idle="Download CSV" /></button>
      </header>

      <div className="me-log-filters">
        <select aria-label="Type of change" value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label><span>From</span><input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} /></label>
        <label><span>To</span><input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} /></label>
        {(filters.type || filters.from || filters.to) && <button type="button" className="spp-clear" onClick={() => { setFilters({ type: "", from: "", to: "" }); setPage(1); }}>Clear</button>}
        {data && <span className="me-log-count">{data.total} {data.total === 1 ? "entry" : "entries"}</span>}
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}
      {data === null ? <Loading variant="table" rows={6} label="Loading the change log" />
        : data.items.length === 0 ? (
          <div className="me-empty"><strong>No changes yet</strong><span>{filters.type || filters.from || filters.to ? "Nothing matches these filters." : "Changes made in Manage Enrollment appear here."}</span></div>
        ) : (
          <>
            <div className="spp-table-wrap">
              <table className="spp-table me-log-table">
                <thead><tr><th>When</th><th>Change</th><th>Student</th><th>Course</th><th>Section</th><th>Reason</th><th>By</th></tr></thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id}>
                      <td className="me-nowrap">{dateTime(row.at)}</td>
                      <td><span className={`me-tag ${TONE[row.action] || "is-muted"}`}>{row.label}{row.removedCount !== null ? ` (${row.removedCount})` : ""}</span></td>
                      <td>
                        {row.student ? (
                          <button type="button" className="me-student-link" onClick={() => onOpenStudent(row.student.id)}>
                            <span className="spp-name">{row.student.name}</span>
                            <span className="spp-email">{row.student.rollNumber}</span>
                          </button>
                        ) : <span className="me-muted">{row.fileName ? `Upload · ${row.fileName}` : "—"}</span>}
                      </td>
                      <td>{row.course ? <><span className="me-code me-code-small">{row.course.code}</span> {row.course.name}</> : "—"}</td>
                      <td className="me-nowrap">{row.fromSection && row.toSection ? `${row.fromSection} → ${row.toSection}` : row.toSection || row.fromSection || "—"}</td>
                      <td className="me-reason-cell">{row.reason || "—"}</td>
                      <td className="me-nowrap">{row.by || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.pages > 1 && (
              <div className="me-pager">
                <button type="button" className="am-btn am-btn-small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>Page {data.page} of {data.pages}</span>
                <button type="button" className="am-btn am-btn-small" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
    </section>
  );
};

export default ChangeLog;
