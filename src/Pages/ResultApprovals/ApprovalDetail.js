import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BackIcon, LockIcon, AlertIcon, Svg, fmt, dateTimeText, STATE_LABEL, STATE_TONE, messageOf } from "./shared";

const API = process.env.REACT_APP_BACKEND_URL;
const SPECIAL = { I: "Incomplete", W: "Withdrawn" };

const upgradeLabel = (generation) => {
  const scheme = generation?.scheme;
  if (scheme?.type === "ADD_MARKS") return `+${fmt(scheme.marks)} marks`;
  if (scheme?.type === "TARGET_AVERAGE") return `to average ${fmt(scheme.target)}`;
  if (scheme?.type === "MULTIPLY") return `× ${fmt(scheme.factor)}`;
  return "applied";
};

// One plain line saying where this stands, in place of a progress bar and a banner.
const statusLine = (batch, amendedCount = 0) => {
  const when = (state) => { const h = (batch.history || []).filter((x) => x.state === state).pop(); return h ? dateTimeText(h.at) : ""; };
  switch (batch.state) {
    case "SUBMITTED": return `Submitted ${when("SUBMITTED")} · waiting for your review`;
    case "UNDER_REVIEW": return "Under review · approve it into the record, or return it to the teacher";
    case "APPROVED": return `Approved ${when("APPROVED")} · on record, not yet visible to students`;
    case "PUBLISHED": return `Published ${when("PUBLISHED")} · students can see their grades on the transcript`;
    case "AMENDED": return `Published · ${amendedCount} result${amendedCount === 1 ? "" : "s"} amended since, each with a reason on record`;
    default: return "";
  }
};

const csvCell = (value) => { const text = value === null || value === undefined ? "" : String(value); return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
const downloadCsv = (batch, rows) => {
  const { columns, hasUpgrade } = batch.sheet;
  const head = ["Roll no", "Name", ...columns.map((c) => `${c.label}${c.weight ? ` (/${c.weight})` : ""}`), "Entered total", ...(hasUpgrade ? ["Upgrade"] : []), "Total", "Grade"];
  const lines = [head, ...rows.map((r) => [r.rollNumber, r.name, ...columns.map((c) => r.parts[c.key]), r.entered, ...(hasUpgrade ? [r.upgrade] : []), r.total, r.grade])];
  const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${batch.course?.code || "results"}-${batch.sectionName || "section"}-results.csv`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};

const ApprovalDetail = ({ sectionId, queue = [], onOpen, onBack, onChanged }) => {
  const base = `${API}/api/result-batches/section/${sectionId}`;
  const [batch, setBatch] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);              // return | approve | publish
  const [reason, setReason] = useState("");
  const [decisions, setDecisions] = useState({});        // registrationId -> { grade, reason }
  const [showReason, setShowReason] = useState(false);
  const [amending, setAmending] = useState(null);       // the row being corrected
  const [amendForm, setAmendForm] = useState({ mode: "total", total: "", reason: "" });
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");           // all | upgraded | failing | nomarks
  const [sort, setSort] = useState({ key: "roll", dir: 1 });

  const load = useCallback(async () => {
    try { setLoadError(""); const { data } = await axios.get(base); setBatch(data); } catch (err) { setLoadError(messageOf(err)); }
  }, [base]);
  useEffect(() => { setBatch(null); setDecisions({}); setSearch(""); setFilter("all"); setShowReason(false); setAmending(null); setNotice(""); setSort({ key: "roll", dir: 1 }); load(); }, [load]);

  const act = async (work) => {
    setBusy(true); setError("");
    try { await work(); await load(); onChanged?.(); return true; } catch (err) { setError(messageOf(err)); return false; } finally { setBusy(false); }
  };

  const sheet = batch?.sheet;
  const rows = useMemo(() => sheet?.rows || [], [sheet]);
  const state = batch?.state;
  const canDecide = state === "SUBMITTED" || state === "UNDER_REVIEW";
  const pending = useMemo(() => rows.filter((r) => r.noMarks && !["I", "W"].includes(r.grade)), [rows]);   // no marks, not yet recorded
  const decisionOf = (r) => decisions[r.registrationId] || { grade: "I", reason: "" };
  const decisionsReady = !canDecide || pending.every((r) => decisionOf(r).reason.trim().length >= 5);
  const passing = sheet?.passingGradePoints ?? 1;
  const isFailing = (r) => !r.noMarks && r.gradePoints !== null && r.gradePoints < passing;

  const counts = useMemo(() => ({
    all: rows.length,
    upgraded: rows.filter((r) => r.upgrade > 0).length,
    failing: rows.filter((r) => !r.noMarks && r.gradePoints !== null && r.gradePoints < passing).length,
    nomarks: rows.filter((r) => r.noMarks).length,
  }), [rows, passing]);

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const keep = rows.filter((r) => {
      if (filter === "upgraded" && !(r.upgrade > 0)) return false;
      if (filter === "failing" && !(!r.noMarks && r.gradePoints !== null && r.gradePoints < passing)) return false;
      if (filter === "nomarks" && !r.noMarks) return false;
      return !needle || `${r.name} ${r.rollNumber}`.toLowerCase().includes(needle);
    });
    const by = { roll: (a, b) => String(a.rollNumber).localeCompare(String(b.rollNumber), undefined, { numeric: true }), name: (a, b) => String(a.name).localeCompare(String(b.name)), total: (a, b) => (a.total ?? -1) - (b.total ?? -1) }[sort.key];
    return [...keep].sort((a, b) => by(a, b) * sort.dir);
  }, [rows, search, filter, sort, passing]);

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === "total" ? -1 : 1 }));
  const ariaSort = (key) => (sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none");
  const arrow = (key) => (sort.key === key ? (sort.dir === 1 ? " ↑" : " ↓") : "");

  const closeModal = () => { if (!busy) { setModal(null); setReason(""); setError(""); } };
  const doReview = () => act(() => axios.post(`${base}/review`, {}));
  const doReturn = async () => { if (await act(() => axios.post(`${base}/return`, { reason: reason.trim() }))) { setModal(null); setReason(""); } };
  const doApprove = async () => {
    const nonNumeric = pending.map((r) => ({ registrationId: r.registrationId, grade: decisionOf(r).grade, reason: decisionOf(r).reason.trim() }));
    if (await act(() => axios.post(`${base}/approve`, { nonNumeric }))) setModal(null);
  };
  const isPublished = state === "PUBLISHED" || state === "AMENDED";
  const openAmend = (row) => { setError(""); setNotice(""); setAmending(row); setAmendForm({ mode: "total", total: row.total === null || row.total === undefined ? "" : String(row.total), reason: "" }); };
  const gradeFor = (total) => {
    const value = Number(total);
    if (amendForm.mode !== "total") return amendForm.mode;
    if (amendForm.total === "" || !Number.isFinite(value) || value < 0 || value > 100) return null;
    return ((sheet?.bands || []).find((b) => value >= b.minPercentage) || {}).grade || null;
  };
  const amendTotalOk = amendForm.mode !== "total" || (amendForm.total !== "" && Number.isFinite(Number(amendForm.total)) && Number(amendForm.total) >= 0 && Number(amendForm.total) <= 100);
  const newGrade = amending ? gradeFor(amendForm.total) : null;
  const unchanged = amending && newGrade !== null && newGrade === amending.grade && (amendForm.mode !== "total" || Number(amendForm.total) === amending.total);
  const amendReady = amending && amendTotalOk && amendForm.reason.trim().length >= 5 && !unchanged && !busy;
  const doAmend = async () => {
    const body = { registrationId: amending.registrationId, reason: amendForm.reason.trim(), ...(amendForm.mode === "total" ? { finalPercentage: Number(amendForm.total) } : { grade: amendForm.mode }) };
    if (await act(() => axios.post(`${base}/amend`, body))) { setNotice(`Result amended for ${amending.name}. The transcript now shows ${newGrade}.`); setAmending(null); }
  };
  const doPublish = async () => { if (await act(() => axios.post(`${base}/publish`, {}))) setModal(null); };

  const position = queue.indexOf(sectionId);
  const prevId = position > 0 ? queue[position - 1] : null;
  const nextId = position >= 0 && position < queue.length - 1 ? queue[position + 1] : null;

  if (loadError) return <div className="ra-page"><button type="button" className="ra-back" onClick={onBack}><BackIcon /> All approvals</button><div className="ra-error" role="alert">{loadError} <button type="button" className="ra-link" onClick={load}>Try again</button></div></div>;
  if (!batch) return <div className="ra-page"><div className="ra-skeletons" aria-busy="true"><div className="ra-skel" /><div className="ra-skel" /><div className="ra-skel" /></div></div>;

  const weightsBad = batch.readiness && !batch.readiness.weights.ready;
  const stats = sheet?.stats;
  const columns = sheet?.columns || [];
  const partCount = columns.length;
  const meta = [batch.program?.name, batch.term, batch.teachers?.length ? batch.teachers.join(", ") : null].filter(Boolean).join(" · ");
  const workflowOn = batch.workflowEnabled !== false;
  const blockedApprove = busy || !workflowOn || !decisionsReady || weightsBad || batch.stale;
  const spread = stats ? stats.distribution.grades.filter((g) => stats.distribution.counts[g] > 0).map((g) => `${g} ${stats.distribution.counts[g]}`).join(" · ") : "";
  const noticeText = canDecide && pending.length > 0
    ? (decisionsReady ? `${pending.length} student${pending.length === 1 ? " has" : "s have"} no marks and will be recorded as chosen below.` : `${pending.length} student${pending.length === 1 ? " has" : "s have"} no marks. Choose how to record each one, with a reason, in the sheet below. This is needed before you can approve.`)
    : null;

  return (
    <div className="ra-page ra-detail">
      <div className="ra-detail-top">
        <button type="button" className="ra-back" onClick={onBack}><BackIcon /> All approvals</button>
        {queue.length > 1 && position >= 0 && (
          <div className="ra-pager" aria-label="Move between sections in this list">
            <button type="button" className="ra-btn ra-btn-sm" onClick={() => onOpen(prevId)} disabled={!prevId || busy}>‹ Previous</button>
            <span>{position + 1} of {queue.length}</span>
            <button type="button" className="ra-btn ra-btn-sm" onClick={() => onOpen(nextId)} disabled={!nextId || busy}>Next ›</button>
          </div>
        )}
      </div>

      <header className="ra-bar">
        <div className="ra-bar-main">
          <div className="ra-bar-title">
            <h1>{batch.course?.code ? `${batch.course.code} ${batch.course.name}` : "Section results"}{batch.sectionName ? <span> Section {batch.sectionName}</span> : null}</h1>
            {meta && <p className="ra-sub">{meta}</p>}
          </div>
          <div className="ra-bar-side">
            <span className={`ra-state ${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>
            {state !== "PUBLISHED" && state !== "AMENDED" && (
              <div className="ra-head-actions">
                {canDecide && <button type="button" className="ra-btn" onClick={() => { setError(""); setModal("return"); }} disabled={busy || !workflowOn}>Return to teacher</button>}
                {state === "SUBMITTED" && <button type="button" className="ra-btn" onClick={doReview} disabled={busy || !workflowOn}>Start review</button>}
                {canDecide && <button type="button" className="ra-btn ra-btn-primary" onClick={() => { setError(""); setModal("approve"); }} disabled={blockedApprove}>Approve</button>}
                {state === "APPROVED" && <button type="button" className="ra-btn ra-btn-primary" onClick={() => { setError(""); setModal("publish"); }} disabled={busy || !workflowOn}>Publish to students</button>}
              </div>
            )}
          </div>
        </div>
        <p className="ra-status-line">{statusLine(batch, rows.filter((r) => r.amended).length)}</p>
      </header>

      {!workflowOn && <div className="ra-banner info" role="status"><AlertIcon /><p><strong>Results processing isn't switched on yet.</strong> You can look at this result, but returning, approving and publishing will work once a system administrator turns it on.</p></div>}
      {notice && <div className="ra-banner ok" role="status"><LockIcon /><p>{notice}</p></div>}
      {error && !modal && !amending && <div className="ra-error" role="alert">{error}</div>}
      {weightsBad && <div className="ra-banner warn" role="alert"><AlertIcon /><p>The regular weightage is {fmt(batch.readiness.weights.regularWeight)}%, not 100%, so these results cannot be approved. Return them to the teacher to fix it.</p></div>}
      {batch.stale && canDecide && <div className="ra-banner warn" role="alert"><AlertIcon /><p>The marks no longer match what the teacher submitted. Return the section so the grading can be generated again.</p></div>}

      {stats && (
        <section className="ra-panel ra-strip" aria-label="Overall result of this section">
          <div className="ra-strip-row">
            <div className="ra-strip-stat"><span>Students</span><strong>{stats.students}</strong></div>
            <div className="ra-strip-stat"><span>Average</span><strong>{fmt(stats.average)}</strong></div>
            <div className="ra-strip-stat"><span>Highest</span><strong>{fmt(stats.highest)}</strong></div>
            <div className="ra-strip-stat"><span>Lowest</span><strong>{fmt(stats.lowest)}</strong></div>
            <div className="ra-strip-stat"><span>Pass rate</span><strong>{stats.passRate === null ? "–" : `${stats.passRate}%`}</strong></div>
            <div className="ra-strip-upgrade">
              {sheet.hasUpgrade
                ? <button type="button" className="ra-upgrade-chip" onClick={() => setShowReason((v) => !v)} aria-expanded={showReason}>Upgrade {upgradeLabel(batch.generation)} <i aria-hidden="true">{showReason ? "▴" : "▾"}</i></button>
                : <span className="ra-muted">No upgrade</span>}
            </div>
          </div>
          {spread && <p className="ra-spreadline" aria-label="Number of students at each grade">{spread}</p>}
          {showReason && sheet.hasUpgrade && (
            <div className="ra-reason-box">
              <p><b>{batch.generation?.description}</b> · {stats.upgraded} of {stats.students} students received marks.</p>
              {batch.generation?.reason && <blockquote className="ra-reason"><span>Reason given by the teacher</span>{batch.generation.reason}</blockquote>}
              <p className="ra-private"><LockIcon /> Students never see upgrades, only their final grade on the transcript.</p>
            </div>
          )}
        </section>
      )}

      <section className="ra-panel ra-sheet-panel">
        <div className="ra-sheet-head">
          <h2>Result sheet <span className="ra-count">{rows.length}</span></h2>
          <div className="ra-sheet-tools">
            <label className="ra-search">
              <Svg size={16}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a student" aria-label="Find a student by name or roll number" />
            </label>
            <button type="button" className="ra-btn ra-btn-sm" onClick={() => downloadCsv(batch, shown)} disabled={!rows.length}>Download CSV</button>
          </div>
        </div>
        {(counts.upgraded > 0 || counts.failing > 0 || counts.nomarks > 0) && (
          <div className="ra-chips" role="group" aria-label="Filter students">
            {[["all", "All"], ["upgraded", "Upgraded"], ["failing", "Not passing"], ["nomarks", "No marks"]].filter(([k]) => k === "all" || counts[k] > 0).map(([k, label]) => (
              <button key={k} type="button" className={`ra-chipbtn ${filter === k ? "is-active" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}<span>{counts[k]}</span></button>
            ))}
          </div>
        )}
        {noticeText && <p className={`ra-notice ${decisionsReady ? "" : "needs"}`} role="status"><AlertIcon />{noticeText}</p>}

        {rows.length === 0 ? <p className="ra-muted">This section has no students.</p> : shown.length === 0 ? <p className="ra-muted ra-nomatch">No student matches.</p> : (
          <div className={`ra-table ${sheet.hasUpgrade ? "has-upgrade" : ""} ${isPublished && workflowOn ? "can-amend" : ""}`} role="table" aria-label="Class result sheet" style={{ "--parts": partCount }}>
            <div className="ra-row ra-thead" role="row">
              <span role="columnheader" className="idx">#</span>
              <button type="button" role="columnheader" aria-sort={ariaSort("roll")} className="sortable roll" onClick={() => toggleSort("roll")}>Roll no{arrow("roll")}</button>
              <button type="button" role="columnheader" aria-sort={ariaSort("name")} className="sortable" onClick={() => toggleSort("name")}>Name{arrow("name")}</button>
              {columns.map((c) => <span role="columnheader" className="num" key={c.key}>{c.label}{c.weight ? <small>/{fmt(c.weight)}</small> : null}</span>)}
              {sheet.hasUpgrade && <span role="columnheader" className="num">Upgrade</span>}
              <button type="button" role="columnheader" aria-sort={ariaSort("total")} className="sortable num" onClick={() => toggleSort("total")}>Total<small>/100</small>{arrow("total")}</button>
              <span role="columnheader" className="grade">Grade</span>
            </div>
            {shown.map((r, i) => {
              const undecided = canDecide && r.noMarks && !["I", "W"].includes(r.grade);
              const d = decisionOf(r);
              const failing = isFailing(r);
              return (
                <div className={`ra-row ${r.upgrade > 0 ? "changed" : ""} ${failing ? "failing" : ""} ${r.amended ? "amended" : ""}`} role="row" key={r.registrationId}>
                  <span role="cell" className="idx">{i + 1}</span>
                  <span role="cell" className="roll">{r.rollNumber}</span>
                  <span role="cell" className="name"><strong>{r.name}</strong><small className="roll-inline">{r.rollNumber}</small>
                    {r.amended && <span className="ra-amended-tag" title={`Was ${r.amended.fromGrade}${r.amended.fromTotal !== null && r.amended.fromTotal !== undefined ? ` (${fmt(r.amended.fromTotal)})` : ""}. ${r.amended.reason}`}>Amended · was {r.amended.fromGrade}{r.amended.fromTotal !== null && r.amended.fromTotal !== undefined ? ` (${fmt(r.amended.fromTotal)})` : ""}</span>}
                  </span>
                  {r.noMarks ? (
                    <span role="cell" className="ra-nomarks-cell" style={{ gridColumn: `span ${partCount + (sheet.hasUpgrade ? 1 : 0) + 1}` }}>
                      {undecided ? (
                        <span className="ra-inline-decision">
                          <span className="ra-muted">No marks. Record as</span>
                          <select aria-label={`Record ${r.name} as`} value={d.grade} onChange={(e) => setDecisions({ ...decisions, [r.registrationId]: { ...d, grade: e.target.value } })}>
                            {Object.entries(SPECIAL).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
                          </select>
                          <input aria-label={`Reason for ${r.name}`} value={d.reason} maxLength={500} onChange={(e) => setDecisions({ ...decisions, [r.registrationId]: { ...d, reason: e.target.value } })} placeholder="Reason, kept on record" />
                        </span>
                      ) : "No marks entered"}
                    </span>
                  ) : columns.map((c) => <span role="cell" className="num part" data-label={c.label} key={c.key}>{fmt(r.parts[c.key])}</span>)}
                  {sheet.hasUpgrade && !r.noMarks && <span role="cell" className="num" data-label="Upgrade">{r.upgrade > 0 ? <b className="ra-added">+{fmt(r.upgrade)}</b> : <span className="ra-muted">–</span>}</span>}
                  {!r.noMarks && <span role="cell" className="num total" data-label="Total">{fmt(r.total)}</span>}
                  <span role="cell" className="grade" data-label="Grade">
                    {isPublished && workflowOn && <button type="button" className="ra-amend-btn" onClick={() => openAmend(r)} aria-label={`Amend the result of ${r.name}`}>Amend</button>}
                    <span className={`ra-letter ${failing ? "fail" : ""} ${r.noMarks ? "special" : ""}`}>{r.noMarks ? (undecided ? d.grade : r.grade || "–") : r.grade}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        <p className="ra-table-foot">Each column shows marks earned out of its weight. Missing marks count as zero.{shown.length !== rows.length ? ` Showing ${shown.length} of ${rows.length}.` : ""}</p>
      </section>

      <details className="ra-history-box">
        <summary>History <span className="ra-count">{(batch.history || []).length}</span></summary>
        <ol className="ra-history">
          {(batch.history || []).slice().reverse().map((h, i) => (
            <li key={`${h.state}-${h.at}-${i}`}><span className={`ra-state ${STATE_TONE[h.state]}`}>{STATE_LABEL[h.state]}</span><span>{h.note || ""}</span><time>{dateTimeText(h.at)}</time></li>
          ))}
        </ol>
      </details>

      {amending && (
        <div className="ra-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setAmending(null); }}>
          <div className="ra-modal ra-amend" role="dialog" aria-modal="true" aria-labelledby="ra-amend-title">
            <h3 id="ra-amend-title">Amend a published result</h3>
            <p className="ra-amend-who"><strong>{amending.name}</strong> · {amending.rollNumber}</p>
            <div className="ra-amend-now"><span>Now</span><strong>{amending.noMarks ? "No total" : `Total ${fmt(amending.total)}`}</strong><b className="ra-letter">{amending.grade}</b></div>

            <fieldset className="ra-amend-modes">
              <legend>Change it to</legend>
              <label className={amendForm.mode === "total" ? "is-on" : ""}><input type="radio" name="amend-mode" checked={amendForm.mode === "total"} onChange={() => setAmendForm({ ...amendForm, mode: "total" })} /><span>A corrected total</span></label>
              <label className={amendForm.mode === "I" ? "is-on" : ""}><input type="radio" name="amend-mode" checked={amendForm.mode === "I"} onChange={() => setAmendForm({ ...amendForm, mode: "I" })} /><span>Incomplete (I)</span></label>
              <label className={amendForm.mode === "W" ? "is-on" : ""}><input type="radio" name="amend-mode" checked={amendForm.mode === "W"} onChange={() => setAmendForm({ ...amendForm, mode: "W" })} /><span>Withdrawn (W)</span></label>
            </fieldset>

            {amendForm.mode === "total" && (
              <label className="ra-field"><span>Corrected total (out of 100)</span>
                <input type="number" inputMode="decimal" min="0" max="100" step="0.01" value={amendForm.total} onChange={(e) => setAmendForm({ ...amendForm, total: e.target.value })} aria-invalid={!amendTotalOk} />
              </label>
            )}
            {amendForm.mode === "total" && amendForm.total !== "" && !amendTotalOk && <p className="ra-problem" role="alert">The total must be a number from 0 to 100.</p>}
            {newGrade && !unchanged && <p className="ra-amend-result">The new grade will be <b className="ra-letter up">{newGrade}</b></p>}
            {unchanged && <p className="ra-problem" role="alert">That is the same as the current result, so there is nothing to change.</p>}

            <label className="ra-field"><span>Why is this being changed? <em>(kept on record)</em></span>
              <textarea rows={3} maxLength={500} value={amendForm.reason} onChange={(e) => setAmendForm({ ...amendForm, reason: e.target.value })} placeholder="For example: the midterm was added up wrongly" />
            </label>
            <p className="ra-amend-note"><LockIcon /> The original result stays on record. The student's transcript shows the new grade straight away.</p>
            {error && <div className="ra-error" role="alert">{error}</div>}
            <div className="ra-modal-buttons">
              <button type="button" className="ra-btn" onClick={() => setAmending(null)} disabled={busy}>Cancel</button>
              <button type="button" className="ra-btn ra-btn-primary" onClick={doAmend} disabled={!amendReady}>{busy ? "Amending…" : "Amend result"}</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="ra-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="ra-modal" role="dialog" aria-modal="true" aria-labelledby="ra-modal-title">
            {modal === "return" && (
              <>
                <h3 id="ra-modal-title">Return to the teacher</h3>
                <p>The teacher can edit marks again and submit once more. Say what needs fixing.</p>
                <label className="ra-field"><span>Reason</span><textarea rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="For example: please re-check the Midterm marks" /></label>
              </>
            )}
            {modal === "approve" && (
              <>
                <h3 id="ra-modal-title">Approve this class result?</h3>
                <ul className="ra-modal-list">
                  <li>{rows.length} result{rows.length === 1 ? "" : "s"} are written to the permanent record{pending.length ? `, including ${pending.length} recorded as ${[...new Set(pending.map((r) => decisionOf(r).grade))].join("/")}` : ""}.</li>
                  <li>The grading scale is frozen, so its ranges can no longer be edited.</li>
                  <li>Students still see nothing until you publish.</li>
                </ul>
              </>
            )}
            {modal === "publish" && (
              <>
                <h3 id="ra-modal-title">Publish to students?</h3>
                <ul className="ra-modal-list">
                  <li>Students will see their grades on their transcript straight away.</li>
                  <li>Grades then count toward prerequisites and enrolment.</li>
                  <li>They will not see any upgrade, only the final grade.</li>
                </ul>
              </>
            )}
            {error && <div className="ra-error" role="alert">{error}</div>}
            <div className="ra-modal-buttons">
              <button type="button" className="ra-btn" onClick={closeModal} disabled={busy}>Cancel</button>
              {modal === "return" && <button type="button" className="ra-btn ra-btn-primary" onClick={doReturn} disabled={busy || reason.trim().length < 5}>{busy ? "Returning…" : "Return"}</button>}
              {modal === "approve" && <button type="button" className="ra-btn ra-btn-primary" onClick={doApprove} disabled={busy}>{busy ? "Approving…" : "Approve"}</button>}
              {modal === "publish" && <button type="button" className="ra-btn ra-btn-primary" onClick={doPublish} disabled={busy}>{busy ? "Publishing…" : "Publish"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalDetail;
