import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../Programs/ProgramsPage.css";

const AccountApprovalsPage = () => {
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
      const response = await axios.get(`${API_BASE_URL}/api/account-approvals?status=pending`, { headers });
      setAccounts(response.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load pending accounts");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE_URL, adminToken]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const review = async (account, decision) => {
    const verb = decision === "approve" ? "approve" : "reject";
    if (!window.confirm(`Are you sure you want to ${verb} ${account.name} (${account.role})?`)) return;
    try {
      setBusyId(account._id);
      await axios.post(`${API_BASE_URL}/api/account-approvals/${account._id}/${decision}`, {}, { headers });
      setAccounts((prev) => prev.filter((a) => a._id !== account._id));
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${verb} account`);
      fetchAccounts();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="programs-page">
      <div className="page-header">
        <h1>Account Approvals</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : accounts.length === 0 ? (
        <p>No accounts are waiting for approval.</p>
      ) : (
        <div className="programs-table-container"><table className="programs-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Employee ID</th>
              <th>Requested</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account._id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>{account.role}</td>
                <td>{account.employeeId || "-"}</td>
                <td>{new Date(account.createdAt).toLocaleDateString()}</td>
                <td>
                  <button className="btn-primary" disabled={busyId === account._id} onClick={() => review(account, "approve")}>
                    Approve
                  </button>{" "}
                  <button className="btn-secondary" disabled={busyId === account._id} onClick={() => review(account, "reject")}>
                    Reject
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
};

export default AccountApprovalsPage;
