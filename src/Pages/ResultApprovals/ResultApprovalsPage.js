import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import ApprovalDetail from "./ApprovalDetail";
import { Svg, CheckIcon, fmt, dateText, STATE_LABEL, STATE_TONE } from "./shared";
import "./ResultApprovals.css";

const API = process.env.REACT_APP_BACKEND_URL;

const TABS = [
  { id: "review", label: "To review", states: ["SUBMITTED", "UNDER_REVIEW"], empty: "Nothing is waiting for review. When a teacher submits a section, it appears here." },
  { id: "publish", label: "Ready to publish", states: ["APPROVED"], empty: "Nothing is approved and waiting. Approved sections appear here until you publish them to students." },
  { id: "published", label: "Published", states: ["PUBLISHED", "AMENDED"], empty: "No results have been published yet." },
  { id: "all", label: "All", states: null, empty: "No section has been submitted yet." },
];
const countFor = (tab, counts) => (tab.states ? tab.states : Object.keys(counts)).reduce((n, s) => n + (counts[s] || 0), 0);
const ACTION = { SUBMITTED: "Review", UNDER_REVIEW: "Review", APPROVED: "Publish", PUBLISHED: "View", AMENDED: "View" };

const Empty = ({ children }) => <div className="ra-empty"><span className="ra-empty-icon"><CheckIcon size={20} /></span><p>{children}</p></div>;

// Where an administrator turns submitted results into the record: review what the teacher chose, approve (the freeze
// point), then publish to students. Students see nothing until publication, and never see an upgrade.
const ResultApprovalsPage = () => {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("review");
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [programId, setProgramId] = useState("all");
  const selected = params.get("section");

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await axios.get(`${API}/api/result-batches`);
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the submitted results.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = TABS.find((t) => t.id === tab);
  const programs = useMemo(() => {
    const seen = new Map();
    for (const item of items) { const key = item.program ? String(item.program.id) : "none"; if (!seen.has(key)) seen.set(key, item.program ? item.program.name : "Program not set"); }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (current.states && !current.states.includes(item.state)) return false;
      if (programId !== "all" && (item.program ? String(item.program.id) : "none") !== programId) return false;
      if (!needle) return true;
      return `${item.course.code} ${item.course.name} ${item.section} ${(item.teachers || []).join(" ")} ${item.program?.name || ""}`.toLowerCase().includes(needle);
    });
  }, [items, current, query, programId]);
  // Program by program, then course and section, so a long list stays easy to scan.
  const groups = useMemo(() => {
    const byProgram = new Map();
    for (const item of shown) {
      const key = item.program ? String(item.program.id) : "none";
      if (!byProgram.has(key)) byProgram.set(key, { name: item.program ? item.program.name : "Program not set", code: item.program?.code || null, items: [] });
      byProgram.get(key).items.push(item);
    }
    for (const g of byProgram.values()) g.items.sort((a, b) => String(a.course.code).localeCompare(String(b.course.code), undefined, { numeric: true }) || String(a.section).localeCompare(String(b.section)));
    return [...byProgram.values()].sort((a, b) => (a.name === "Program not set") - (b.name === "Program not set") || a.name.localeCompare(b.name));
  }, [shown]);
  const queue = useMemo(() => groups.flatMap((g) => g.items.map((i) => String(i.sectionId))), [groups]);

  const open = (sectionId) => setParams({ section: String(sectionId) });
  const close = () => { setParams({}); load(); };

  if (selected) return <ApprovalDetail sectionId={selected} queue={queue} onOpen={open} onBack={close} onChanged={load} />;

  return (
    <div className="ra-page">
      <header className="ra-header">
        <div className="ra-title">
          <span className="ra-icon"><CheckIcon size={20} /></span>
          <div>
            <h1>Result approvals</h1>
            <p>Review the results teachers submit, approve them into the record, then publish them to students.</p>
          </div>
        </div>
      </header>

      {error && <div className="ra-error" role="alert">{error} <button type="button" className="ra-link" onClick={load}>Try again</button></div>}

      <div className="ra-toolbar">
        <div className="ra-tabs" role="group" aria-label="Show">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`ra-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)} aria-pressed={tab === t.id}>
              {t.label}<span>{countFor(t, counts)}</span>
            </button>
          ))}
        </div>
        <div className="ra-filters">
          {programs.length > 1 && (
            <label className="ra-select">
              <span className="ra-sr">Program</span>
              <select value={programId} onChange={(e) => setProgramId(e.target.value)} aria-label="Filter by program">
                <option value="all">All programs</option>
                {programs.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
              </select>
            </label>
          )}
          <label className="ra-search">
          <Svg size={16}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search course, section or teacher" aria-label="Search submitted results" />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="ra-skeletons" aria-busy="true"><div className="ra-skel" /><div className="ra-skel" /><div className="ra-skel" /></div>
      ) : shown.length === 0 ? (
        <Empty>{query ? "No submitted section matches that search." : current.empty}</Empty>
      ) : (
        <div className="ra-groups">
          {groups.map((group) => {
            const waiting = group.items.filter((i) => i.state === "SUBMITTED" || i.state === "UNDER_REVIEW").length;
            return (
              <section key={group.name} className="ra-group" aria-label={group.name}>
                <h2 className="ra-group-head">
                  <span>{group.name}{group.code ? <em>{group.code}</em> : null}</span>
                  <small>{group.items.length} section{group.items.length === 1 ? "" : "s"}{waiting ? ` · ${waiting} to review` : ""}</small>
                </h2>
                <ul className="ra-list">
                  {group.items.map((item) => (
                    <li key={item.sectionId} className="ra-card">
                      <div className="ra-card-main">
                        <div className="ra-card-course">
                          <strong>{item.course.code} <span>{item.course.name}</span></strong>
                          <small>Section {item.section || "–"}{item.term ? ` · ${item.term}` : ""}{item.teachers?.length ? ` · ${item.teachers.join(", ")}` : ""}{item.otherPrograms?.length ? ` · also ${item.otherPrograms.map((p) => p.code || p.name).join(", ")}` : ""}</small>
                        </div>
                        <div className="ra-card-choice">
                          {item.classAverageAfter !== null && (
                            <span className="ra-metrics">
                              <b>{item.studentCount}</b> students<i aria-hidden="true">·</i>Average <b>{fmt(item.classAverageAfter)}</b><i aria-hidden="true">·</i>Pass rate <b>{item.gradedCount ? `${Math.round((item.passingAfter / item.gradedCount) * 100)}%` : "–"}</b>
                            </span>
                          )}
                          {item.upgraded && <span className="ra-chip up" title={item.description}>Upgrade applied</span>}
                        </div>
                        <div className="ra-card-side">
                          <span className={`ra-state ${STATE_TONE[item.state]}`}>{STATE_LABEL[item.state]}</span>
                          <small>{item.submittedAt ? `Submitted ${dateText(item.submittedAt)}` : ""}</small>
                        </div>
                        <button type="button" className={`ra-btn ${item.state === "SUBMITTED" || item.state === "UNDER_REVIEW" || item.state === "APPROVED" ? "ra-btn-primary" : ""}`} onClick={() => open(item.sectionId)}>{ACTION[item.state]}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ResultApprovalsPage;
