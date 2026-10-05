import Loading, { BusyLabel } from "../../Components/Loading/Loading";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { ConfirmModal } from "../Administrators/AdminModals";
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import "./AccountApprovalsPage.css";
import { APPROVALS_CHANGED_EVENT } from "../../hooks/usePendingApprovals";
import { initialsOf, formatDay, formatDayTime, waitingFor } from "./approvalFormat";

const API = process.env.REACT_APP_BACKEND_URL;
const PAGE_SIZE = 25;

// Staff who registered themselves on the teacher portal and wait to be let in. Approving lets them sign in. Rejecting
// removes the request (their email can be used again); every decision stays in the History tab.
const WaitingList = ({ headers, onCountChange }) => {
  const [accounts, setAccounts] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // { account, decision }
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/api/account-approvals?status=pending`, { headers });
      setAccounts(response.data);
      onCountChange(response.data.length);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Could not load the waiting requests");
      setAccounts((current) => current || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.Authorization]);

  useEffect(() => { load(); }, [load]);

  const start = (account, decision) => { setReason(""); setReviewError(""); setPending({ account, decision }); };

  const review = async () => {
    const { account, decision } = pending;
    try {
      setReviewing(true);
      setReviewError("");
      await axios.post(`${API}/api/account-approvals/${account._id}/${decision}`, decision === "reject" ? { reason } : {}, { headers });
      const rest = accounts.filter((a) => a._id !== account._id);
      setAccounts(rest);
      onCountChange(rest.length, true);
      window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
      showToast(decision === "approve" ? `${account.name} approved. They can sign in now.` : `${account.name}'s request was rejected and removed.`, TOAST_TYPES.SUCCESS);
      setPending(null);
    } catch (err) {
      setReviewError(err.response?.data?.message || `Could not ${decision} this request`);
      load();
    } finally {
      setReviewing(false);
    }
  };

  if (accounts === null) return <Loading variant="list" rows={3} label="Loading requests" />;

  return (
    <>
      {error && <div className="error-message" role="alert">{error}</div>}
      {accounts.length === 0 ? (
        <div className="am-empty am-empty-inline">
          <p>No requests are waiting. New sign-ups from the teacher portal appear here.</p>
        </div>
      ) : (
        <ul className="am-list">
          {accounts.map((account) => (
            <li key={account._id} className="am-row">
              <div className="am-avatar" aria-hidden="true">{initialsOf(account.name)}</div>
              <div className="am-identity">
                <div className="am-name">
                  {account.name}
                  {account.applicationCount > 1 && <span className="am-badge am-badge-attempt">Attempt {account.applicationCount}</span>}
                </div>
                <div className="am-email">{account.email}</div>
              </div>
              <div className="am-meta">
                <span className="am-meta-label">Employee ID</span>
                <span>{account.employeeId || "—"}</span>
              </div>
              <div className="am-meta am-meta-wide">
                <span className="am-meta-label">Requested</span>
                <span>{formatDay(account.createdAt)} <span className="aa-ago">· {waitingFor(account.createdAt)}</span></span>
              </div>
              <div className="am-actions">
                <button className="am-btn am-btn-small" onClick={() => start(account, "reject")} aria-label={`Reject ${account.name}`}>Reject</button>
                <button className="am-btn am-btn-small am-btn-primary" onClick={() => start(account, "approve")} aria-label={`Approve ${account.name}`}>Approve</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pending && (
        <ConfirmModal
          title={pending.decision === "approve" ? "Approve request" : "Reject request"}
          body={
            pending.decision === "approve"
              ? `Approve ${pending.account.name} as a teacher? They will be able to sign in straight away.`
              : `Reject ${pending.account.name}? Their request is removed, so ${pending.account.email} can be used again. The decision stays in the History tab.`
          }
          confirmLabel={pending.decision === "approve" ? "Approve" : "Reject request"}
          busyText={pending.decision === "approve" ? "Approving…" : "Rejecting…"}
          danger={pending.decision === "reject"}
          busy={reviewing}
          error={reviewError}
          onConfirm={review}
          onClose={() => setPending(null)}
        >
          {pending.decision === "reject" && (
            <label className="am-field">
              <span>Reason <em>(optional, kept in History)</em></span>
              <textarea rows="3" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={reviewing} autoFocus />
            </label>
          )}
        </ConfirmModal>
      )}
    </>
  );
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

// Every decision, newest first: who was approved or rejected, when, by whom, and why.
const History = ({ headers, refreshKey }) => {
  const [decision, setDecision] = useState("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState(null);
  const [meta, setMeta] = useState({ total: 0, pages: 1, counts: { approved: 0, rejected: 0 } });
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (wantedPage) => {
    const ticket = ++latest.current;
    try {
      wantedPage > 1 ? setLoadingMore(true) : setItems((current) => current);
      const response = await axios.get(`${API}/api/account-approvals/history`, { headers, params: { decision, q: search || undefined, page: wantedPage, limit: PAGE_SIZE } });
      if (ticket !== latest.current) return; // a newer search has replaced this one
      const { items: rows, ...rest } = response.data;
      setItems((current) => (wantedPage > 1 ? [...(current || []), ...rows] : rows));
      setMeta(rest);
      setPage(wantedPage);
      setError("");
    } catch (err) {
      if (ticket !== latest.current) return;
      setError(err.response?.data?.message || "Could not load the history");
      setItems((current) => current || []);
    } finally {
      if (ticket === latest.current) setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers.Authorization, decision, search]);

  useEffect(() => { load(1); }, [load, refreshKey]);

  const total = meta.counts.approved + meta.counts.rejected;
  const countOf = (id) => (id === "all" ? total : meta.counts[id]);

  return (
    <>
      <div className="am-toolbar">
        <input
          className="am-search"
          type="search"
          placeholder="Search by name, email or employee ID"
          aria-label="Search the history"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="am-tabs" role="group" aria-label="Show">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={decision === f.id} className={`am-tab ${decision === f.id ? "is-active" : ""}`} onClick={() => setDecision(f.id)}>
              {f.label} <span className="am-count">{countOf(f.id)}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}

      {items === null ? (
        <Loading variant="list" rows={4} label="Loading the history" />
      ) : items.length === 0 ? (
        <div className="am-empty am-empty-inline">
          <p>{search || decision !== "all" ? "No decisions match that." : "No decisions yet. Approved and rejected requests are recorded here."}</p>
        </div>
      ) : (
        <>
          <ul className="am-list">
            {items.map((entry) => (
              <li key={entry._id} className={`am-row aa-entry is-${entry.decision}`}>
                <div className="aa-mark" aria-hidden="true">
                  {entry.decision === "approved" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  )}
                </div>
                <div className="am-identity">
                  <div className="am-name">
                    {entry.applicantName}
                    <span className={`am-badge aa-pill is-${entry.decision}`}>{entry.decision === "approved" ? "Approved" : "Rejected"}</span>
                    {entry.attempt > 1 && <span className="am-badge am-badge-attempt">Attempt {entry.attempt}</span>}
                  </div>
                  <div className="am-email">{entry.applicantEmail}</div>
                </div>
                <div className="am-meta">
                  <span className="am-meta-label">Employee ID</span>
                  <span>{entry.employeeId || "—"}</span>
                </div>
                <div className="am-meta am-meta-wide">
                  <span className="am-meta-label">{entry.decision === "approved" ? "Approved" : "Rejected"}</span>
                  <span>{formatDayTime(entry.createdAt)}</span>
                </div>
                <div className="am-meta am-meta-wide">
                  <span className="am-meta-label">By</span>
                  <span>{entry.reviewerName || "Unknown"}</span>
                </div>
                {entry.decision === "rejected" && (
                  <p className={`aa-reason ${entry.reason ? "" : "is-none"}`}>
                    <span>Reason</span> {entry.reason || "No reason given"}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <div className="aa-more">
            <span>Showing {items.length} of {meta.total}</span>
            {page < meta.pages && (
              <button type="button" className="am-btn am-btn-small" onClick={() => load(page + 1)} disabled={loadingMore}>
                <BusyLabel busy={loadingMore} busyText="Loading…" idle="Show more" />
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
};

const AccountApprovalsPanel = () => {
  const adminToken = sessionStorage.getItem("adminToken");
  const headers = React.useMemo(() => ({ Authorization: `Bearer ${adminToken}` }), [adminToken]);
  const [view, setView] = useState("waiting");
  const [historyOpened, setHistoryOpened] = useState(false);
  const [waiting, setWaiting] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);

  // A decision on the Waiting tab changes the History, so the next visit to it reloads.
  const onCountChange = useCallback((count, decided) => {
    setWaiting(count);
    if (decided) setHistoryKey((k) => k + 1);
  }, []);

  return (
    <div className="aa-page">
      <p className="am-panel-intro">
        Staff who registered themselves on the teacher portal. Approve a request to let them sign in. Rejecting removes it, so the same email can be used again, and the decision stays in History.
      </p>

      <div className="am-toolbar am-toolbar-tabs">
        <div className="am-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={view === "waiting"} className={`am-tab ${view === "waiting" ? "is-active" : ""}`} onClick={() => setView("waiting")}>
            Waiting {waiting !== null && <span className="am-count">{waiting}</span>}
          </button>
          <button type="button" role="tab" aria-selected={view === "history"} className={`am-tab ${view === "history" ? "is-active" : ""}`} onClick={() => { setView("history"); setHistoryOpened(true); }}>
            History
          </button>
        </div>
      </div>

      {/* Both stay mounted once shown, so switching tabs does not refetch or lose the search. History loads on first visit. */}
      <div hidden={view !== "waiting"}><WaitingList headers={headers} onCountChange={onCountChange} /></div>
      {historyOpened && <div hidden={view !== "history"}><History headers={headers} refreshKey={historyKey} /></div>}
    </div>
  );
};

export default AccountApprovalsPanel;
