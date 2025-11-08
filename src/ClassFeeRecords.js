/*import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './ClassFeeRecords.css'; // Import the CSS file

const ClassFeeRecords = () => {
  const navigate = useNavigate();

  // Initial mock data for class fee records, now includes feeProof property
  const initialFeeRecords = [
    { studentId: "S101", name: "Ibraheem", semester: "3rd", lastPaymentDate: "2025-01-10", status: "Paid", feeProof: null },
    { studentId: "S102", name: "Moosa", semester: "2nd", lastPaymentDate: "2025-01-12", status: "Pending", feeProof: null },
    { studentId: "S103", name: "Sultan", semester: "1st", lastPaymentDate: "2025-01-09", status: "Paid", feeProof: null },
  ];

  // State to hold fee records
  const [feeRecords, setFeeRecords] = useState(initialFeeRecords);

  // Handle file upload and store the file URL
  const handleFileUpload = (e, studentId) => {
    const file = e.target.files[0];
    if (file) {
      const fileURL = URL.createObjectURL(file); // Generate file URL
      // Update the fee record with the file URL
      setFeeRecords(prevRecords =>
        prevRecords.map(record =>
          record.studentId === studentId
            ? { ...record, feeProof: fileURL }
            : record
        )
      );
    }
  };

  return (
    <div className="class-fee-records">
      <h2>Class Fee Records</h2>
      <table className="fee-table">
        <thead>
          <tr>
            <th>Student ID</th>
            <th>Name</th>
            <th>Semester</th>
            <th>Last Payment Date</th>
            <th>Status</th>
            <th>Fee Proof</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {feeRecords.map((record) => (
            <tr key={record.studentId}>
              <td>{record.studentId}</td>
              <td>{record.name}</td>
              <td>{record.semester}</td>
              <td>{record.lastPaymentDate}</td>
              <td>{record.status}</td>
              <td>
                {record.feeProof ? (
                  <a href={record.feeProof} target="_blank" rel="noopener noreferrer">
                    View Proof
                  </a>
                ) : (
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, record.studentId)}
                    accept="image/*,application/pdf"
                  />
                )}
              </td>
              <td>
                <button onClick={() => navigate(`/fees/student/${record.name}`, { state: { record } })}>
                  View History
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClassFeeRecords;*/
