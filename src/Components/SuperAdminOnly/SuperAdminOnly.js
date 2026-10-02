import React from "react";
import PageHeader from "../PageHeader/PageHeader";
import "./SuperAdminOnly.css";

// What an ordinary administrator sees on a page that belongs to the super admin.
const SuperAdminOnly = ({ title, what }) => (
  <div className="sao-page page-shell">
    <PageHeader title={title} />
    <div className="sao-card">
      <div className="sao-icon" aria-hidden="true">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      </div>
      <h2>Only the super admin can {what}</h2>
      <p>If something here needs doing, ask the super admin.</p>
    </div>
  </div>
);

export default SuperAdminOnly;
