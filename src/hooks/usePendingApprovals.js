import { useState, useEffect, useCallback } from "react";
import axios from "axios";

// Event other components dispatch after approving/rejecting so the badge updates at once.
export const APPROVALS_CHANGED_EVENT = "approvals-changed";
const REFRESH_MS = 60000;

// Number of staff accounts waiting for approval. Returns 0 on any failure so the
// navigation never shows a misleading count.
const usePendingApprovals = () => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) return setCount(0);
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/account-approvals?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCount(Array.isArray(response.data) ? response.data.length : 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Only ask while someone is looking: a hidden tab does not need a fresh badge, and it refreshes on focus anyway.
    const timer = setInterval(() => { if (!document.hidden) refresh(); }, REFRESH_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(APPROVALS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(APPROVALS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return count;
};

export default usePendingApprovals;
