import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiPlus, FiMinus, FiRepeat, FiRotateCcw, FiLock, FiAlertTriangle, FiAlertCircle, FiClock, FiChevronDown, FiChevronUp } from "react-icons/fi";
import Loading, { BusyLabel } from "../../Components/Loading/Loading";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { messageOf } from "../../utils/apiMessage";
import { Modal } from "../Administrators/AdminModals";
import AddCourseModal from "./AddCourseModal";
import { getEnrollment, previewChanges, saveChanges, initialsOf, plural, shortDate, dateTime } from "./enrollmentApi";

const seatsText = (s) => (s.capacity === null || s.capacity === undefined ? `${s.taken} enrolled` : `${s.taken} of ${s.capacity} seats`);
const isFull = (s) => s.capacity !== null && s.capacity !== undefined && s.taken >= s.capacity;
const courseTitle = (c) => [c.code, c.name].filter(Boolean).join(" · ");

// Pick one of two answers, as large tappable cards.
const ChoiceCard = ({ checked, onSelect, title, text, tone }) => (
  <label className={`me-choice ${checked ? "is-on" : ""} ${tone || ""}`}>
    <input type="radio" checked={checked} onChange={onSelect} />
    <span>
      <strong>{title}</strong>
      <small>{text}</small>
    </span>
  </label>
);

// Remove: one question, why.
const RemoveModal = ({ entry, student, onConfirm, onClose }) => {
  const [kind, setKind] = useState("dropped");
  return (
    <Modal
      title="Remove course"
      onClose={onClose}
      footer={<><button type="button" className="am-btn" onClick={onClose}>Cancel</button><button type="button" className="am-btn am-btn-danger" onClick={() => onConfirm(kind)}>Mark for removal</button></>}
    >
      <p className="am-confirm-text">Why is <strong>{student.name}</strong> leaving <strong>{courseTitle(entry.course)}</strong>?</p>
      <div className="me-choices">
        <ChoiceCard checked={kind === "dropped"} onSelect={() => setKind("dropped")} title="They dropped the course" text="Stays in their history as dropped and can be restored later." />
        <ChoiceCard checked={kind === "mistake"} onSelect={() => setKind("mistake")} title="They were enrolled by mistake" text="Taken off their record as if it never happened. The change log still keeps it." />
      </div>
      <p className="am-hint">Nothing changes until you review and save.</p>
    </Modal>
  );
};

// Change section: the other sections of the same course, with teachers and seats.
const SectionModal = ({ entry, onConfirm, onClose }) => {
  const choices = entry.sections.filter((s) => String(s.id) !== String(entry.section?.id));
  const [picked, setPicked] = useState(null);
  return (
    <Modal
      title="Change section"
      onClose={onClose}
      footer={<><button type="button" className="am-btn" onClick={onClose}>Cancel</button><button type="button" className="am-btn am-btn-primary" disabled={!picked} onClick={() => onConfirm(picked)}>Move to this section</button></>}
    >
      <p className="am-confirm-text">{courseTitle(entry.course)} · now in section <strong>{entry.section?.name || "—"}</strong></p>
      {choices.length === 0 ? (
        <p className="me-empty-note">This course has no other section this semester.</p>
      ) : (
        <div className="me-sections">
          {choices.map((s) => {
            const full = isFull(s);
            return (
              <label key={s.id} className={`me-section ${picked?.id === s.id ? "is-on" : ""} ${full ? "is-full" : ""}`}>
                <input type="radio" name="me-section" disabled={full} checked={picked?.id === s.id} onChange={() => setPicked(s)} />
                <span className="me-section-name">Section {s.name}</span>
                <span className="me-section-meta">{s.teachers.join(", ") || "No teacher yet"}</span>
                <span className={`me-seats ${full ? "is-full" : ""}`}>{full ? "Full" : seatsText(s)}</span>
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
};

// Review: every change, what the checks found, credits before and after, and the one reason.
const ReviewModal = ({ student, preview, checking, saving, error, onSave, onClose }) => {
  const [reason, setReason] = useState("");
  const blocked = preview && !preview.canSave;
  const ready = preview && !blocked && reason.trim().length >= 3 && !checking;
  return (
    <Modal
      title="Review and save"
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <button type="button" className="am-btn" onClick={onClose} disabled={saving}>Back</button>
          <button type="button" className="am-btn am-btn-primary" onClick={() => onSave(reason.trim())} disabled={!ready || saving}>
            <BusyLabel busy={saving} busyText="Saving…" idle={`Save ${plural(preview?.items.length || 0, "change")}`} />
          </button>
        </>
      }
    >
      <p className="am-confirm-text">Changes for <strong>{student.name}</strong> ({student.rollNumber}). They're applied together, or not at all.</p>
      {checking && !preview ? <Loading variant="list" rows={2} label="Checking" /> : preview && (
        <>
          <ul className="me-review">
            {preview.items.map((item) => (
              <li key={item.index} className={item.ok ? "" : "is-blocked"}>
                <span className={`me-review-icon ${item.type}`} aria-hidden="true">{item.type === "add" || item.type === "restore" ? <FiPlus /> : item.type === "section" ? <FiRepeat /> : <FiMinus />}</span>
                <div>
                  <strong>{item.label}</strong>
                  {item.blocking.map((m, i) => <p key={`b${i}`} className="me-msg is-bad"><FiAlertCircle aria-hidden="true" /> {m}</p>)}
                  {item.warnings.map((m, i) => <p key={`w${i}`} className="me-msg is-warn"><FiAlertTriangle aria-hidden="true" /> {m}</p>)}
                </div>
              </li>
            ))}
          </ul>
          <div className="me-credits">Credit hours <strong>{preview.creditsBefore}</strong> → <strong>{preview.creditsAfter}</strong></div>
          {blocked ? (
            <div className="am-error" role="alert">Fix or undo the changes marked in red before saving.</div>
          ) : (
            <label className="am-field me-reason">
              <span>Reason <em>(saved with the change)</em></span>
              <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Academic Dept email, 6 Oct: dropped Machine Learning, added Programming for AI and DS" maxLength={500} autoFocus />
            </label>
          )}
        </>
      )}
      {error && <div className="am-error" role="alert">{error}</div>}
    </Modal>
  );
};

// One student's courses this semester, edited as a set of pending changes and saved together.
const StudentWorkspace = ({ studentId, onClose }) => {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [staged, setStaged] = useState({});        // registrationId -> { type: 'remove', kind } | { type: 'section', section } | { type: 'restore' }
  const [adds, setAdds] = useState([]);             // [{ key, courseOfferingId, course, section }]
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [modal, setModal] = useState(null);         // { type: 'remove' | 'section', entry } | { type: 'add' } | { type: 'review' }
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      setData(await getEnrollment(studentId));
    } catch (err) {
      setLoadError(messageOf(err, "Could not load this student's courses."));
    }
  }, [studentId]);
  useEffect(() => { setData(null); setStaged({}); setAdds([]); setPreview(null); load(); }, [load]);

  // The changes as the server wants them, and which row each one belongs to.
  const { changes, keys } = useMemo(() => {
    const list = []; const keyList = [];
    for (const [registrationId, s] of Object.entries(staged)) {
      if (s.type === "remove") list.push({ type: "remove", registrationId, kind: s.kind });
      if (s.type === "section") list.push({ type: "section", registrationId, sectionId: s.section.id });
      if (s.type === "restore") list.push({ type: "restore", registrationId });
      keyList.push(registrationId);
    }
    for (const a of adds) { list.push({ type: "add", courseOfferingId: a.courseOfferingId, sectionId: a.section.id }); keyList.push(a.key); }
    return { changes: list, keys: keyList };
  }, [staged, adds]);

  // Check as you go, a moment after the last edit, so problems show on the row straight away.
  useEffect(() => {
    if (!changes.length) { setPreview(null); return undefined; }
    let live = true;
    setChecking(true);
    const timer = setTimeout(async () => {
      try {
        const result = await previewChanges(studentId, changes);
        if (live) setPreview(result);
      } catch (err) {
        if (live) setPreview({ items: [], canSave: false, error: messageOf(err, "The changes could not be checked.") });
      } finally {
        if (live) setChecking(false);
      }
    }, 350);
    return () => { live = false; clearTimeout(timer); };
  }, [changes, studentId]);

  const issuesFor = (key) => {
    const at = keys.indexOf(key);
    return at === -1 ? null : preview?.items?.find((i) => i.index === at) || null;
  };

  const stage = (registrationId, change) => setStaged((current) => ({ ...current, [registrationId]: change }));
  const unstage = (registrationId) => setStaged((current) => { const next = { ...current }; delete next[registrationId]; return next; });
  const discard = () => { setStaged({}); setAdds([]); setPreview(null); };

  const save = async (reason) => {
    try {
      setSaving(true);
      setSaveError("");
      const result = await saveChanges(studentId, changes, reason);
      setData(result.enrollment);
      setStaged({}); setAdds([]); setPreview(null); setModal(null);
      showToast(result.message || "Changes saved", TOAST_TYPES.SUCCESS);
    } catch (err) {
      if (err.response?.data?.details?.items) setPreview(err.response.data.details);
      setSaveError(messageOf(err, "The changes could not be saved."));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <div className="me-card"><div className="error-message" role="alert">{loadError} <button type="button" className="am-btn am-btn-small" onClick={load}>Try again</button></div></div>;
  if (!data) return <div className="me-card"><Loading variant="list" rows={4} label="Loading courses" /></div>;

  const { student, term, courses, dropped, addDrop, history } = data;
  const pendingCredits = (() => {
    let total = data.credits;
    for (const c of courses) if (staged[c.registrationId]?.type === "remove") total -= c.course.creditHours;
    for (const c of dropped) if (staged[c.registrationId]?.type === "restore") total += c.course.creditHours;
    for (const a of adds) total += a.course.creditHours;
    return total;
  })();
  const takenCourseIds = new Set([...courses.map((c) => String(c.course.id)), ...adds.map((a) => String(a.course.id))]);

  const Issues = ({ issue }) => (issue ? (
    <div className="me-issues">
      {issue.blocking.map((m, i) => <p key={`b${i}`} className="me-msg is-bad"><FiAlertCircle aria-hidden="true" /> {m}</p>)}
      {issue.warnings.map((m, i) => <p key={`w${i}`} className="me-msg is-warn"><FiAlertTriangle aria-hidden="true" /> {m}</p>)}
    </div>
  ) : null);

  return (
    <div className="me-workspace">
      <section className="me-card me-student">
        <div className="me-avatar" aria-hidden="true">{initialsOf(student.name)}</div>
        <div className="me-student-text">
          <h2>{student.name}</h2>
          <p>{[student.rollNumber, student.program?.name || student.program?.code, student.currentSemester !== null ? `Semester ${student.currentSemester}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="me-student-stats">
          <div><span>Semester</span><strong>{term.label}</strong></div>
          <div><span>Courses</span><strong>{courses.length}</strong></div>
          <div><span>Credit hours</span><strong>{data.credits}</strong></div>
        </div>
        <button type="button" className="me-close" onClick={() => { if (!changes.length || window.confirm("Discard your unsaved changes for this student?")) onClose(); }}>Change student</button>
      </section>

      {addDrop?.passed && (
        <div className="me-banner"><FiClock aria-hidden="true" /> The add/drop period ended on {shortDate(addDrop.endsAt)}. Changes are still allowed. You'll see a reminder before saving.</div>
      )}

      <section className="me-card">
        <header className="me-card-head">
          <div>
            <h3>Courses this semester</h3>
            <p>Remove, move to another section, or add a course. Nothing is saved until you review.</p>
          </div>
          <button type="button" className="sp-btn sp-btn-primary me-add-btn" onClick={() => setModal({ type: "add" })}><FiPlus aria-hidden="true" /> Add course</button>
        </header>

        {courses.length === 0 && adds.length === 0 ? (
          <div className="me-empty">
            <strong>No courses this semester</strong>
            <span>Use “Add course” to enroll {student.name.split(" ")[0]} in one.</span>
          </div>
        ) : (
          <ul className="me-list">
            {courses.map((c) => {
              const s = staged[c.registrationId];
              const issue = issuesFor(c.registrationId);
              const tone = s?.type === "remove" ? "is-removing" : s?.type === "section" ? "is-moving" : "";
              return (
                <li key={c.registrationId} className={`me-row ${tone} ${issue && !issue.ok ? "has-error" : ""}`}>
                  <div className="me-row-main">
                    <span className="me-code">{c.course.code || "—"}</span>
                    <div className="me-row-text">
                      <strong className={s?.type === "remove" ? "is-struck" : ""}>{c.course.name}</strong>
                      <small>
                        {s?.type === "section"
                          ? <>Section {c.section?.name} <FiRepeat className="me-inline-icon" aria-hidden="true" /> <b>Section {s.section.name}</b></>
                          : <>Section {c.section?.name || "—"}{c.section?.teachers?.length ? ` · ${c.section.teachers.join(", ")}` : ""}</>}
                        {` · ${plural(c.course.creditHours, "credit")}`}
                      </small>
                    </div>
                    {s ? (
                      <div className="me-row-state">
                        <span className={`me-tag ${s.type === "remove" ? "is-bad" : "is-info"}`}>
                          {s.type === "remove" ? (s.kind === "mistake" ? "Remove · enrolled by mistake" : "Will be dropped") : "Will move"}
                        </span>
                        <button type="button" className="me-link" onClick={() => unstage(c.registrationId)}><FiRotateCcw aria-hidden="true" /> Undo</button>
                      </div>
                    ) : c.locked ? (
                      <span className="me-tag is-muted" title="The result is locked or final, so this course can't be changed here."><FiLock aria-hidden="true" /> Result locked</span>
                    ) : (
                      <div className="me-row-actions">
                        <button type="button" className="am-btn am-btn-small" onClick={() => setModal({ type: "section", entry: c })} disabled={c.sections.length < 2} title={c.sections.length < 2 ? "This course has only one section" : undefined}>Change section</button>
                        <button type="button" className="am-btn am-btn-small me-remove" onClick={() => setModal({ type: "remove", entry: c })}>Remove</button>
                      </div>
                    )}
                  </div>
                  <Issues issue={issue} />
                </li>
              );
            })}
            {adds.map((a) => {
              const issue = issuesFor(a.key);
              return (
                <li key={a.key} className={`me-row is-adding ${issue && !issue.ok ? "has-error" : ""}`}>
                  <div className="me-row-main">
                    <span className="me-code">{a.course.code || "—"}</span>
                    <div className="me-row-text">
                      <strong>{a.course.name}</strong>
                      <small>Section {a.section.name}{a.section.teachers.length ? ` · ${a.section.teachers.join(", ")}` : ""} · {plural(a.course.creditHours, "credit")}</small>
                    </div>
                    <div className="me-row-state">
                      <span className="me-tag is-good">Will be added</span>
                      <button type="button" className="me-link" onClick={() => setAdds((list) => list.filter((x) => x.key !== a.key))}><FiRotateCcw aria-hidden="true" /> Undo</button>
                    </div>
                  </div>
                  <Issues issue={issue} />
                </li>
              );
            })}
          </ul>
        )}

        {dropped.length > 0 && (
          <div className="me-dropped">
            <h4>Dropped this semester</h4>
            <ul className="me-list">
              {dropped.map((c) => {
                const restoring = staged[c.registrationId]?.type === "restore";
                const issue = issuesFor(c.registrationId);
                return (
                  <li key={c.registrationId} className={`me-row is-dropped ${restoring ? "is-adding" : ""} ${issue && !issue.ok ? "has-error" : ""}`}>
                    <div className="me-row-main">
                      <span className="me-code">{c.course.code || "—"}</span>
                      <div className="me-row-text">
                        <strong>{c.course.name}</strong>
                        <small>Section {c.section?.name || "—"} · dropped {shortDate(c.droppedAt)}{c.attendanceRecords || c.marks ? ` · ${[c.attendanceRecords && plural(c.attendanceRecords, "attendance record"), c.marks && plural(c.marks, "mark")].filter(Boolean).join(", ")} kept` : ""}</small>
                      </div>
                      {restoring ? (
                        <div className="me-row-state">
                          <span className="me-tag is-good">Will be restored</span>
                          <button type="button" className="me-link" onClick={() => unstage(c.registrationId)}><FiRotateCcw aria-hidden="true" /> Undo</button>
                        </div>
                      ) : (
                        <button type="button" className="am-btn am-btn-small" onClick={() => stage(c.registrationId, { type: "restore" })} disabled={takenCourseIds.has(String(c.course.id))}>Restore</button>
                      )}
                    </div>
                    <Issues issue={issue} />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="me-card">
        <button type="button" className="me-history-toggle" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
          <span><h3>Change history</h3><small>{history.length ? `${plural(history.length, "change")} recorded for ${student.name.split(" ")[0]}` : "No changes recorded yet"}</small></span>
          {showHistory ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
        </button>
        {showHistory && history.length > 0 && (
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

      {changes.length > 0 && (
        <div className="me-savebar" role="region" aria-label="Unsaved changes">
          <div className="me-savebar-text">
            <strong>{plural(changes.length, "unsaved change")}</strong>
            <span>
              Credit hours {data.credits} → {pendingCredits}
              {checking ? " · checking…" : preview && !preview.canSave ? " · some changes need attention" : preview ? " · all checks passed" : ""}
            </span>
          </div>
          <button type="button" className="am-btn" onClick={discard}>Discard</button>
          <button type="button" className="am-btn am-btn-primary" onClick={() => { setSaveError(""); setModal({ type: "review" }); }}>Review and save</button>
        </div>
      )}

      {modal?.type === "remove" && (
        <RemoveModal entry={modal.entry} student={student} onClose={() => setModal(null)} onConfirm={(kind) => { stage(modal.entry.registrationId, { type: "remove", kind }); setModal(null); }} />
      )}
      {modal?.type === "section" && (
        <SectionModal entry={modal.entry} onClose={() => setModal(null)} onConfirm={(section) => { stage(modal.entry.registrationId, { type: "section", section }); setModal(null); }} />
      )}
      {modal?.type === "add" && (
        <AddCourseModal
          studentId={studentId}
          studentName={student.name}
          exclude={takenCourseIds}
          onClose={() => setModal(null)}
          onAdd={(choice) => { setAdds((list) => [...list, { key: `add-${choice.courseOfferingId}`, ...choice }]); setModal(null); }}
        />
      )}
      {modal?.type === "review" && (
        <ReviewModal student={student} preview={preview} checking={checking} saving={saving} error={saveError || preview?.error} onSave={save} onClose={() => setModal(null)} />
      )}
    </div>
  );
};

export default StudentWorkspace;
