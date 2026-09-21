import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./PrerequisitesPage.css";

const API = process.env.REACT_APP_BACKEND_URL;
const Svg = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
const LinkIcon = () => <Svg size={20}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" /></Svg>;
const CheckIcon = ({ size = 14 }) => <Svg size={size}><path d="M5 12l5 5 9-10" /></Svg>;
const XIcon = () => <Svg size={12}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
const PlusIcon = () => <Svg size={14}><path d="M12 5v14M5 12h14" /></Svg>;
const SearchIcon = () => <Svg size={16}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>;
const InfoIcon = () => <Svg size={16}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.5" /></Svg>;
const ArrowIcon = () => <Svg size={14}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;

const TYPES = { PREREQ: "Must have passed", COREQ: "Take together with", ANTIREQ: "Cannot be taken with", RECOMMENDED: "Recommended" };
const HELP_KEY = "prerequisites-guide-dismissed";
const readDismissed = () => { try { return window.localStorage.getItem(HELP_KEY) === "1"; } catch { return false; } };
const rememberDismissed = () => { try { window.localStorage.setItem(HELP_KEY, "1"); } catch { /* the guide simply shows again */ } };

const STEPS = [
  { title: "Go through each course", body: "If students must pass another course first, choose Add prerequisite. If anyone may take it, choose No prerequisite." },
  { title: "Publish when all are answered", body: "Every course needs an answer, even if the answer is none. Then the Publish button turns on." },
  { title: "Enrolment enforces it", body: "A student who has not met a rule cannot be enrolled, unless an administrator records an exception with a reason." },
];

// Rules as blocks. Prerequisites that share a group are alternatives, shown together; each other rule stands alone.
const ruleBlocks = (rules) => {
  const blocks = []; const byKey = new Map();
  for (const rule of rules) {
    if (rule.type !== "PREREQ") { blocks.push({ key: rule.id, type: rule.type, rules: [rule] }); continue; }
    if (!byKey.has(rule.groupKey)) { const block = { key: `g-${rule.groupKey}`, type: "PREREQ", groupKey: rule.groupKey, rules: [] }; byKey.set(rule.groupKey, block); blocks.push(block); }
    byKey.get(rule.groupKey).rules.push(rule);
  }
  return blocks.map((block) => ({ ...block, key: block.groupKey || block.key }));
};

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
  const blankForm = (minGrade = "D") => ({ type: "PREREQ", selected: [], mode: "all", joinGroup: null, minGrade, minCreditsEarned: "", filter: "" });
  const [form, setForm] = useState(blankForm());
  const [closing, setClosing] = useState(null);   // { ruleId, label }
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");    // all | todo | done
  const [query, setQuery] = useState("");
  const [guideHidden, setGuideHidden] = useState(readDismissed);

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

  const choose = (id) => { setVersionId(id); setAdding(null); setClosing(null); setFilter("all"); setQuery(""); run(() => loadVersion(id)); };
  const refresh = async () => { await loadVersion(versionId); setVersions((await axios.get(`${API}/api/admin/curriculum-versions`)).data); };

  const defaultGrade = letters.includes("D") ? "D" : letters[letters.length - 1] || "";
  // joinGroup: add an alternative to an existing either-or block instead of a new requirement.
  const openAdd = (course, joinGroup = null) => {
    setClosing(null);
    setAdding(course);
    setForm({ ...blankForm(defaultGrade), joinGroup });
  };
  const toggleCourse = (id) => setForm((f) => ({ ...f, selected: f.selected.includes(id) ? f.selected.filter((x) => x !== id) : [...f.selected, id] }));

  // Rules that share a group are alternatives (any one is enough); different groups must ALL be met. So a new
  // requirement always gets a group of its own, and only "any one of these" (or adding to an either-or block) shares one.
  const saveRules = () => run(async () => {
    const taken = new Set(adding.rules.map((r) => r.groupKey));
    let n = 0;
    const fresh = () => { do { n += 1; } while (taken.has(`g${n}`)); taken.add(`g${n}`); return `g${n}`; };
    const shared = form.joinGroup || (form.selected.length > 1 && form.type === "PREREQ" && form.mode === "any" ? fresh() : null);
    const saved = [];
    try {
      for (const requiredCourseId of form.selected) {
        await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/courses/${adding.id}/rules`, {
          type: form.type, groupKey: shared || fresh(), requiredCourseId,
          ...(form.type === "PREREQ" ? { minGrade: form.minGrade } : {}),
          ...(form.minCreditsEarned !== "" ? { minCreditsEarned: Number(form.minCreditsEarned) } : {}),
        });
        saved.push(requiredCourseId);
      }
    } catch (error) {
      // Keep the form open with only what still needs saving, so a retry cannot add anything twice.
      if (saved.length) { setForm((f) => ({ ...f, selected: f.selected.filter((id) => !saved.includes(id)) })); await refresh(); }
      throw error;
    }
    setAdding(null);
    setNotice(saved.length === 1 ? "Rule added." : `${saved.length} rules added.`);
    await refresh();
  });
  const closeRule = () => run(async () => {
    await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/rules/${closing.ruleId}/close`, { reason: closeReason });
    setClosing(null); setCloseReason(""); setNotice("Rule removed. Add a new one if the course should still require something."); await refresh();
  });
  const declareNone = (course) => run(async () => { await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/courses/${course.id}/declare-none`); setNotice(`${course.code} has no prerequisites.`); await refresh(); });
  const publish = () => run(async () => { await axios.post(`${API}/api/admin/curriculum-versions/${versionId}/publish`); setNotice("Published. These rules now apply to enrolment."); await refresh(); });
  const hideGuide = () => { setGuideHidden(true); rememberDismissed(); };

  const courses = version?.courses || [];
  // Everything below is counted from the courses themselves, so a number and the list beside it can never disagree.
  const answered = courses.filter((course) => course.prerequisitesDeclared).length;
  const remaining = courses.length - answered;
  const percent = courses.length ? Math.round((answered / courses.length) * 100) : 0;
  const complete = courses.length > 0 && remaining === 0;

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = courses.filter((course) => {
      if (filter === "todo" && course.prerequisitesDeclared) return false;
      if (filter === "done" && !course.prerequisitesDeclared) return false;
      return !needle || `${course.code} ${course.name}`.toLowerCase().includes(needle);
    });
    const bySemester = new Map();
    for (const course of [...visible].sort((a, b) => (a.semester - b.semester) || a.code.localeCompare(b.code, undefined, { numeric: true }))) {
      if (!bySemester.has(course.semester)) bySemester.set(course.semester, []);
      bySemester.get(course.semester).push(course);
    }
    return [...bySemester.entries()];
  }, [courses, filter, query]);

  if (loading) return <div className="pre-page"><div className="pre-skeleton" /><div className="pre-skeleton" /><div className="pre-skeleton" /></div>;

  const versionLabel = (v) => `${v.program?.name || "Program"} · ${v.versionCode} (${v.status})`;
  const programName = version?.program?.name || versions.find((v) => v.id === versionId)?.program?.name;

  const renderForm = (course) => {
    const needle = form.filter.trim().toLowerCase();
    const options = courses.filter((x) => x.id !== course.id && (!needle || `${x.code} ${x.name}`.toLowerCase().includes(needle)));
    const count = form.selected.length;
    const label = { PREREQ: "must first pass", COREQ: "must be taken together with", ANTIREQ: "cannot be taken with", RECOMMENDED: "is recommended after" }[form.type];
    const joining = form.joinGroup ? course.rules.filter((r) => r.groupKey === form.joinGroup).map((r) => r.requires.code).join(" or ") : null;
    return (
      <div className="pre-form" role="group" aria-label={`New rule for ${course.code}`}>
        <div className="pre-form-title"><PlusIcon />{joining ? <>Another way to meet <strong>{joining}</strong> for <strong>{course.code}</strong></> : <>New requirement for <strong>{course.code}</strong></>}</div>

        <div className="pre-sentence">
          {!joining && (
            <label>
              <span>Kind of rule</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          )}
          {form.type === "PREREQ" && (
            <label>
              <span>Minimum grade</span>
              <select value={form.minGrade} onChange={(e) => setForm({ ...form, minGrade: e.target.value })}>{letters.map((l) => <option key={l} value={l}>{l} or better</option>)}</select>
            </label>
          )}
        </div>

        <fieldset className="pre-pick-box">
          <legend>{course.code} {label}: <em>tick one or more courses</em></legend>
          <input type="search" className="pre-pick-search" value={form.filter} onChange={(e) => setForm({ ...form, filter: e.target.value })} placeholder="Filter the list by code or name" aria-label="Filter courses to choose from" />
          <ul className="pre-pick">
            {options.length === 0 && <li className="pre-pick-empty">No course matches.</li>}
            {options.map((x) => (
              <li key={x.id}>
                <label className={`pre-pick-row ${form.selected.includes(x.id) ? "is-on" : ""}`}>
                  <input type="checkbox" checked={form.selected.includes(x.id)} onChange={() => toggleCourse(x.id)} />
                  <strong>{x.code}</strong><span>{x.name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {count > 1 && form.type === "PREREQ" && !form.joinGroup && (
          <fieldset className="pre-mode">
            <legend>You chose {count} courses. How should they combine?</legend>
            <label className={`pre-mode-opt ${form.mode === "all" ? "is-on" : ""}`}>
              <input type="radio" name="pre-mode" checked={form.mode === "all"} onChange={() => setForm({ ...form, mode: "all" })} />
              <span><strong>Needs all of them</strong><small>The student must have passed every one of these.</small></span>
            </label>
            <label className={`pre-mode-opt ${form.mode === "any" ? "is-on" : ""}`}>
              <input type="radio" name="pre-mode" checked={form.mode === "any"} onChange={() => setForm({ ...form, mode: "any" })} />
              <span><strong>Needs any one of them</strong><small>Passing just one of these is enough.</small></span>
            </label>
          </fieldset>
        )}

        <details className="pre-more">
          <summary>More options</summary>
          <div className="pre-more-body">
            <label>
              <span>Credits earned <em>(optional)</em></span>
              <input type="number" min="0" value={form.minCreditsEarned} onChange={(e) => setForm({ ...form, minCreditsEarned: e.target.value })} />
            </label>
            <p className="pre-help">Also require the student to have earned at least this many credits in total.</p>
          </div>
        </details>

        <div className="pre-form-buttons">
          <button className="pre-btn" onClick={() => setAdding(null)} disabled={busy}>Cancel</button>
          <button className="pre-btn pre-btn-primary" onClick={saveRules} disabled={busy || count === 0}>{count > 1 ? `Save ${count} rules` : "Save rule"}</button>
        </div>
      </div>
    );
  };

  return (
    <div className="pre-page">
      <header className="pre-header">
        <div className="pre-title">
          <span className="pre-icon"><LinkIcon /></span>
          <div>
            <h1>Prerequisites</h1>
            <p>Choose which courses a student must pass before taking another one.</p>
          </div>
        </div>
        {versions.length > 0 && (
          <label className="pre-picker">
            <span>Program and curriculum version</span>
            <select value={versionId} onChange={(e) => choose(e.target.value)} aria-label="Program and curriculum version" disabled={busy}>
              {versions.map((v) => <option key={v.id} value={v.id}>{versionLabel(v)}</option>)}
            </select>
          </label>
        )}
      </header>

      {error && <div className="pre-error" role="alert">{error}</div>}
      {notice && <div className="pre-notice" role="status"><CheckIcon /> {notice}</div>}
      {versions.length === 0 && !error && (
        <div className="pre-empty">
          <strong>Curriculum versions have not been set up yet.</strong>
          <span>Ask your system administrator to run the curriculum setup, then come back here.</span>
        </div>
      )}

      {version && (
        <>
          {!guideHidden && version.status === "draft" && (
            <section className="pre-guide" aria-label="How this works">
              <div className="pre-guide-head">
                <span><InfoIcon /> How this works</span>
                <button type="button" className="pre-x" onClick={hideGuide}>Got it, hide</button>
              </div>
              <ol className="pre-steps">
                {STEPS.map((step, i) => (
                  <li key={step.title}><span className="pre-step-n">{i + 1}</span><div><strong>{step.title}</strong><p>{step.body}</p></div></li>
                ))}
              </ol>
            </section>
          )}

          <section className="pre-progress" aria-label="Progress">
            <div className="pre-progress-main">
              <div className="pre-progress-top">
                {programName && <span className="pre-program">{programName}</span>}
                <span className="pre-progress-text"><strong>{answered} of {courses.length}</strong> courses answered ({percent}%)</span>
              </div>
              <div className="pre-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Courses answered"><div style={{ width: `${percent}%` }} /></div>
              {version.status === "draft" && (
                <p className="pre-progress-hint">
                  {complete
                    ? "Every course has an answer. You can publish this version."
                    : `${remaining} course${remaining === 1 ? "" : "s"} still need${remaining === 1 ? "s" : ""} an answer before you can publish.`}
                </p>
              )}
            </div>
            {version.status === "draft"
              ? <button className="pre-btn pre-btn-primary pre-btn-lg" onClick={publish} disabled={busy || !complete} title={complete ? "" : "Every course must have an answer first"}>Publish version</button>
              : <span className="pre-published"><CheckIcon /> Published</span>}
          </section>

          <div className="pre-toolbar">
            <div className="pre-filters" role="group" aria-label="Show">
              <button type="button" className={`pre-filter ${filter === "all" ? "is-active" : ""}`} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>All <span>{courses.length}</span></button>
              <button type="button" className={`pre-filter ${filter === "todo" ? "is-active" : ""}`} onClick={() => setFilter("todo")} aria-pressed={filter === "todo"}>To do <span>{remaining}</span></button>
              <button type="button" className={`pre-filter ${filter === "done" ? "is-active" : ""}`} onClick={() => setFilter("done")} aria-pressed={filter === "done"}>Done <span>{answered}</span></button>
            </div>
            <label className="pre-search">
              <SearchIcon />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by course code or name" aria-label="Search courses" />
            </label>
          </div>

          {groups.length === 0 && (
            <div className="pre-all-done">
              {query ? "No course matches that search." : filter === "todo" ? "Nothing left to do. Every course has an answer." : "No courses to show."}
            </div>
          )}

          {groups.map(([semester, list]) => {
            const todo = list.filter((c) => !c.prerequisitesDeclared).length;
            const heading = semester ? `Semester ${semester}` : "Not placed in a semester";
            return (
              <section className="pre-semester" key={semester} aria-label={heading}>
                <h2 className="pre-semester-head">
                  <span>{heading}</span>
                  <em>{list.length} course{list.length === 1 ? "" : "s"}{todo ? ` · ${todo} to do` : " · all done"}</em>
                </h2>
                <ul className="pre-list">
                  {list.map((course) => (
                    <li key={course.id} className={`pre-course-card ${course.prerequisitesDeclared ? "is-done" : "is-todo"}`}>
                      <div className="pre-card-main">
                        <div className="pre-card-id">
                          <span className={`pre-status ${course.prerequisitesDeclared ? "done" : "todo"}`} title={course.prerequisitesDeclared ? "Answered" : "Needs an answer"}>
                            {course.prerequisitesDeclared ? <CheckIcon size={13} /> : <span aria-hidden="true">!</span>}
                            <span className="pre-sr">{course.prerequisitesDeclared ? "Answered" : "Needs an answer"}</span>
                          </span>
                          <div className="pre-course">
                            <strong>{course.code}</strong>
                            <span>{course.name}</span>
                          </div>
                        </div>

                        <div className="pre-card-req">
                          {course.rules.length === 0
                            ? (course.prerequisitesDeclared
                              ? <span className="pre-none">No prerequisite. Anyone can take this course.</span>
                              : <span className="pre-todo">Not answered yet. Does this course need another course first?</span>)
                            : (
                              <div className="pre-rulegroups">
                                {ruleBlocks(course.rules).map((block, bi) => (
                                  <React.Fragment key={block.key}>
                                    {bi > 0 && <span className="pre-and">and</span>}
                                    <div className={`pre-block-rules ${block.rules.length > 1 ? "is-either" : ""}`}>
                                      {block.rules.length > 1 && <span className="pre-either">Any one of these</span>}
                                      <ul className="pre-rules">
                                        {block.rules.map((r, ri) => (
                                          <li key={r.id} className="pre-rule">
                                            <span className="pre-rule-text">
                                              {ri > 0 && <em className="pre-or">or </em>}
                                              {TYPES[r.type]} <strong>{r.requires.code}</strong>
                                              {r.type === "PREREQ" && r.minGradePoints != null ? ` at grade ${letterFor(r.minGradePoints)} or better` : ""}
                                              {r.minCreditsEarned ? `, with ${r.minCreditsEarned} credits earned` : ""}
                                            </span>
                                            <button className="pre-x" onClick={() => { setAdding(null); setClosing({ ruleId: r.id, label: `${course.code} requires ${r.requires.code}` }); }} aria-label={`Remove rule: ${course.code} requires ${r.requires.code}`} disabled={busy}><XIcon />Remove</button>
                                          </li>
                                        ))}
                                      </ul>
                                      {block.type === "PREREQ" && <button type="button" className="pre-link" onClick={() => openAdd(course, block.key)} disabled={busy}>+ Add another way to meet this</button>}
                                    </div>
                                  </React.Fragment>
                                ))}
                              </div>
                            )}
                          {course.unlocks.length > 0 && (
                            <span className="pre-unlocks"><ArrowIcon /> Leads to {course.unlocks.map((u) => <span key={u.code} className="pre-chip">{u.code}</span>)}</span>
                          )}
                        </div>

                        <div className="pre-actions">
                          <button className={`pre-btn ${course.prerequisitesDeclared ? "" : "pre-btn-primary"}`} onClick={() => openAdd(course)} disabled={busy}>{course.rules.length ? "Add another requirement" : "Add prerequisite"}</button>
                          {!course.prerequisitesDeclared && <button className="pre-btn" onClick={() => declareNone(course)} disabled={busy}>No prerequisite</button>}
                        </div>
                      </div>

                      {adding?.id === course.id && <div className="pre-panel">{renderForm(course)}</div>}
                      {closing && course.rules.some((r) => r.id === closing.ruleId) && (
                        <div className="pre-panel">
                          <div className="pre-form">
                            <div className="pre-form-title">Remove rule: <strong>{closing.label}</strong></div>
                            <label className="pre-block">
                              <span>Why is it being removed?</span>
                              <textarea rows={2} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
                            </label>
                            <p className="pre-help">The rule stays on record. Students already enrolled under it are not affected.</p>
                            <div className="pre-form-buttons">
                              <button className="pre-btn" onClick={() => { setClosing(null); setCloseReason(""); }} disabled={busy}>Cancel</button>
                              <button className="pre-btn pre-btn-primary" onClick={closeRule} disabled={busy || closeReason.trim().length < 3}>Remove rule</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
};

export default PrerequisitesPage;
