import React from "react";
import "./CourseSetupSteps.css";

// Setting up a course is three things in a fixed order, so they are shown as three steps: the course has to exist before it
// can be offered, and it has to be offered in a term before a teacher can be given its sections. "All courses" is the
// lookup for existing ones (view, edit, delete), not a step.
export const STEPS = [
  { id: "create", title: "Create the course", what: "Add it once, with its code, name and credit hours. Skip this if it already exists." },
  { id: "offerings", title: "Offer it for a term", what: "Choose the program, semester and academic term it will be taught in." },
  { id: "assignments", title: "Assign a teacher", what: "Add its sections and choose who teaches each one." },
];

const CourseSetupSteps = ({ active, onSelect, counts = {} }) => (
  <nav className="cstep" aria-label="Setting up a course, in order">
    <ol>
      {STEPS.map((step, index) => {
        const here = active === step.id;
        const count = counts[step.id];
        return (
          <li key={step.id}>
            <button type="button" className={`cstep-btn ${here ? "is-here" : ""}`} aria-current={here ? "step" : undefined} onClick={() => onSelect(step.id)}>
              <span className="cstep-num" aria-hidden="true">{index + 1}</span>
              <span className="cstep-text">
                <strong>{step.title}</strong>
                <small>{step.what}</small>
              </span>
              {count !== undefined && <span className="cstep-count">{count}</span>}
            </button>
          </li>
        );
      })}
    </ol>
    <button type="button" className={`cstep-all ${active === "manage" ? "is-here" : ""}`} aria-current={active === "manage" ? "page" : undefined} onClick={() => onSelect("manage")}>
      <span>All courses <span aria-hidden="true">›</span></span>
      <small>View, edit or delete existing courses</small>
    </button>
  </nav>
);

export default CourseSetupSteps;
