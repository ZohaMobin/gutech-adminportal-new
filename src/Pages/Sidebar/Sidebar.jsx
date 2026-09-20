// Sidebar.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './sidebar.css';

const NAV_SECTIONS = [
  {
    id: 'daily',
    label: 'Daily work',
    items: [
      { id: 'attendance', label: 'Attendance', icon: '📅' },
      { id: 'marks', label: 'Marks', icon: '📄' },
      { id: 'class-schedule', label: 'Class Schedule', icon: '🗓️' },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    items: [
      { id: 'course-registration', label: 'Enroll Students', icon: '📝' },
      { id: 'import-students', label: 'Import Students', icon: '📥' },
      { id: 'student-directory', label: 'Student Directory', icon: '👥' },
    ],
  },
  {
    id: 'setup',
    label: 'Setup',
    collapsible: true,
    items: [
      { id: 'course', label: 'Courses', icon: '📚' },
      { id: 'departments', label: 'Departments', icon: '🏛️' },
      { id: 'programs', label: 'Programs', icon: '🎓' },
      { id: 'academic-years', label: 'Academic Years', icon: '📆' },
    ],
  },
];

const SETUP_STORAGE_KEY = 'adminSidebarSetupOpen';

const readSetupOpen = () => {
  try {
    return localStorage.getItem(SETUP_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const Sidebar = ({ isOpen, activePage, onNavClick }) => {
  const navigate = useNavigate();
  const user = JSON.parse(sessionStorage.getItem('adminUser'));
  const [setupOpen, setSetupOpen] = useState(readSetupOpen);

  // Route paths are case-insensitive here (the courses route is "/Course").
  const isActive = (id) => (activePage || '').toLowerCase() === id;

  const toggleSetup = () => {
    setSetupOpen((open) => {
      try {
        localStorage.setItem(SETUP_STORAGE_KEY, String(!open));
      } catch {
        // Preference is a convenience only.
      }
      return !open;
    });
  };

  const renderItem = (item) => (
    <a
      key={item.id}
      href="#"
      className={`sidebar-nav-item ${isActive(item.id) ? 'active' : ''}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(`/${item.path || item.id}`);
        onNavClick(item.id);
      }}
    >
      <span className="sidebar-nav-icon">{item.icon}</span>
      <span className="sidebar-nav-text">{item.label}</span>
    </a>
  );

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
        {NAV_SECTIONS.map((section) => {
          // Keep the section open while one of its pages is showing.
          const containsActive = section.items.some((item) => isActive(item.id));
          const expanded = !section.collapsible || setupOpen || containsActive;
          return (
            <div key={section.id} className="sidebar-section">
              {section.collapsible ? (
                <button
                  type="button"
                  className="sidebar-section-label sidebar-section-toggle"
                  onClick={toggleSetup}
                  aria-expanded={expanded}
                  disabled={containsActive}
                >
                  <span>{section.label}</span>
                  <span className={`sidebar-chevron ${expanded ? 'open' : ''}`}>›</span>
                </button>
              ) : (
                <div className="sidebar-section-label">{section.label}</div>
              )}
              {expanded && section.items.map(renderItem)}
            </div>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="sidebar-footer">
        <div className="sidebar-footer-content">
          <div className="user-avatar-small">
            <span>{user?.name?.charAt(0) || 'A'}</span>
          </div>
          <div className="user-info">
            <span className="user-name-small">{user?.name || 'Admin'}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;