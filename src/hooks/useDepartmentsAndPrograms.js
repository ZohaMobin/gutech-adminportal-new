import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL;

export const useDepartmentsAndPrograms = () => {
  const [departments, setDepartments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch departments and programs in parallel
        const [deptResponse, progResponse] = await Promise.all([axios.get(`${API_BASE_URL}/api/departments`), axios.get(`${API_BASE_URL}/api/programs`)]);

        setDepartments(deptResponse.data || []);
        setPrograms(progResponse.data || []);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to fetch departments and programs");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Helper function to get department by ID
  const getDepartmentById = (id) => {
    if (!id) return null;
    return departments.find((dept) => dept._id === id || dept.id === id);
  };

  // Helper function to get program by ID
  const getProgramById = (id) => {
    if (!id) return null;
    return programs.find((prog) => prog._id === id || prog.id === id);
  };

  // Helper function to get department name
  const getDepartmentName = (id) => {
    const dept = getDepartmentById(id);
    return dept ? dept.name : id;
  };

  // Helper function to get program name
  const getProgramName = (id) => {
    const prog = getProgramById(id);
    return prog ? prog.name : id;
  };

  return {
    departments,
    programs,
    loading,
    error,
    getDepartmentById,
    getProgramById,
    getDepartmentName,
    getProgramName,
  };
};
