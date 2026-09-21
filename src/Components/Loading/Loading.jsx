import React from "react";
import "./Loading.css";

// The one loading vocabulary for every screen.
//   <Loading variant="page|table|list|inline" />   first load: soft placeholders shaped like what is coming
//   <Refreshing active>...</Refreshing>            data already on screen is being refreshed: dim it, do not blank it
//   <BusyLabel busy idle="Save" busyText="Saving…" />   a button action: the label swaps for a small spinner and text
//   <Skeleton width="6rem" />                      one small placeholder inside a line of text
const Loading = ({ variant = "list", rows = 4, label = "Loading" }) => (
  <div className={`ld ld-${variant}`} role="status" aria-busy="true" aria-live="polite">
    <span className="ld-sr">{label}…</span>
    {variant === "page" && <div className="ld-bar ld-title" />}
    {variant === "table" && <div className="ld-bar ld-head" />}
    {variant === "inline" ? <div className="ld-bar ld-line" /> : Array.from({ length: rows }, (_, index) => <div key={index} className={`ld-bar ${variant === "table" ? "ld-row" : "ld-card"}`} />)}
  </div>
);

export const Skeleton = ({ width = "6rem" }) => <span className="ld-bar ld-chip" style={{ width }} role="status" aria-busy="true"><span className="ld-sr">Loading</span></span>;

export const Spinner = () => <span className="ld-spin" aria-hidden="true" />;

export const BusyLabel = ({ busy, idle, busyText }) => (busy ? <><Spinner />{busyText}</> : idle);

export const Refreshing = ({ active, children }) => (
  <div className={`ld-refresh ${active ? "is-active" : ""}`} aria-busy={active ? "true" : undefined}>
    {active && <span className="ld-progress" aria-hidden="true" />}
    <div className="ld-refresh-body">{children}</div>
  </div>
);

export default Loading;
