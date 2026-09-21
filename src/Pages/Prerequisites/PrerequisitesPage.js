import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./PrerequisitesPage.css";

const API = process.env.REACT_APP_BACKEND_URL;
const Svg = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const LinkIcon = () => <Svg size={20}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" /></Svg>;
const AlertIcon = () => <Svg size={14}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></Svg>;
const CheckIcon = () => <Svg size={14}><path d="M5 12l5 5 9-10" /></Svg>;
const XIcon = () => <Svg size={12}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const PlusIcon = () => <Svg size={14}><path d="M12 5v14M5 12h14" /></Svg>;
const TYPES = { PREREQ: "Must have passed", COREQ: "Take together with", ANTIREQ: "Cannot be taken with", RECOMMENDED: "Recommended" };

// Where an administrator says what each course requires. A version is finished when every course has its prerequisites
// declared (a rule, or an explicit "none"); only then can it be published. Rules are never edited: to change one you
// close it and add the new one, so what a student was held to on any day can be reconstructed.
const PrerequisitesPage = () => {
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState("");
  const [version, setVersion] = useState(null);
  const [bands, setBands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(null);     // course being given a rule
  const [form, setForm] = useState({ type: "PREREQ", requiredCourseId: "", minGrade: "D", groupKey: "default", minCreditsEarned: "" });
  const [closing, setClosing] = useState(null);   // { ruleId, label }
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);

  const run = async (work) => {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (err) { setError(err.response?.data?.message || "That did not work. Please try again."); } finally { setBusy(false); }
  };

  const loadVersion = useCallback(async (id) => {
    const response = await axios.get(`${API}/api/admin/curriculum-versions/${id}`);
    setVersion(response.data);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [list, scale] = await Promise.all([axios.get(`${API}/api/admin/curriculum-versions`), axios.get(`${API}/api/results/grading-scale`)]);
        setVersions(list.data);
        setBands((scale.data.bands || []).filter((b) => !b.isSpecialGrade && typeof b.gradePoints === "number"));
        if (list.data.length) { setVersionId(list.data[0].id); await loadVersion(list.data[0].id); }
      } catch (err) {
        setError(err.response?.data?.message || "Could not load curriculum versions.");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadVersion]);

  const letterFor = useMemo(() => (points) => {
    const band = bands.filter((b) => b.gradePoints >= points).sort((a, b) => a.gradePoints - b.gradePoints)[0];
    return band ? band.grade : `${points} points`;
  }, [bands]);
  const letters = useMemo(() => [...bands].sort((a, b) => b.gradePoints - a.gradePoints).map((b) => b.grade), [bands]);

  const choose = (id) => { setVersionId(id); setAdding(null); setClosing(null); run(() => loadVersion(id)); };
  const refresh = async () => { await loadVersion(versionId); setVersions((await axios.get(`${API}/api/admin/curriculum-versions`)).data); };

  const saveRule = () => run(async () => {
    await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/courses/${adding.id}/rules`, {
      type: form.type, groupKey: form.groupKey.trim() || "default", requiredCourseId: form.requiredCourseId,
      ...(form.type === "PREREQ" ? { minGrade: form.minGrade } : {}),
      ...(form.minCreditsEarned !== "" ? { minCreditsEarned: Number(form.minCreditsEarned) } : {}),
    });
    setAdding(null); setNotice("Rule added."); await refresh();
  });
  const closeRule = () => run(async () => {
    await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/rules/${closing.ruleId}/close`, { reason: closeReason });
    setClosing(null); setCloseReason(""); setNotice("Rule closed. Add a new one if the course should still require something."); await refresh();
  });
  const declareNone = (course) => run(async () => { await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/courses/${course.id}/declare-none`); setNotice(`${course.code} has no prerequisites.`); await refresh(); });
  const publish = () => run(async () => { await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/publish`); setNotice("Published."); await refresh(); });

  if (loading) return <div className="pre-page"><div className="pre-skeleton" /><div className="pre-skeleton" /><div className="pre-skeleton" /></div>;
  const c = version?.completion;
  // Counted from the courses themselves, so the badge and the list can never disagree.
  const remaining = version ? version.courses.filter((course) => !course.prerequisitesDeclared).length : 0;
  const shown = version ? version.courses.filter((course) => !onlyMissing || !course.prerequisitesDeclared) : [];

  return (
    <div className="pre-page">
      <header className="pre-header">
        <div className="pre-title">
          <span className="pre-icon"><LinkIcon /></span>
          <div>
            <h1>Prerequisites</h1>
            <p>Say what each course requires. A student who does not meet a rule cannot be enrolled unless an administrator records an exception.</p>
          </div>
        </div>
        {versions.length > 0 && (
          <label className="pre-picker">
            <span>Curriculum version</span>
            <select value={versionId} onChange={(e) => choose(e.target.value)} aria-label="Curriculum version" disabled={busy}>
              {versions.map((v) => <option key={v.id} value={v.id}>{v.versionCode} ({v.status})</option>)}
            </select>
          </label>
        )}
      </header>

      {error && <div className="pre-error" role="alert">{error}</div>}
      {notice && <div className="pre-notice" role="status"><CheckIcon /> {notice}</div>}
      {versions.length === 0 && !error && <div className="pre-empty">No curriculum versions exist yet. Run the curriculum setup script to create the baseline version for each program.</div>}

      {version && (
        <>
          <section className="pre-progress" aria-label="Progress">
            <div className="pre-progress-main">
              <div className="pre-progress-text"><strong>{c.declared} of {c.total}</strong> courses have their prerequisites entered ({c.percent}%)</div>
              <div className="pre-bar" role="progressbar" aria-valuenow={c.percent} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${c.percent}%` }} /></div>
              {version.status === "draft" && remaining > 0 && <p className="pre-progress-hint">Enter prerequisites for the {remaining} remaining course{remaining === 1 ? "" : "s"} to publish this version.</p>}
            </div>
            {version.status === "draft"
              ? <button className="pre-btn pre-btn-primary" onClick={publish} disabled={busy || c.percent < 100} title={c.percent < 100 ? "Every course must have its prerequisites entered first" : ""}>Publish version</button>
              : <span className="pre-published"><CheckIcon /> Published</span>}
          </section>

          <div className="pre-filters" role="group" aria-label="Show">
            <button type="button" className={`pre-filter ${!onlyMissing ? "is-active" : ""}`} onClick={() => setOnlyMissing(false)} aria-pressed={!onlyMissing}>All courses <span>{version.courses.length}</span></button>
            <button type="button" className={`pre-filter ${onlyMissing ? "is-active" : ""}`} onClick={() => setOnlyMissing(true)} aria-pressed={onlyMissing}>Needs attention <span>{remaining}</span></button>
          </div>

          <div className="pre-table-wrap">
            <table className="pre-table">
              <thead><tr><th scope="col">Course</th><th scope="col">Semester</th><th scope="col">What it requires</th><th scope="col">Unlocks</th><th scope="col"><span className="pre-sr">Actions</span></th></tr></thead>
              <tbody>
                {shown.length === 0 && <tr><td colSpan={5} className="pre-all-done">Every course has its prerequisites entered.</td></tr>}
                {shown.map((course) => (
                  <React.Fragment key={course.id}>
                    <tr className={course.prerequisitesDeclared ? "pre-row" : "pre-row pre-missing"}>
                      <td data-label="Course" className="pre-course"><strong>{course.code}</strong><span>{course.name}</span></td>
                      <td data-label="Semester"><span className="pre-sem">{course.semester}</span></td>
                      <td data-label="What it requires">
                        {course.rules.length === 0
                          ? (course.prerequisitesDeclared ? <span className="pre-none">No prerequisites</span> : <span className="pre-todo"><AlertIcon /> Not entered yet</span>)
                          : (
                            <ul className="pre-rules">
                              {course.rules.map((r) => (
                                <li key={r.id} className="pre-rule">
                                  <span className="pre-rule-text">
                                    {TYPES[r.type]} <strong>{r.requires.code}</strong>{r.type === "PREREQ" && r.minGradePoints != null ? ` at grade ${letterFor(r.minGradePoints)} or better` : ""}
                                    {r.minCreditsEarned ? `, with ${r.minCreditsEarned} credits earned` : ""}
                                    {r.groupKey !== "default" && <span className="pre-group">group {r.groupKey}</span>}
                                  </span>
                                  <button className="pre-x" onClick={() => setClosing({ ruleId: r.id, label: `${course.code} requires ${r.requires.code}` })} aria-label={`Close rule: ${course.code} requires ${r.requires.code}`} disabled={busy}><XIcon />Close</button>
                                </li>
                              ))}
                            </ul>
                          )}
                      </td>
                      <td data-label="Unlocks">{course.unlocks.length ? <span className="pre-unlocks">{course.unlocks.map((u) => <span key={u.code} className="pre-chip">{u.code}</span>)}</span> : <span className="pre-muted">—</span>}</td>
                      <td className="pre-actions">
                        <div className="pre-actions-inner">
                          <button className="pre-btn" onClick={() => { setAdding(course); setForm({ type: "PREREQ", requiredCourseId: "", minGrade: letters.includes("D") ? "D" : letters[letters.length - 1] || "", groupKey: "default", minCreditsEarned: "" }); }} disabled={busy}>Add rule</button>
                          {!course.prerequisitesDeclared && <button className="pre-btn pre-btn-quiet" onClick={() => declareNone(course)} disabled={busy}>No prerequisites</button>}
                        </div>
                      </td>
                    </tr>
                    {adding?.id === course.id && (
                      <tr className="pre-form-row"><td colSpan={5}>
                        <div className="pre-form">
                          <div className="pre-form-title"><PlusIcon /> New rule for <strong>{course.code}</strong></div>
                          <div className="pre-form-grid">
                            <label>Kind<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                            <label>Course<select value={form.requiredCourseId} onChange={(e) => setForm({ ...form, requiredCourseId: e.target.value })}>
                              <option value="">Choose a course…</option>
                              {version.courses.filter((x) => x.id !== course.id).map((x) => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}
                            </select></label>
                            {form.type === "PREREQ" && <label>Minimum grade<select value={form.minGrade} onChange={(e) => setForm({ ...form, minGrade: e.target.value })}>{letters.map((l) => <option key={l} value={l}>{l}</option>)}</select></label>}
                            <label>Group<input value={form.groupKey} onChange={(e) => setForm({ ...form, groupKey: e.target.value })} aria-describedby="group-help" /></label>
                            <label><span>Credits earned <em>(optional)</em></span><input type="number" min="0" value={form.minCreditsEarned} onChange={(e) => setForm({ ...form, minCreditsEarned: e.target.value })} /></label>
                          </div>
                          <p id="group-help" className="pre-help">Rules with the same group are alternatives (either one is enough). Different groups must all be met.</p>
                          <div className="pre-form-buttons">
                            <button className="pre-btn" onClick={() => setAdding(null)} disabled={busy}>Cancel</button>
                            <button className="pre-btn pre-btn-primary" onClick={saveRule} disabled={busy || !form.requiredCourseId}>Save rule</button>
                          </div>
                        </div>
                      </td></tr>
                    )}
                    {closing && course.rules.some((r) => r.id === closing.ruleId) && (
                      <tr className="pre-form-row"><td colSpan={5}>
                        <div className="pre-form">
                          <div className="pre-form-title">Close rule: <strong>{closing.label}</strong></div>
                          <label>Why is it being closed?<textarea rows={2} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} /></label>
                          <p className="pre-help">The rule stays on record. Students enrolled under it are not affected.</p>
                          <div className="pre-form-buttons">
                            <button className="pre-btn" onClick={() => { setClosing(null); setCloseReason(""); }} disabled={busy}>Cancel</button>
                            <button className="pre-btn pre-btn-primary" onClick={closeRule} disabled={busy || closeReason.trim().length < 3}>Close rule</button>
                          </div>
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default PrerequisitesPage;
