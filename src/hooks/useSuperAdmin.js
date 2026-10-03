import { useState, useEffect } from "react";
import axios from "axios";

const readStored = () => {
  try {
    return JSON.parse(sessionStorage.getItem("adminUser") || "null");
  } catch {
    return null;
  }
};

// Whether the signed-in administrator is the super admin. Starts from what login stored so the screen does not
// flicker, then asks the server (the only authority: a session that began before someone was made super admin, or
// lost it, is corrected here). `ready` is false until the server has answered.
const useSuperAdmin = () => {
  const [state, setState] = useState(() => ({ isSuperAdmin: readStored()?.isSuperAdmin === true, ready: false }));

  useEffect(() => {
    const token = sessionStorage.getItem("adminToken");
    if (!token) {
      setState((current) => ({ ...current, ready: true }));
      return undefined;
    }
    let cancelled = false;
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
        const isSuperAdmin = data.isSuperAdmin === true;
        const stored = readStored();
        if (stored) sessionStorage.setItem("adminUser", JSON.stringify({ ...stored, isSuperAdmin }));
        if (!cancelled) setState({ isSuperAdmin, ready: true });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, ready: true }));
      });
    return () => { cancelled = true; };
  }, []);

  return state;
};

export default useSuperAdmin;
