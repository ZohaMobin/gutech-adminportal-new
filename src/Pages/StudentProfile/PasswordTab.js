import React from "react";
import { FiInfo } from "react-icons/fi";
import { PasswordCell } from "../StudentPasswords/PasswordParts";
import { shortDate } from "../ManageEnrollment/enrollmentApi";
import "../StudentPasswords/StudentPasswordsPage.css";

const PORTAL = "https://gutech-studentportal-ten.vercel.app";

// One student's sign-in: roll number and password, shown on request, copied or replaced.
const PasswordTab = ({ student, onIssued }) => {
  const inactive = student.account?.status === "inactive";
  return (
    <section className="me-card">
      <header className="me-card-head">
        <div>
          <h3>Sign-in</h3>
          <p>Students sign in to the Student Portal with their roll number and this password. They can't change it themselves.</p>
        </div>
      </header>
      <dl className="pf-signin">
        <div><dt>Student Portal</dt><dd><a href={PORTAL} target="_blank" rel="noreferrer">{PORTAL.replace("https://", "")}</a></dd></div>
        <div><dt>Roll number</dt><dd className="pf-mono">{student.rollNumber}</dd></div>
        <div>
          <dt>Password</dt>
          <dd>
            <PasswordCell student={{ _id: student.id, name: student.name, rollNumber: student.rollNumber, passwordIssuedAt: student.passwordIssuedAt }} onIssued={onIssued} />
            <small className="pf-note">{student.passwordIssuedAt ? `Issued ${shortDate(student.passwordIssuedAt)}. Shown for 30 seconds, and every look-up is recorded.` : "No password yet. Generate one, then give it to the student privately."}</small>
          </dd>
        </div>
      </dl>
      {inactive && <p className="pf-hint"><FiInfo aria-hidden="true" /> This student is inactive, so the password won't work until they're reactivated.</p>}
    </section>
  );
};

export default PasswordTab;
