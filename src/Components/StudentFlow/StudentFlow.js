import React from "react";
import { useNavigate } from "react-router-dom";
import "./StudentFlow.css";

const STEPS = [
  { id: "import", path: "/import-students", title: "Import Students", what: "Creates their accounts in the LMS" },
  { id: "enroll", path: "/course-registration", title: "Enroll Students", what: "Puts them into courses for the current term" },
];

// The two jobs people mix up, shown as the one order they happen in: a student needs an account (import) before they can
// be placed in a course (enroll). Shown at the top of both pages, with the current one marked and the other a click away.
const StudentFlow = ({ current }) => {
  const navigate = useNavigate();
  return (
    <nav className="sf" aria-label="Adding students, in order">
      <ol>
        {STEPS.map((step, index) => {
          const here = step.id === current;
          return (
            <li key={step.id} className={here ? "is-here" : ""} aria-current={here ? "step" : undefined}>
              <span className="sf-num" aria-hidden="true">{index + 1}</span>
              <span className="sf-text">
                <strong>{step.title}</strong>
                <small>{step.what}</small>
              </span>
              {here ? <span className="sf-here">You are here</span> : <button type="button" className="sf-go" onClick={() => navigate(step.path)}>{index === 0 ? "Go to step 1" : "Go to step 2"} →</button>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default StudentFlow;
