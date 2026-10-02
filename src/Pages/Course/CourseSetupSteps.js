import React from "react";
import "./CourseSetupSteps.css";

// Setting up a course is three things in a fixed order, so they are shown as three steps: the course has to exist before it
// can be offered, and it has to be offered in a term before a teacher can be given its sections. Each step can carry a short
// caption saying where things stand ("12 courses", "9 offered in Fall 2026").
export const STEPS = [
  { id: "create", title: "Create the course", what: "Add it once, with its code, name and credit hours. Skip this if it already exists." },
  { id: "offerings", title: "Offer it for a term", what: "Choose the program, semester and academic term it will be taught in." },
  { id: "assignments", title: "Assign a teacher", what: "Add its sections and choose who teaches each one." },
];

const CourseSetupSteps = ({ active, onSelect, captions = {} }) => (
  <nav className="cstep" aria-label="Setting up a course, in order">
    <ol>
      {STEPS.map((step, index) => {
        const here = active === step.id;
        return (
          <li key={step.id}>
            <button type="button" className={`cstep-btn ${here ? "is-here" : ""}`} aria-current={here ? "step" : undefined} onClick={() => onSelect(step.id)}>
              <span className="cstep-num" aria-hidden="true">{index + 1}</span>
              <span className="cstep-text">
                <strong>{step.title}</strong>
                <small>{step.what}</small>
                {captions[step.id] && <span className="cstep-caption">{captions[step.id]}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);

export default CourseSetupSteps;
