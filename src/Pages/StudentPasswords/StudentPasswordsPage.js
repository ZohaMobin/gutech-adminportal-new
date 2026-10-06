import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FiSearch, FiX } from "react-icons/fi";
import Loading from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { useDepartmentsAndPrograms } from "../../hooks/useDepartmentsAndPrograms";
import { semesterLabel } from "../../utils/semester";
import { messageOf } from "../../utils/apiMessage";
import { PasswordCell, PasswordsBar, DownloadModal, GenerateModal } from "./PasswordParts";
import { issuePasswords, downloadPasswordsCsv, csvFileName } from "./passwordApi";
import "../Administrators/AdministratorsPage.css";
import "./StudentPasswordsPage.css";

const API = process.env.REACT_APP_BACKEND_URL;
const NO_FILTERS = { department: "", program: "", semester: "", search: "" };
const idOf = (ref) => (ref && typeof ref === "object" ? ref._id || ref.id : ref);

// Student passwords in one place: find a student and show their password (the "I forgot" case at the office), or give a
// whole class passwords and download them as a CSV. Everything acts on exactly the students in the current list.
const StudentPasswordsPage = () => {
  const { departments, programs, loading: optionsLoading } = useDepartmentsAndPrograms();
  const [filters, setFilters] = useState(NO_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState("all"); // all | missing
  const [semesters, setSemesters] = useState([]);
  const [students, setStudents] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'generate' | 'download', result? }
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [modalError, setModalError] = useState("");

  // Search as you type, a moment after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.search === searchInput.trim() ? f : { ...f, search: searchInput.trim() })), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    try {
      setRefreshing(true);
      setLoadError("");
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ""));
      const { data } = await axios.get(`${API}/api/students`, { params, headers: { Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` } });
      setStudents(data.students || []);
    } catch (err) {
      setLoadError(messageOf(err, "Could not load students."));
      setStudents((current) => current || []);
    } finally {
      setRefreshing(false);
    }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!filters.program) { setSemesters([]); return; }
    axios.get(`${API}/api/student-directory/semesters`, { params: { program: filters.program } })
      .then(({ data }) => setSemesters(data.semesters || []))
      .catch(() => setSemesters([]));
  }, [filters.program]);

  const programOptions = useMemo(
    () => (filters.department ? programs.filter((p) => String(idOf(p.department)) === String(filters.department)) : programs),
    [programs, filters.department]
  );

  const setFilter = (name, value) => setFilters((f) => ({
    ...f,
    [name]: value,
    ...(name === "department" && { program: "", semester: "" }),
    ...(name === "program" && { semester: "" }),
  }));
  const clearAll = () => { setFilters(NO_FILTERS); setSearchInput(""); setStatus("all"); };
  const filtered = Object.values(filters).some(Boolean);

  // ---- the list and what the summary says about it ----
  const list = students || [];
  const counts = { all: list.length, missing: list.filter((s) => !s.passwordIssuedAt).length };
  // New students get a password when they are added, so "needs a password" only matters while some still do
  // (the one-time switch-over, or a server without its key). Once nobody needs one, the tabs go away.
  const showTabs = counts.missing > 0 || status !== "all";
  const rows = status === "missing" ? list.filter((s) => !s.passwordIssuedAt) : list;

  const departmentName = departments.find((d) => d._id === filters.department)?.name;
  const programName = programs.find((p) => p._id === filters.program)?.name;
  const scopeParts = [programName || departmentName, filters.semester !== "" ? semesterLabel(Number(filters.semester)) : null];
  const scope = filters.search ? `results for “${filters.search}”` : scopeParts.some(Boolean) ? scopeParts.filter(Boolean).join(" · ") : "the directory";
  const selection = { filters };
  const downloadName = csvFileName(filters.search ? ["search", filters.search] : scopeParts);

  const markIssued = (studentId, issuedAt) =>
    setStudents((current) => current.map((s) => (s._id === studentId ? { ...s, passwordIssuedAt: issuedAt || new Date().toISOString() } : s)));

  const closeModal = () => { setModal(null); setModalError(""); setBusy(false); };

  const generateMissing = async () => {
    try {
      setBusy(true);
      setModalError("");
      const result = await issuePasswords(selection, { onlyMissing: true });
      // Straight on to the file, so issuing and handing out is one step.
      try {
        await downloadPasswordsCsv(selection, downloadName);
        setModal({ type: "generate", result: { ...result, fileName: downloadName } });
      } catch (err) {
        setModal({ type: "generate", result: { ...result, downloadError: messageOf(err, "The CSV didn't download.") } });
      }
      load();
    } catch (err) {
      setModalError(messageOf(err, "Could not generate passwords."));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    try {
      setDownloading(true);
      setModalError("");
      await downloadPasswordsCsv(selection, downloadName);
      showToast("Passwords downloaded. Keep the file private.", TOAST_TYPES.SUCCESS);
      if (modal?.type === "download") closeModal();
      if (modal?.type === "generate") setModal((m) => ({ ...m, result: { ...m.result, fileName: downloadName, downloadError: undefined } }));
    } catch (err) {
      const message = messageOf(err, "Could not download the passwords.");
      if (modal?.type === "download") setModalError(message);
      else showToast(message, TOAST_TYPES.ERROR);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="spp page-shell">
      <PageHeader
        title="Student Passwords"
        subtitle="Give each student a password and look it up whenever they need it. Students can't change their own, and every look-up is recorded."
      />

      <div className="spp-toolbar">
        <label className="spp-search">
          <FiSearch aria-hidden="true" />
          <input
            type="search"
            placeholder="Find a student by name, email or roll number"
            aria-label="Find a student"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoFocus
          />
          {searchInput && (
            <button type="button" className="spp-search-clear" aria-label="Clear search" onClick={() => setSearchInput("")}><FiX /></button>
          )}
        </label>

        <div className="spp-filters">
          <select aria-label="Department" value={filters.department} onChange={(e) => setFilter("department", e.target.value)} disabled={optionsLoading}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <select aria-label="Program" value={filters.program} onChange={(e) => setFilter("program", e.target.value)} disabled={optionsLoading}>
            <option value="">All programs</option>
            {programOptions.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <select aria-label="Semester" value={filters.semester} onChange={(e) => setFilter("semester", e.target.value)} disabled={!filters.program || semesters.length === 0}>
            <option value="">All semesters</option>
            {semesters.map((n) => <option key={n} value={n}>{semesterLabel(n)}</option>)}
          </select>
          {(filtered || status !== "all") && (
            <button type="button" className="spp-clear" onClick={clearAll}>Clear</button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="error-message" role="alert">{loadError} <button type="button" className="am-btn am-btn-small" onClick={load}>Try again</button></div>
      )}

      {students !== null && (
        <PasswordsBar
          total={counts.all}
          missing={counts.missing}
          scope={scope}
          downloading={downloading && modal?.type !== "download"}
          onGenerate={() => setModal({ type: "generate" })}
          onDownload={() => setModal({ type: "download" })}
        />
      )}

      <section className="spp-card" aria-label="Students">
        {showTabs && (
          <div className="spp-card-head">
            <div className="am-tabs" role="tablist" aria-label="Show">
              {[["all", "All students"], ["missing", "Needs a password"]].map(([key, label]) => (
                <button key={key} role="tab" aria-selected={status === key} className={`am-tab ${status === key ? "is-active" : ""}`} onClick={() => setStatus(key)}>
                  {label} <span className="am-count">{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {students === null ? (
          <Loading variant="table" rows={6} label="Loading students" />
        ) : rows.length === 0 ? (
          <div className="spp-empty">
            <strong>
              {list.length === 0
                ? filtered ? "No students match" : "No students yet"
                : "Everyone here has a password"}
            </strong>
            <span>
              {list.length === 0
                ? filtered ? "Try a different name or roll number, or clear the filters." : "Students appear here once they are imported."
                : "Nobody in this list needs one."}
            </span>
            {(filtered || status !== "all") && <button type="button" className="sp-btn" onClick={clearAll}>Clear filters</button>}
          </div>
        ) : (
          <div className={`spp-table-wrap ${refreshing ? "is-refreshing" : ""}`} aria-busy={refreshing}>
            <table className="spp-table">
              <thead>
                <tr>
                  <th>Roll number</th>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Semester</th>
                  <th>Password</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr key={student._id}>
                    <td className="spp-roll">{student.rollNumber}</td>
                    <td>
                      <div className="spp-name">{student.name}</div>
                      <div className="spp-email">{student.email}</div>
                    </td>
                    <td title={student.program?.name}>{student.program?.code || student.program?.name || "—"}</td>
                    <td>{student.currentSemester !== undefined && student.currentSemester !== null ? semesterLabel(student.currentSemester) : "—"}</td>
                    <td className="sp-col"><PasswordCell student={student} onIssued={markIssued} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modal?.type === "download" && (
        <DownloadModal count={counts.all} scope={scope} busy={downloading} error={modalError} onConfirm={download} onClose={closeModal} />
      )}
      {modal?.type === "generate" && (
        <GenerateModal
          missing={counts.missing}
          total={counts.all}
          scope={scope}
          result={modal.result}
          busy={busy}
          error={modalError}
          downloading={downloading}
          onConfirm={generateMissing}
          onDownload={download}
          onClose={closeModal}
        />
      )}
    </div>
  );
};

export default StudentPasswordsPage;
