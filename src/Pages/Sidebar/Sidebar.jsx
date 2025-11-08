// Sidebar.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './sidebar.css';

const Sidebar = ({ isOpen, activePage, onNavClick }) => {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('adminUser'));
  
  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'attendance', label: 'Attendance', icon: '📅' },
    { id: 'marks', label: 'Marks', icon: '📄', path: 'marks' },
    { id: 'course', label: 'Courses', icon: '📚', path: 'course' },
    { id: "course-registration", label: "Enroll Students", icon: "📝", path: "course-registration" },
    { id: "import-students", label: "Import Students", icon: "📥", path: "import-students" },
    { id: "student-directory", label: "Student Directory", icon: "👥", path: "student-directory" },
    { id: "class-schedule", label: "Class Schedule", icon: "📅", path: "class-schedule" },
    { id: "departments", label: "Departments", icon: "🏛️", path: "departments" },
    { id: "programs", label: "Programs", icon: "🎓", path: "programs" },
    { id: "academic-years", label: "Academic Years", icon: "📆", path: "academic-years" }
  ];
  
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">P</div>
          <span className="logo-text">Portal</span>
        </div>
      </div>
      
      {/* Navigation Links */}
      <nav className="sidebar-nav">
        {navigationItems.map(item => (
          <a 
            key={item.id}
            href="#"
            className={`sidebar-nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(`/${item.path || item.id}`);
              onNavClick(item.id); // Call the handler from parent
            }}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-text">{item.label}</span>
          </a>
        ))}
      </nav>
      
      {/* User Section */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-content">
          <div className="user-avatar-small">
            <span>{user?.name?.charAt(0) || 'A'}</span>
          </div>
          <div className="user-info">
            <span className="user-name-small">{user?.name || 'Admin'}</span>
            <a href="#" className="user-profile-link">View Profile</a>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;