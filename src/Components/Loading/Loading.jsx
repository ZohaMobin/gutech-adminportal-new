import React from "react";
import "./Loading.css";

// The one loading state for every screen: soft shimmering placeholders shaped like what is about to appear, so the page does
// not jump when it arrives. `variant` picks the shape ("page" a heading and cards, "list" rows, "table" a header and rows,
// "inline" a single line for small spots); `label` is what screen readers announce.
const Loading = ({ variant = "list", rows = 4, label = "Loading" }) => (
  <div className={`ld ld-${variant}`} role="status" aria-busy="true" aria-live="polite">
    <span className="ld-sr">{label}…</span>
    {variant === "page" && <div className="ld-bar ld-title" />}
    {variant === "table" && <div className="ld-bar ld-head" />}
    {variant === "inline" ? <div className="ld-bar ld-line" /> : Array.from({ length: rows }, (_, index) => <div key={index} className={`ld-bar ${variant === "table" ? "ld-row" : "ld-card"}`} />)}
  </div>
);

export default Loading;
