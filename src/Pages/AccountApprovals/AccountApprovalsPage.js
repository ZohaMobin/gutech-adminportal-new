import Loading from "../../Components/Loading/Loading";
import PageHeader from "../../Components/PageHeader/PageHeader";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import { ConfirmModal } from "../Administrators/AdminModals";
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../Programs/ProgramsPage.css";
import "./AccountApprovalsPage.css";
import { APPROVALS_CHANGED_EVENT } from "../../hooks/usePendingApprovals";

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "rejected", label: "Rejected" },
];

const AccountApprovalsPage = () => {
  const [tab, setTab] = useState("pending");
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The account being approved or rejected, and which of the two: { account, decision }
  const [pending, setPending] = useState(null);
  const [reason, setReason] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const adminToken = sessionStorage.getItem("adminToken");
  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;
  const headers = { Authorization: `Bearer ${adminToken}` };

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/account-approvals?status=${tab}`, { headers });
      setAccounts(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL, adminToken, tab]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const startReview = (account, decision) => {
    setReason("");
    setReviewError("");
    setPending({ account, decision });
  };

  const review = async () => {
    const { account, decision } = pending;
    try {
      setReviewing(true);
      setReviewError("");
      // An empty reason is allowed when rejecting.
      await axios.post(`${API_BASE_URL}/api/account-approvals/${account._id}/${decision}`, decision === "reject" ? { reason } : {}, { headers });
      setAccounts((prev) => prev.filter((a) => a._id !== account._id));
      window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
      showToast(decision === "approve" ? `${account.name} approved` : `${account.name} rejected`, TOAST_TYPES.SUCCESS);
      setPending(null);
    } catch (err) {
      setReviewError(err.response?.data?.message || `Failed to ${decision} account`);
      fetchAccounts();
    } finally {
      setReviewing(false);
    }
  };

  const isRejectedTab = tab === "rejected";

  return (
    <div className="aa-page page-shell">
      <PageHeader title="Account Approvals" />

      <div className="pk-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`pk-tab ${tab === t.id ? "is-on" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error-message" role="alert">{error}</div>}

      {loading ? (
        <Loading variant="list" rows={3} label="Loading accounts" />
      ) : accounts.length === 0 ? (
        <p className="pk-empty">{isRejectedTab ? "No rejected accounts." : "No accounts are waiting for approval."}</p>
      ) : (
        <div className="pk-table-wrap">
          <table className="pk-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Employee ID</th>
                <th>{isRejectedTab ? "Rejection reason" : "Requested"}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account._id}>
                  <td>
                    {account.name}
                    {account.applicationCount > 1 && (
                      <span className="attempt-badge">Attempt {account.applicationCount}</span>
                    )}
                  </td>
                  <td>{account.email}</td>
                  <td>{account.role}</td>
                  <td>{account.employeeId || "-"}</td>
                  <td>
                    {isRejectedTab
                      ? account.rejectionReason || "No reason given"
                      : new Date(account.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="row-btn row-btn--primary" onClick={() => startReview(account, "approve")} aria-label={`${isRejectedTab ? "Approve anyway" : "Approve"} ${account.name}`}>
                        {isRejectedTab ? "Approve anyway" : "Approve"}
                      </button>
                      {!isRejectedTab && (
                        <button className="row-btn row-btn--danger" onClick={() => startReview(account, "reject")} aria-label={`Reject ${account.name}`}>
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <ConfirmModal
          title={pending.decision === "approve" ? "Approve account" : "Reject account"}
          body={
            pending.decision === "approve"
              ? `Approve ${pending.account.name} as ${pending.account.role}? They will be able to sign in.`
              : `Reject ${pending.account.name}? They will not be able to sign in.`
          }
          confirmLabel={pending.decision === "approve" ? "Approve" : "Reject"}
          busyText={pending.decision === "approve" ? "Approving…" : "Rejecting…"}
          danger={pending.decision === "reject"}
          busy={reviewing}
          error={reviewError}
          onConfirm={review}
          onClose={() => setPending(null)}
        >
          {pending.decision === "reject" && (
            <label className="am-field">
              <span>Reason <em>(optional, shown to the applicant)</em></span>
              <textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} disabled={reviewing} autoFocus />
            </label>
          )}
        </ConfirmModal>
      )}
    </div>
  );
};

export default AccountApprovalsPage;
