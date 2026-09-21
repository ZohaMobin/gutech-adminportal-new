import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BackIcon, CheckIcon, LockIcon, AlertIcon, fmt, dateTimeText, STATE_LABEL, STATE_TONE, messageOf } from "./shared";

const API = process.env.REACT_APP_BACKEND_URL;
const STEPS = ["Submitted", "Under review", "Approved", "Published"];
const STEP_OF = { SUBMITTED: 0, UNDER_REVIEW: 1, APPROVED: 2, PUBLISHED: 3, AMENDED: 3 };
const NEXT_INFO = {
  SUBMITTED: "The teacher has submitted these results. Start a review, or approve them directly if they look right.",
  UNDER_REVIEW: "You are reviewing these results. Approve them into the record, or return them to the teacher with a reason.",
  APPROVED: "Approved and on record. Students cannot see anything until you publish.",
  PUBLISHED: "Published. Students can see their grades on their transcript.",
  AMENDED: "Published, with an amendment on record.",
};
const SPECIAL = { I: "Incomplete", W: "Withdrawn" };

const Tile = ({ label, before, after, hint }) => (
  <div className="ra-tile">
    <span className="ra-tile-label">{label}</span>
    <strong>{after}</strong>
    {before !== undefined && before !== after && <span className="ra-tile-was">was {before}</span>}
    {hint && <span className="ra-tile-hint">{hint}</span>}
  </div>
);

const Distribution = ({ distribution }) => {
  if (!distribution) return null;
  const { grades, before, after } = distribution;
  const peak = Math.max(1, ...grades.map((g) => Math.max(before[g] || 0, after[g] || 0)));
  return (
    <div className="ra-dist" role="group" aria-label="Students at each grade, as entered and after grading">
      <div className="ra-dist-legend"><span><i className="before" />As entered</span><span><i className="after" />After grading</span></div>
      {grades.map((g) => (
        <div className="ra-dist-row" key={g}>
          <b>{g}</b>
          <div><span className="bar before" style={{ width: `${((before[g] || 0) / peak) * 100}%` }} /><span className="bar after" style={{ width: `${((after[g] || 0) / peak) * 100}%` }} /></div>
          <em>{before[g] || 0} → {after[g] || 0}</em>
        </div>
      ))}
    </div>
  );
};

const ApprovalDetail = ({ sectionId, onBack, onChanged }) => {
  const base = `${API}/api/result-batches/section/${sectionId}`;
  const [batch, setBatch] = useState(null);
  const [letters, setLetters] = useState(new Map());     // registrationId -> { before, after } (or the recorded letter)
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);              // return | approve | publish
  const [reason, setReason] = useState("");
  const [decisions, setDecisions] = useState({});        // registrationId -> { grade, reason }

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const { data } = await axios.get(base);
      setBatch(data);
      if (data.ledger) {
        setLetters(new Map(data.ledger.map((l) => [String(l.registrationId), { recorded: l.letterGrade }])));
      } else if (data.generation) {
        try {
          const preview = await axios.post(`${base}/preview`, { scheme: data.generation.scheme });
          setLetters(new Map(preview.data.rows.map((r) => [String(r.registrationId), { before: r.rawGrade?.grade, after: r.finalGrade?.grade }])));
        } catch { setLetters(new Map()); }
      }
    } catch (err) {
      setLoadError(messageOf(err));
    }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const act = async (work) => {
    setBusy(true); setError("");
    try { await work(); await load(); onChanged?.(); return true; } catch (err) { setError(messageOf(err)); return false; } finally { setBusy(false); }
  };

  const rows = batch?.generation?.rows || [];
  const noMarks = useMemo(() => rows.filter((r) => r.raw === null), [rows]);
  const decisionOf = (r) => decisions[r.registrationId] || { grade: "I", reason: "" };
  const decisionsReady = noMarks.every((r) => decisionOf(r).reason.trim().length >= 5);
  const summary = batch?.generation?.summary;
  const state = batch?.state;
  const canDecide = state === "SUBMITTED" || state === "UNDER_REVIEW";

  const closeModal = () => { if (!busy) { setModal(null); setReason(""); setError(""); } };
  const doReview = () => act(() => axios.post(`${base}/review`, {}));
  const doReturn = async () => { if (await act(() => axios.post(`${base}/return`, { reason: reason.trim() }))) { setModal(null); setReason(""); } };
  const doApprove = async () => {
    const nonNumeric = noMarks.map((r) => ({ registrationId: r.registrationId, grade: decisionOf(r).grade, reason: decisionOf(r).reason.trim() }));
    if (await act(() => axios.post(`${base}/approve`, { nonNumeric }))) setModal(null);
  };
  const doPublish = async () => { if (await act(() => axios.post(`${base}/publish`, {}))) setModal(null); };

  if (loadError) return <div className="ra-page"><button type="button" className="ra-back" onClick={onBack}><BackIcon /> All approvals</button><div className="ra-error" role="alert">{loadError} <button type="button" className="ra-link" onClick={load}>Try again</button></div></div>;
  if (!batch) return <div className="ra-page"><div className="ra-skeletons" aria-busy="true"><div className="ra-skel" /><div className="ra-skel" /><div className="ra-skel" /></div></div>;

  const at = STEP_OF[state] ?? 0;
  const weightsBad = batch.readiness && !batch.readiness.weights.ready;

  return (
    <div className="ra-page ra-detail">
      <button type="button" className="ra-back" onClick={onBack}><BackIcon /> All approvals</button>

      <header className="ra-detail-head">
        <div>
          <p className="ra-eyebrow">Result approval</p>
          <h1>{batch.course?.code ? `${batch.course.code} ${batch.course.name}` : "Section results"}{batch.sectionName ? <span> Section {batch.sectionName}</span> : null}</h1>
          <p className="ra-sub">{batch.generation?.description || "As entered (no upgrade)"}{batch.submittedAt ? ` · submitted ${dateTimeText(batch.submittedAt)}` : ""}</p>
        </div>
        <span className={`ra-state ${STATE_TONE[state]}`}>{STATE_LABEL[state]}</span>
      </header>

      <ol className="ra-steps" aria-label="Progress of these results">
        {STEPS.map((label, i) => (
          <li key={label} className={`${i < at ? "done" : ""} ${i === at ? "current" : ""}`} aria-current={i === at ? "step" : undefined}>
            <span className="ra-step-dot">{i < at || (i === at && at === 3) ? <CheckIcon size={12} /> : i + 1}</span><span className="ra-step-label">{label}</span>
          </li>
        ))}
      </ol>

      <div className={`ra-banner ${state === "PUBLISHED" || state === "AMENDED" ? "ok" : "info"}`} role="status">
        {state === "APPROVED" || state === "PUBLISHED" ? <LockIcon /> : <AlertIcon />}<p>{NEXT_INFO[state]}</p>
      </div>
      {weightsBad && <div className="ra-banner warn" role="alert"><AlertIcon /><p>The regular weightage is {fmt(batch.readiness.weights.regularWeight)}%, not 100%, so these results cannot be approved. Return them to the teacher to fix it.</p></div>}
      {batch.stale && canDecide && <div className="ra-banner warn" role="alert"><AlertIcon /><p>The marks no longer match what the teacher submitted. Return the section so the grading can be generated again.</p></div>}

      <div className="ra-grid">
        <section className="ra-panel">
          <h2>What the teacher chose</h2>
          <p className="ra-choice">{batch.generation?.description || "As entered (no upgrade)"}</p>
          {batch.generation?.reason
            ? <blockquote className="ra-reason"><span>Reason given</span>{batch.generation.reason}</blockquote>
            : <p className="ra-muted">No upgrade, so no reason was needed.</p>}
          <p className="ra-private"><LockIcon /> Students never see upgrades. After publication they see their grades on the transcript only.</p>
        </section>

        <section className="ra-panel">
          <h2>Effect on the class</h2>
          {summary ? (
            <>
              <div className="ra-tiles">
                <Tile label="Class average" before={fmt(summary.classAverageBefore)} after={fmt(summary.classAverageAfter)} />
                <Tile label="Passing" before={summary.passingBefore} after={summary.passingAfter} hint={`of ${summary.gradedCount} with marks`} />
                <Tile label="Moved up a grade" after={summary.studentsMovedUp} hint={`${summary.studentsUpgraded} received marks`} />
                <Tile label="Held at 100" after={summary.studentsAtCeiling} hint="nobody above 100" />
              </div>
              <Distribution distribution={summary.distribution} />
            </>
          ) : <p className="ra-muted">No summary was saved.</p>}
        </section>
      </div>

      {canDecide && noMarks.length > 0 && (
        <section className="ra-panel ra-decisions">
          <h2><AlertIcon /> {noMarks.length} student{noMarks.length === 1 ? " has" : "s have"} no marks at all</h2>
          <p className="ra-muted">Marks cannot give these students a grade. Decide what goes on the record, and say why. This is required before you can approve.</p>
          <ul>
            {noMarks.map((r) => {
              const d = decisionOf(r);
              return (
                <li key={r.registrationId}>
                  <div className="ra-who"><strong>{r.name}</strong><small>{r.rollNumber}</small></div>
                  <label><span>Record as</span>
                    <select value={d.grade} onChange={(e) => setDecisions({ ...decisions, [r.registrationId]: { ...d, grade: e.target.value } })}>
                      {Object.entries(SPECIAL).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
                    </select>
                  </label>
                  <label className="ra-grow"><span>Reason <em>(kept on record)</em></span>
                    <input value={d.reason} maxLength={500} onChange={(e) => setDecisions({ ...decisions, [r.registrationId]: { ...d, reason: e.target.value } })} placeholder="For example: absent all term, medical leave on file" />
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="ra-panel">
        <h2>Students <span className="ra-count">{rows.length}</span></h2>
        {rows.length === 0 ? <p className="ra-muted">No students.</p> : (
          <div className="ra-table" role="table" aria-label="Every student's marks before and after grading">
            <div className="ra-row ra-thead" role="row"><span role="columnheader">Student</span><span role="columnheader" className="num">Entered</span><span role="columnheader" className="num">Added</span><span role="columnheader" className="num">Final</span><span role="columnheader" className="grade">Grade</span></div>
            {rows.map((r) => {
              const letter = letters.get(String(r.registrationId)) || {};
              const none = r.raw === null;
              const moved = letter.before && letter.after && letter.before !== letter.after;
              const decided = none && !letter.recorded ? decisionOf(r).grade : null;
              return (
                <div className={`ra-row ${r.upgrade > 0 ? "changed" : ""}`} role="row" key={r.registrationId}>
                  <span role="cell" className="ra-student"><strong>{r.name}</strong><small>{r.rollNumber}</small></span>
                  <span role="cell" className="num" data-label="Entered">{none ? <em className="ra-muted">No marks</em> : fmt(r.raw)}</span>
                  <span role="cell" className="num" data-label="Added">{r.upgrade > 0 ? <b className="ra-added">+{fmt(r.upgrade)}</b> : <span className="ra-muted">–</span>}</span>
                  <span role="cell" className="num" data-label="Final"><strong>{fmt(r.final)}</strong></span>
                  <span role="cell" className="grade" data-label="Grade">
                    {letter.recorded ? <span className="ra-letter">{letter.recorded}</span>
                      : none ? <span className="ra-letter special">{decided}</span>
                        : moved ? <span className="ra-move"><s>{letter.before}</s><span className="ra-letter up">{letter.after}</span></span>
                          : <span className="ra-letter">{letter.after || "–"}</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ra-panel">
        <h2>History</h2>
        <ol className="ra-history">
          {(batch.history || []).slice().reverse().map((h, i) => (
            <li key={`${h.state}-${h.at}-${i}`}><span className={`ra-state ${STATE_TONE[h.state]}`}>{STATE_LABEL[h.state]}</span><span>{h.note || ""}</span><time>{dateTimeText(h.at)}</time></li>
          ))}
        </ol>
      </section>

      {state !== "PUBLISHED" && state !== "AMENDED" && (
        <div className="ra-actions">
          <p className="ra-actions-hint">
            {state === "APPROVED" ? "Publishing makes these grades visible on students' transcripts."
              : !decisionsReady ? "Give a reason for each student with no marks before you approve."
                : weightsBad ? "The weightage must total 100% before approval."
                  : "Approving writes these results to the permanent record."}
          </p>
          <div className="ra-buttons">
            {canDecide && <button type="button" className="ra-btn" onClick={() => { setError(""); setModal("return"); }} disabled={busy}>Return to teacher</button>}
            {state === "SUBMITTED" && <button type="button" className="ra-btn" onClick={doReview} disabled={busy}>Start review</button>}
            {canDecide && <button type="button" className="ra-btn ra-btn-primary" onClick={() => { setError(""); setModal("approve"); }} disabled={busy || !decisionsReady || weightsBad || batch.stale}>Approve</button>}
            {state === "APPROVED" && <button type="button" className="ra-btn ra-btn-primary" onClick={() => { setError(""); setModal("publish"); }} disabled={busy}>Publish to students</button>}
          </div>
        </div>
      )}
      {error && !modal && <div className="ra-error" role="alert">{error}</div>}

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
                <h3 id="ra-modal-title">Approve these results?</h3>
                <ul className="ra-modal-list">
                  <li>{rows.length} result{rows.length === 1 ? "" : "s"} are written to the permanent record{noMarks.length ? `, including ${noMarks.length} recorded as ${[...new Set(noMarks.map((r) => decisionOf(r).grade))].join("/")}` : ""}.</li>
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
