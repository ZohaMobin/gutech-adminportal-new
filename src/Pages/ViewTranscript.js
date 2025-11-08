import React, { useEffect, useState } from "react";
import "./Transcript.css";
// import axios from "axios"

const Transcript = () => {
  const studentData = {
    name: "Muhammad Waqas",
    studentId: "BCS-023",
    dob: "09/21/2005",
    degree: "Bachelor of Computer Science",
    major: "Computer Science",
    status: "Completed",
    graduationDate: "6/2028",
    semesters: [
      {
        name: "Fall 2023",
        courses: [
          {
            code: "WEB101",
            title: "Web Tech Lab",
            creditUnits: 3,
            grade: "A",
            points: 4,
          },
          {
            code: "WEB102",
            title: "Web Tech",
            creditUnits: 3,
            grade: "A",
            points: 3,
          },
          {
            code: "PSPFLAB",
            title: "PSPF Lab",
            creditUnits: 3,
            grade: "A",
            points: 4,
          },
          {
            code: "PSPF",
            title: "PSPF",
            creditUnits: 3,
            grade: "B",
            points: 3,
          },
        ],
        gpa: 3.42,
        creditsAttempted: 12,
        creditsEarned: 12,
      },
      {
        name: "Spring 2024",
        courses: [
          {
            code: "DS",
            title: "Discrete Structures",
            creditUnits: 3,
            grade: "A",
            points: 4,
          },
          {
            code: "DT",
            title: "Design Thinking",
            creditUnits: 3,
            grade: "A",
            points: 3,
          },
        ],
        gpa: 3.8,
        creditsAttempted: 6,
        creditsEarned: 6,
      },
    ],
    cgpa: 3.61,
    totalCreditsRequired: 18,
    totalCreditsEarned: 18,
  };

  const [stdata, setstudentData] = useState(null);

  // useEffect(() => {
  //   axios
  //     .get("mockapi/transcriptDATA")
  //     .then((response) => {
  //       setstudentData(response.data);
  //       console.log(response.data);
  //     })
  //     .catch((error) => {
  //       console.log("error fetching data", error);
  //     });
  // }, []);

  //DESTRUCTURE EXAMPLE
  const { studentId } = studentData;
  return (
    <div className="transcript-container">
      <header className="transcript-header">
        <h1>GU-Tech</h1>
        <p>OFFICIAL ACADEMIC TRANSCRIPT</p>
      </header>

      <div className="student-info">
        <p className="transcript-name">
          <strong>Name:</strong> {studentData.name}
        </p>
        <p>
          <strong>Student ID:</strong> {studentId }
        </p>
        <p>
          <strong>Date of Birth:</strong> {studentData.dob}
        </p>
        <p>
          <strong>Degree:</strong> {studentData.degree}
        </p>
        <p>
          <strong>Major:</strong> {studentData.major}
        </p>
        <p>
          <strong>Graduation Date:</strong> {studentData.graduationDate}
        </p>
      </div>

      {studentData.semesters.map((semester, index) => (
        <div key={index} className="semester-section">
          <h2>{semester.name}</h2>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Course Name</th>
                <th>Crd</th>
                <th>Pnt</th>
                <th>Grd</th>
              </tr>
            </thead>
            <tbody>
              {semester.courses.map((course, idx) => (
                <tr key={idx}>
                  <td>{course.code}</td>
                  <td>{course.title}</td>
                  <td>{course.creditUnits}</td>
                  <td>{course.points}</td>
                  <td>{course.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="semester-summary">
            GPA: {semester.gpa} | Credits Attempted: {semester.creditsAttempted}{" "}
            | Credits Earned: {semester.creditsEarned}
          </p>
        </div>
      ))}

      <footer className="transcript-footer">
        <p>
          <strong>CGPA:</strong> {studentData.cgpa} |{" "}
          <strong>Total Credits Required:</strong>{" "}
          {studentData.totalCreditsRequired} |{" "}
          <strong>Total Credits Earned:</strong>{" "}
          {studentData.totalCreditsEarned}
        </p>
        <p>
          <strong>Degree Status:</strong> {studentData.status}
        </p>
        <p className="signature">Controller of Examinations</p>
      </footer>
    </div>
  );
};

export default Transcript;
