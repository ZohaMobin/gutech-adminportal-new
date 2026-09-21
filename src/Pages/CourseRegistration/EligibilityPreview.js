import React, { useEffect, useState } from "react";
import axios from "axios";
import "./EligibilityPreview.css";

// Asks the server, for every student in the uploaded list, whether they may enrol in this course, and shows the answer
// BEFORE anyone is enrolled: a verdict, the reason in plain words, and every check behind it. An administrator can grant
// a written exception for a student who is held back by a rule that allows one.
const VERDICTS = {
  ELIGIBLE: { label: "Can enrol", tone: "ok" },
  NEEDS_OVERRIDE: { label: "Needs an exception", tone: "warn" },
  BLOCKED: { label: "Cannot enrol", tone: "bad" },
  PENDING_RESULTS: { label: "Waiting for results", tone: "wait" },
  NOT_FOUND: { label: "Not found", tone: "bad" },
};
const RULE_NAMES = {
  OFFERING_VALID: "Course is open to this student", WINDOW_OPEN: "Registration window", HOLDS_CLEAR: "No holds", NOT_DUPLICATE: "Not already registered",
  NOT_ALREADY_PASSED: "Not already passed", PREREQ: "Prerequisites", COREQ: "Co-requisites", ANTIREQ: "Overlapping courses", ATTEMPT_CAP: "Attempt limit",
  CREDIT_LOAD: "Credit load", CAPACITY: "Seats", TIME_CONFLICT: "Timetable",
};
const CAN_WAIVE = ["PREREQ", "COREQ", "ATTEMPT_CAP", "CREDIT_LOAD", "TIME_CONFLICT"];
const STATUS_MARK = { PASS: "✓", FAIL: "✗", PENDING: "…", OVERRIDDEN: "!", SKIPPED: "–" };

const EligibilityPreview = ({ apiUrl, courseId, semester, academicYear, students, headers }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [engineOn, setEngineOn] = useState(null);
  const [open, setOpen] = useState(null);       // roll number whose checks are expanded
  const [granting, setGranting] = useState(null); // roll number an exception is being written for
  const [reason, setReason] = useState("");
  const [grantError, setGrantError] = useState("");

  useEffect(() => {
    axios.get(`${apiUrl}/api/admin/feature-flags`, { headers })
      .then((response) => setEngineOn(response.data.flags.find((f) => f.key === "eligibilityEngine")?.enabled === true))
      .catch(() => setEngineOn(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A new list or course means the last answer no longer applies.
  useEffect(() => { setData(null); setOpen(null); setGranting(null); }, [courseId, semester, academicYear, students]);

  const check = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await axios.post(`${apiUrl}/api/admin/eligibility/preview`, {
        courseId, semester: Number(semester), academicYear: String(academicYear),
        rows: students.map((s) => ({ rollNumber: String(s.rollNumber), section: String(s.section ?? "") })),
      }, { headers });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not check eligibility. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const grant = async (row) => {
    setBusy(true);
    setGrantError("");
    try {
      const waivable = row.checks.filter((c) => c.status === "FAIL" && CAN_WAIVE.includes(c.rule)).map((c) => c.rule);
      for (const ruleWaived of waivable) {
        await axios.post(`${apiUrl}/api/admin/enrollment-overrides`, { studentId: row.rollNumber, courseOfferingId: data.courseOfferingId, ruleWaived, reason }, { headers });
      }
      setGranting(null);
      setReason("");
      await check();
    } catch (err) {
      setGrantError(err.response?.data?.message || "Could not record the exception.");
      setBusy(false);
    }
  };

  const summary = data?.summary;
  return (
    <div className="elig-panel">
      <div className="elig-head">
        <div>
          <h3>Check eligibility</h3>
          <p>See who can be enrolled before you register anyone, and why anyone cannot.</p>
        </div>
        <button type="button" className="elig-btn elig-btn-primary" onClick={check} disabled={busy || students.length === 0}>
          {busy && !data ? "Checking…" : data ? "Check again" : "Check eligibility"}
        </button>
      </div>

      {engineOn === false && (
        <div className="elig-note">These rules are not being enforced yet, so registering will not be blocked. This check shows what would happen once they are switched on.</div>
      )}
      {error && <div className="elig-error" role="alert">{error}</div>}

      {summary && (
        <>
          <div className="elig-summary">
            {Object.entries({ eligible: "ELIGIBLE", needsOverride: "NEEDS_OVERRIDE", blocked: "BLOCKED", pendingResults: "PENDING_RESULTS", notFound: "NOT_FOUND" })
              .filter(([key]) => summary[key] > 0)
              .map(([key, verdict]) => <span key={key} className={`elig-chip elig-${VERDICTS[verdict].tone}`}>{summary[key]} {VERDICTS[verdict].label.toLowerCase()}</span>)}
          </div>
          <div className="elig-table-wrap">
            <table className="elig-table">
              <thead><tr><th>Roll number</th><th>Section</th><th>Result</th><th>Why</th><th /></tr></thead>
              <tbody>
                {data.results.map((row) => {
                  const v = VERDICTS[row.verdict] || VERDICTS.NOT_FOUND;
                  const canGrant = row.verdict === "NEEDS_OVERRIDE" && row.checks.some((c) => c.status === "FAIL" && CAN_WAIVE.includes(c.rule));
                  return (
                    <React.Fragment key={`${row.rollNumber}-${row.section}`}>
                      <tr>
                        <td>{row.rollNumber}</td>
                        <td>{row.section || "—"}{row.sectionFound === false && <span className="elig-hint"> (no such section)</span>}</td>
                        <td><span className={`elig-chip elig-${v.tone}`}>{v.label}</span></td>
                        <td className="elig-why">{row.message}</td>
                        <td className="elig-actions">
                          {row.checks.length > 0 && <button type="button" className="elig-link" onClick={() => setOpen(open === row.rollNumber ? null : row.rollNumber)}>{open === row.rollNumber ? "Hide checks" : "All checks"}</button>}
                          {canGrant && <button type="button" className="elig-btn" onClick={() => { setGranting(row.rollNumber); setReason(""); setGrantError(""); }}>Grant exception…</button>}
                        </td>
                      </tr>
                      {open === row.rollNumber && (
                        <tr className="elig-detail-row"><td colSpan={5}>
                          <ul className="elig-checks">
                            {row.checks.map((c) => (
                              <li key={c.rule} className={`elig-check elig-check-${c.status.toLowerCase()}`}>
                                <span className="elig-mark" aria-hidden="true">{STATUS_MARK[c.status]}</span>
                                <strong>{RULE_NAMES[c.rule] || c.rule}:</strong> {c.message}
                              </li>
                            ))}
                          </ul>
                        </td></tr>
                      )}
                      {granting === row.rollNumber && (
                        <tr className="elig-detail-row"><td colSpan={5}>
                          <div className="elig-grant">
                            <label htmlFor={`reason-${row.rollNumber}`}>Why is an exception being made for {row.rollNumber}?</label>
                            <textarea id={`reason-${row.rollNumber}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="For example: approved by the head of department; transfer credit under review" />
                            <p className="elig-hint">This permits one enrolment in this course, lasts until the end of the term, and is recorded with your name. It does not count the prerequisite as passed.</p>
                            {grantError && <div className="elig-error" role="alert">{grantError}</div>}
                            <div className="elig-grant-buttons">
                              <button type="button" className="elig-btn" onClick={() => setGranting(null)} disabled={busy}>Cancel</button>
                              <button type="button" className="elig-btn elig-btn-primary" onClick={() => grant(row)} disabled={busy || reason.trim().length < 5}>{busy ? "Saving…" : "Grant exception"}</button>
                            </div>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default EligibilityPreview;
