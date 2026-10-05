// Small formatting helpers for the Sign-up requests screens (kept apart so they can be unit-tested).

export const initialsOf = (name = "") =>
  (name || "?").split(" ").filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";

export const formatDay = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";

export const formatDayTime = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";

// "today", "yesterday", "5 days ago"... for how long a request has been waiting.
export const waitingFor = (value, now = Date.now()) => {
  if (!value) return "";
  const days = Math.floor((now - new Date(value).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};
