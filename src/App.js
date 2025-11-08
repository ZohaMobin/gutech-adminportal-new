import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./styles/global.css"; // Single global CSS file
import Signup from "./Pages/LoginSignUp/Signup";
import ForgotPassword from "./Pages/ForgotPassword/ForgotPassword";
import MainLayout from "./Pages/MainLayout/MainLayout";
import ClassSchedule from "./Pages/Class Schedule/Class Schedule.jsx";
import ImportStudentsPage from "./Pages/ImportStudents/ImportStudentsPage";
import StudentDirectoryPage from "./Pages/StudentDirectory/StudentDirectoryPage";
import CoursePage from "./Pages/Course/CoursePage.js";
import AssignSectionPage from "./Pages/AssignSection/AssignSectionPage.js";
import CourseRegistrationPage from "./Pages/CourseRegistration/CourseRegistrationPage";
import StudentMarksPage from "./Pages/StudentMarks/StudentMarksPage";
import AttendancePage from "./Pages/Attendance/AttendancePage";
import DepartmentsPage from "./Pages/Departments/DepartmentsPage";
import ProgramsPage from "./Pages/Programs/ProgramsPage";
import AcademicYearsPage from "./Pages/AcademicYears/AcademicYearsPage";
import { AuthProvider } from "./Components/AuthContext";
import PrivateRoute from "./Components/PrivateRoute";

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route element={<PrivateRoute />}>
              <Route path="/*" element={<MainLayout />}>
                <Route path="class-schedule" element={<ClassSchedule />} />
                <Route path="Course" element={<CoursePage />} />
                <Route path="course-registration" element={<CourseRegistrationPage />} />
                <Route path="import-students" element={<ImportStudentsPage />} />
                <Route path="student-directory" element={<StudentDirectoryPage />} />
                <Route path="marks" element={<StudentMarksPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="departments" element={<DepartmentsPage />} />
                <Route path="programs" element={<ProgramsPage />} />
                <Route path="academic-years" element={<AcademicYearsPage />} />
              </Route>
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
