/**
 * Academic Configuration
 * 
 * This file contains centralized configuration for academic-related data.
 * Note: Departments and Programs are now fetched from the API using the useDepartmentsAndPrograms hook.
 * Only static configuration like semesters remains here.
 */

// List of semesters (can be overridden by program's typicalDuration)
export const semesters = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Academic year format
export const getCurrentAcademicYear = () => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 1}`;
}; 
