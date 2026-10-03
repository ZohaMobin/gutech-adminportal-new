import { BusyLabel } from '../../Components/Loading/Loading';
import PageHeader from "../../Components/PageHeader/PageHeader";
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { showToast, TOAST_TYPES } from "../../Components/Toast/Toast";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import "./ImportStudentsPage.css";
import NoResultsFound from "../../Components/NoResultsFound";
import ImportHistory from "./ImportHistory";
import StudentFlow from "../../Components/StudentFlow/StudentFlow";

const ImportStudentsPage = () => {
  const apiUrl = process.env.REACT_APP_BACKEND_URL;
  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${sessionStorage.getItem("adminToken")}` }), []);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [rowCount, setRowCount] = useState(0);        // how many valid rows the file holds, for the progress message
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [importErrors, setImportErrors] = useState([]);
  const [historyKey, setHistoryKey] = useState(0);   // bumped after an import so the history shows it at once

  useEffect(() => {
    // Check if user is authenticated
    const token = sessionStorage.getItem("adminToken");
    if (!token) {
      showToast("Please login to access this page", TOAST_TYPES.ERROR);
      navigate("/");
      return;
    }
  }, [navigate]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError("");
      setSuccess("");
      setImportErrors([]);

      // Read the Excel file and create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Validate required fields
          const requiredFields = ["rollNumber", "name", "email", "department", "program"];
          const validData = jsonData.filter((row) => requiredFields.every((field) => row[field] !== undefined && row[field] !== ""));

          if (validData.length === 0) {
            setError("No valid data found in the Excel file. Please check the required fields.");
            setPreview([]);
            setRowCount(0);
            return;
          }

          setRowCount(validData.length);
          setPreview(validData.slice(0, 5)); // Show first 5 records as preview
        } catch (err) {
          setError("Invalid Excel file format");
          setPreview([]);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        rollNumber: "2024001",
        name: "John Doe",
        email: "john.doe@example.com",
        department: "Computer Science [Use Exact Name]",
        program: "Bachelor of Science in Computer Science[Use Exact Name]",
        currentSemester: 0,
        CGPA: 0.0,
      },
      {
        rollNumber: "2024002",
        name: "Jane Smith",
        email: "jane.smith@example.com",
        department: "Business Administration[Use Exact Name]",
        program: "Bachelor of Business Administration[Use Exact Name]",
        currentSemester: 1,
        CGPA: 0.0,
      },
    ];

    // Create instructions sheet
    const instructions = [
      { Field: "rollNumber", Description: "Unique roll number (e.g., 2024001)", Required: "Yes", Example: "2024001" },
      { Field: "name", Description: "Full name of the student", Required: "Yes", Example: "John Doe" },
      { Field: "email", Description: "Valid email address", Required: "Yes", Example: "john.doe@example.com" },
      { Field: "department", Description: "Department name (exact match) OR MongoDB ObjectId. Get names from the Departments & Programs page.", Required: "Yes", Example: "Computer Science" },
      { Field: "program", Description: "Program name (exact match) OR MongoDB ObjectId. Get names from the Departments & Programs page.", Required: "Yes", Example: "Bachelor of Science in Computer Science" },
      { Field: "currentSemester", Description: "Current semester (0-8, default: 0)", Required: "No", Example: "0" },
      { Field: "CGPA", Description: "Cumulative GPA (0.0-4.0, default: 0)", Required: "No", Example: "3.5" },
    ];

    const ws1 = XLSX.utils.json_to_sheet(template);
    const ws2 = XLSX.utils.json_to_sheet(instructions);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Template");
    XLSX.utils.book_append_sheet(wb, ws2, "Instructions");
    XLSX.writeFile(wb, "student_template.xlsx");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    const token = sessionStorage.getItem("adminToken");
    if (!token) {
      setError("Authentication required. Please login again.");
      navigate("/");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    setImportErrors([]);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target.result;
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const students = XLSX.utils.sheet_to_json(worksheet);

          // Validate the data
          const requiredFields = ["rollNumber", "name", "email", "department", "program"];
          const invalidStudents = students.filter((student) => !requiredFields.every((field) => student[field] !== undefined && student[field] !== ""));

          if (invalidStudents.length > 0) {
            setError(`Invalid data found in ${invalidStudents.length} records. Please check the template format.`);
            setLoading(false);
            return;
          }

          // Prepare the data for bulk creation
          const studentData = students.map((student) => ({
            user: {
              name: student.name,
              email: student.email,
              role: "student",
            },
            student: {
              rollNumber: student.rollNumber,
              department: student.department,
              program: student.program,
              currentSemester: student.currentSemester === undefined || student.currentSemester === null || student.currentSemester === "" ? 0 : student.currentSemester,
              CGPA: student.CGPA || 0,
            },
          }));

          // Make a single API call for bulk creation
          const response = await axios.post(
            `${apiUrl}/api/students/bulk`,
            { students: studentData, fileName: file.name, rowsInFile: students.length },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            }
          );

          const createdCount = response.data.created || 0;
          const errors = response.data.errors || [];
          const totalAttempted = students.length;

          // Build success message
          let successMessage = `Successfully imported ${createdCount} out of ${totalAttempted} students`;
          if (errors.length > 0) {
            successMessage += `. ${errors.length} error(s) occurred.`;
          }

          setSuccess(successMessage);
          showToast(successMessage, errors.length > 0 ? TOAST_TYPES.WARNING : TOAST_TYPES.SUCCESS);
          // The rows that were refused stay on the page (a toast would vanish before they could be read).
          setImportErrors(errors);
          if (errors.length > 0) console.error("Import errors:", errors);

          setFile(null);
          setPreview([]);
          setRowCount(0);
          setHistoryKey((key) => key + 1);
        } catch (err) {
          if (err.response?.status === 401) {
            setError("Session expired. Please login again.");
            navigate("/");
          } else {
            setError(err.response?.data?.message || "Error processing the file");
          }
        } finally {
          // Set loading to false after the async operation completes
          setLoading(false);
        }
      };

      reader.onerror = () => {
        setError("Error reading the file");
        setLoading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setError("Error reading the file");
      setLoading(false);
    }
  };

  return (
    <div className="import-students-container page-shell">
      <PageHeader title="Import Students" subtitle="Create student accounts in the LMS from an Excel file. Do this once per student, before enrolling them in courses." />

      <StudentFlow current="import" />

      <div className="import-section">
        <div className="file-upload">
          <div className="upload-area">
            <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} disabled={loading} id="file-upload-input" />
            <label htmlFor="file-upload-input" className="file-label">
              {file ? file.name : "Choose Excel file"}
            </label>
          </div>
          <button className="download-template" onClick={handleDownloadTemplate} disabled={loading}>
            Download Template
          </button>
        </div>

        {loading && (
          <div className="import-progress" role="status" aria-live="polite">
            <div className="import-progress-head">
              <span className="import-spinner" aria-hidden="true" />
              <div>
                <strong>Importing {rowCount ? `${rowCount} student${rowCount === 1 ? "" : "s"}` : "students"}…</strong>
                <small>Creating their accounts in the LMS. This can take a minute for a large file, so please keep this page open.</small>
              </div>
            </div>
            <div className="import-bar" aria-hidden="true"><i /></div>
          </div>
        )}

        {error && (
          <div className="error-message">
            <p>{error}</p>
            <button onClick={() => setError("")} className="dismiss-error-btn">
              Dismiss
            </button>
          </div>
        )}

        {success && (
          <div className="success-message">
            <p>{success}</p>
            <button onClick={() => setSuccess("")} className="dismiss-success-btn">
              Dismiss
            </button>
          </div>
        )}

        {importErrors.length > 0 && (
          <div className="import-errors" role="alert">
            <strong>{importErrors.length} row{importErrors.length === 1 ? "" : "s"} could not be imported</strong>
            <ul>
              {importErrors.slice(0, 100).map((message, index) => <li key={index}>{message}</li>)}
            </ul>
            {importErrors.length > 100 && <p>…and {importErrors.length - 100} more. Check the file for these rows.</p>}
          </div>
        )}

        {!loading && !error && preview.length === 0 && file && (
          <NoResultsFound
            title="No Students to Import"
            message="The file you uploaded doesn't contain any valid student data. Please check your file format and try again."
            icon="search"
            actionButton={true}
            actionButtonText="Clear File"
            onActionButtonClick={() => setFile(null)}
          />
        )}

        {preview.length > 0 && (
          <div className={`preview-section ${loading ? "is-busy" : ""}`}>
            <h3>Preview (First 5 records)</h3>
            <div className="preview-table">
              <table>
                <thead>
                  <tr>
                    <th>Roll Number</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Program</th>
                    <th>Semester</th>
                    <th>CGPA</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((student, index) => (
                    <tr key={index}>
                      <td>{student.rollNumber}</td>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.department}</td>
                      <td>{student.program}</td>
                      <td>{student.currentSemester ?? "N/A"}</td>
                      <td>{student.CGPA || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button className="upload-button" onClick={handleUpload} disabled={!file || loading}>
          <BusyLabel busy={loading} busyText="Importing…" idle="Import Students" />
        </button>
      </div>

      <ImportHistory apiUrl={apiUrl} headers={authHeaders} refreshKey={historyKey} />
    </div>
  );
};

export default ImportStudentsPage;
