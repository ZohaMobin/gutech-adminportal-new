import Loading from "../../Components/Loading/Loading";
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
  const [busyId, setBusyId] = useState(null);

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

  const review = async (account, decision) => {
    let body = {};
    if (decision === "reject") {
      // Cancel aborts; an empty reason is allowed.
      const reason = window.prompt(`Reject ${account.name}? Optionally give a reason (shown to the applicant):`, "");
      if (reason === null) return;
      body = { reason };
    } else if (!window.confirm(`Approve ${account.name} as ${account.role}?`)) {
      return;
    }
    try {
      setBusyId(account._id);
      await axios.post(`${API_BASE_URL}/api/account-approvals/${account._id}/${decision}`, body, { headers });
      setAccounts((prev) => prev.filter((a) => a._id !== account._id));
      window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${decision} account`);
      fetchAccounts();
    } finally {
      setBusyId(null);
    }
  };

  const isRejectedTab = tab === "rejected";

  return (
    <div className="aa-page">
      <div className="aa-page-header">
        <h1>Account Approvals</h1>
      </div>

      <div className="approval-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`approval-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <Loading variant="list" rows={3} label="Loading accounts" />
      ) : accounts.length === 0 ? (
        <p>{isRejectedTab ? "No rejected accounts." : "No accounts are waiting for approval."}</p>
      ) : (
        <div className="programs-table-container">
          <table className="programs-table">
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
                    <button className="btn-primary" disabled={busyId === account._id} onClick={() => review(account, "approve")}>
                      {isRejectedTab ? "Approve anyway" : "Approve"}
                    </button>{" "}
                    {!isRejectedTab && (
                      <button className="btn-secondary" disabled={busyId === account._id} onClick={() => review(account, "reject")}>
                        Reject
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccountApprovalsPage;
