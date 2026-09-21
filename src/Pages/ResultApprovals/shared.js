import React from "react";

export const Svg = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
export const CheckIcon = ({ size = 14 }) => <Svg size={size}><path d="M5 12l5 5 9-10" /></Svg>;
export const BackIcon = () => <Svg size={16}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const LockIcon = () => <Svg size={14}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></Svg>;
export const AlertIcon = () => <Svg size={16}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></Svg>;

export const fmt = (n) => (n === null || n === undefined ? "–" : Number(n).toFixed(2).replace(/\.?0+$/, ""));
export const dateText = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");
export const dateTimeText = (value) => (value ? new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

export const STATE_LABEL = { OPEN: "Draft", SUBMITTED: "Submitted", UNDER_REVIEW: "Under review", APPROVED: "Approved", PUBLISHED: "Published", AMENDED: "Amended" };
export const STATE_TONE = { OPEN: "draft", SUBMITTED: "wait", UNDER_REVIEW: "wait", APPROVED: "info", PUBLISHED: "ok", AMENDED: "ok" };
export const messageOf = (error) => error?.response?.data?.message || "That did not work. Please try again.";
