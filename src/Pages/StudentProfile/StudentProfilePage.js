import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiChevronRight, FiMoreHorizontal, FiBookOpen, FiKey, FiClock } from "react-icons/fi";
import Loading from "../../Components/Loading/Loading";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { messageOf } from "../../utils/apiMessage";
import { DeactivateModal, ReactivateModal } from "../StudentDirectory/StudentAccountModals";
import { getEnrollment, initialsOf, plural, shortDate } from "../ManageEnrollment/enrollmentApi";
import CoursesPanel from "./CoursesPanel";
import PasswordTab from "./PasswordTab";
import HistoryList from "./HistoryList";
import EditDetailsModal from "./EditDetailsModal";
import "../Administrators/AdministratorsPage.css";
import "../StudentPasswords/StudentPasswordsPage.css";
import "../ManageEnrollment/ManageEnrollmentPage.css";
import "./StudentProfilePage.css";

const TABS = [
  { id: "courses", label: "Courses", icon: FiBookOpen },
  { id: "password", label: "Password", icon: FiKey },
  { id: "history", label: "History", icon: FiClock },
];
const LEAVE_WARNING = "You have unsaved course changes for this student. Leave without saving?";

// One page per student: who they are and their status at the top (with account actions in the ⋯ menu), then their
// courses, sign-in password and history as tabs. Reached from Student Directory or Manage Enrollment's search.
const StudentProfilePage = () => {
  const { studentId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const tab = TABS.some((t) => t.id === params.get("tab")) ? params.get("tab") : "courses";
  const backTo = location.state?.from || "/student-directory";
  const backLabel = backTo.startsWith("/manage-enrollment") ? "Manage Enrollment" : "Student Directory";

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null);   // 'edit' | 'deactivate' | 'reactivate'
  const menuRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setData(await getEnrollment(studentId));
    } catch (err) {
      setError(messageOf(err, "Could not load this student."));
    }
  }, [studentId]);
  useEffect(() => { setData(null); load(); }, [load]);

  // Closing the tab or reloading with unsaved course changes asks first.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const goBack = (e) => {
    e.preventDefault();
    if (!dirty || window.confirm(LEAVE_WARNING)) navigate(backTo);
  };
  const setTab = (id) => setParams((p) => { const next = new URLSearchParams(p); if (id === "courses") next.delete("tab"); else next.set("tab", id); return next; }, { replace: true, state: location.state });
  const onDirtyChange = useCallback((value) => setDirty(value), []);

  if (error) {
    return (
      <div className="pf page-shell">
        <nav className="pf-crumbs"><Link to={backTo}>{backLabel}</Link></nav>
        <div className="me-card"><div className="error-message" role="alert">{error} <button type="button" className="am-btn am-btn-small" onClick={load}>Try again</button></div></div>
      </div>
    );
  }
  if (!data) return <div className="pf page-shell"><div className="me-card"><Loading variant="list" rows={5} label="Loading student" /></div></div>;

  const { student, term, courses } = data;
  const inactive = student.account?.status === "inactive";
  const modalStudent = { _id: student.id, name: student.name, rollNumber: student.rollNumber, program: student.program };
  const afterAccountChange = (message) => { setModal(null); showToast(`${student.name}: ${message}`, TOAST_TYPES.SUCCESS); load(); };

  return (
    <div className="pf page-shell">
      <nav className="pf-crumbs" aria-label="Breadcrumb">
        <a href={backTo} onClick={goBack}>{backLabel}</a>
        <FiChevronRight aria-hidden="true" />
        <span aria-current="page">{student.name}</span>
      </nav>

      <header className="pf-head">
        <div className={`pf-avatar ${inactive ? "is-inactive" : ""}`} aria-hidden="true">{initialsOf(student.name)}</div>
        <div className="pf-who">
          <div className="pf-name-row">
            <h1>{student.name}</h1>
            {inactive
              ? <span className="pf-status is-inactive">Inactive · {student.account.categoryLabel || "Deactivated"}</span>
              : <span className="pf-status is-active">Active</span>}
          </div>
          <p className="pf-meta">{[student.rollNumber, student.program?.name || student.program?.code, student.currentSemester !== null && student.currentSemester !== undefined ? `Semester ${student.currentSemester}` : null].filter(Boolean).join(" · ")}</p>
          {inactive ? (
            <p className="pf-inactive-note">
              {student.account.category === "suspended" ? "Suspended" : "Deactivated"} {shortDate(student.account.deactivatedAt)}{student.account.note ? ` · ${student.account.note}` : ""}.{" "}
              {student.account.category === "suspended"
                ? "They can't sign in. Their courses are kept, and teachers see a \"Suspended\" tag."
                : "They can't sign in, and courses can't be added until they're reactivated."}
            </p>
          ) : (
            <p className="pf-facts">{term.label} · {plural(courses.length, "course")} · {data.credits} credit hours</p>
          )}
        </div>
        <div className="am-menu pf-menu" ref={menuRef}>
          <button type="button" className="pf-menu-btn" aria-label="Account actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <FiMoreHorizontal aria-hidden="true" />
          </button>
          {menuOpen && (
            <div className="am-menu-list" role="menu">
              <button role="menuitem" onClick={() => { setMenuOpen(false); setModal("edit"); }}>Edit details…</button>
              {inactive
                ? <button role="menuitem" onClick={() => { setMenuOpen(false); setModal("reactivate"); }}>Reactivate…</button>
                : <button role="menuitem" className="is-danger" onClick={() => { setMenuOpen(false); setModal("deactivate"); }}>Deactivate…</button>}
            </div>
          )}
        </div>
      </header>

      <div className="pf-tabs" role="tablist" aria-label={`${student.name}'s profile`}>
        {TABS.map((t) => {
          const Icon = t.icon;
          const count = t.id === "courses" ? courses.length : t.id === "history" ? data.history.length : null;
          return (
            <button key={t.id} role="tab" id={`pf-tab-${t.id}`} aria-controls={`pf-panel-${t.id}`} aria-selected={tab === t.id} className={`pf-tab ${tab === t.id ? "is-active" : ""}`} onClick={() => setTab(t.id)}>
              <Icon aria-hidden="true" /> {t.label}
              {count !== null && <span className="pf-count">{count}</span>}
              {t.id === "courses" && dirty && <span className="pf-dot" title="Unsaved changes" />}
            </button>
          );
        })}
      </div>

      {/* Every panel stays mounted, so unsaved course changes survive a look at another tab. */}
      <div role="tabpanel" id="pf-panel-courses" aria-labelledby="pf-tab-courses" hidden={tab !== "courses"}>
        <CoursesPanel studentId={studentId} data={data} onSaved={(fresh) => setData(fresh)} onDirtyChange={onDirtyChange} />
      </div>
      <div role="tabpanel" id="pf-panel-password" aria-labelledby="pf-tab-password" hidden={tab !== "password"}>
        <PasswordTab student={student} onIssued={(_id, issuedAt) => setData((d) => ({ ...d, student: { ...d.student, passwordIssuedAt: issuedAt || new Date().toISOString() } }))} />
      </div>
      <div role="tabpanel" id="pf-panel-history" aria-labelledby="pf-tab-history" hidden={tab !== "history"}>
        <HistoryList history={data.history} firstName={student.name.split(" ")[0]} />
      </div>

      {modal === "edit" && <EditDetailsModal student={student} onClose={() => setModal(null)} onDone={afterAccountChange} />}
      {modal === "deactivate" && <DeactivateModal student={modalStudent} onClose={() => setModal(null)} onDone={afterAccountChange} />}
      {modal === "reactivate" && <ReactivateModal student={modalStudent} onClose={() => setModal(null)} onDone={afterAccountChange} />}
    </div>
  );
};

export default StudentProfilePage;
