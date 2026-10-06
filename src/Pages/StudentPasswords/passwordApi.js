import axios from "axios";

// Calls for student passwords. Every look-up and download is logged on the server.
const API = process.env.REACT_APP_BACKEND_URL;
const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` });

export const viewPassword = async (studentId) => (await axios.get(`${API}/api/students/${studentId}/password`, { headers: headers() })).data;

export const issuePassword = async (studentId) => (await axios.post(`${API}/api/students/${studentId}/password`, {}, { headers: headers() })).data;

// selection: { filters } or { studentIds }
export const issuePasswords = async (selection, { onlyMissing = true } = {}) =>
  (await axios.post(`${API}/api/students/passwords/generate`, { ...selection, onlyMissing }, { headers: headers() })).data;

// Downloads the CSV through the browser. The server sends text; turned into a file here.
export const downloadPasswordsCsv = async (selection, fileName) => {
  let response;
  try {
    response = await axios.post(`${API}/api/students/passwords/export`, selection, { headers: headers(), responseType: "blob" });
  } catch (err) {
    // With responseType blob an error body is a Blob too; read it so the message reaches the admin.
    const blob = err.response?.data;
    if (blob && typeof blob.text === "function") {
      try { err.response.data = JSON.parse(await blob.text()); } catch { /* keep the original error */ }
    }
    throw err;
  }
  const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// "student-passwords-bs-computer-science-semester-3-2026-10-06.csv"
export const csvFileName = (parts = []) => {
  const slug = parts.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `student-passwords${slug ? `-${slug}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
};

// Shown as two groups of four so it is easy to read out; copied without the gap.
export const groupPassword = (password = "") => (password.length === 8 ? `${password.slice(0, 4)} ${password.slice(4)}` : password);

export const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
