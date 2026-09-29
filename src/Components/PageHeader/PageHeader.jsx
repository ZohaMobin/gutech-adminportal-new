import React from "react";
import "./PageHeader.css";

// The header every admin page starts with: the title, an optional one-line description under it, and the page's main
// action(s) on the right. Pair it with the `page-shell` class on the page's root element, which sets the page width and
// padding, so every page has the same title size, spacing and edges.
//
//   <div className="my-page page-shell">
//     <PageHeader title="Departments" subtitle="..." actions={<button className="btn-primary">+ Add</button>} />
const PageHeader = ({ title, subtitle, actions }) => (
  <header className="page-head">
    <div className="page-head-text">
      <h1 className="page-head-title">{title}</h1>
      {subtitle ? <p className="page-head-sub">{subtitle}</p> : null}
    </div>
    {actions ? <div className="page-head-actions">{actions}</div> : null}
  </header>
);

export default PageHeader;
