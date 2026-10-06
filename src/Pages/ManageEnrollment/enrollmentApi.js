import axios from "axios";

// Calls for Manage Enrollment. Every change is saved with a reason and recorded on the server.
const API = process.env.REACT_APP_BACKEND_URL;
const headers = () => ({ Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` });
const base = `${API}/api/enrollment`;

export const searchStudents = async (search) =>
  (await axios.get(`${API}/api/students`, { params: { search, page: 1, limit: 8 }, headers: headers() })).data.students || [];

export const getEnrollment = async (studentId) => (await axios.get(`${base}/students/${studentId}`, { headers: headers() })).data;

export const getCourseOptions = async (studentId) => (await axios.get(`${base}/students/${studentId}/options`, { headers: headers() })).data;

export const previewChanges = async (studentId, changes) =>
  (await axios.post(`${base}/students/${studentId}/preview`, { changes }, { headers: headers() })).data;

export const saveChanges = async (studentId, changes, reason) =>
  (await axios.post(`${base}/students/${studentId}/changes`, { changes, reason }, { headers: headers() })).data;

export const listChanges = async (params) => (await axios.get(`${base}/changes`, { params, headers: headers() })).data;

export const downloadChangesCsv = async (params) => {
  const response = await axios.get(`${base}/changes/export`, { params, headers: headers(), responseType: "blob" });
  const url = URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `enrollment-changes-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const getUndoPreview = async (jobId) => (await axios.get(`${base}/uploads/${jobId}/undo`, { headers: headers() })).data;

export const undoUpload = async (jobId, reason) => (await axios.post(`${base}/uploads/${jobId}/undo`, { reason }, { headers: headers() })).data;

export const initialsOf = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
export const shortDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
export const dateTime = (value) => (value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");
