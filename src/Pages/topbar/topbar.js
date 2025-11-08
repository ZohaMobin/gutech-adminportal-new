import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Components/AuthContext';
import './topbar.css';

const Topbar = ({ toggleSidebar, isSidebarOpen }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const user = JSON.parse(sessionStorage.getItem('adminUser'));

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen(!isProfileMenuOpen);
  };

  const handleLogout = () => {
    logout(); // This will handle removing adminToken and adminUser from sessionStorage
    navigate('/'); // Redirect to login page
  };

  return (
    <header className="header">
      <div className="header-content">
        {/* Mobile hamburger menu */}
        <div className="header-mobile-toggle">
          <button className="hamburger-button" onClick={toggleSidebar}>
            <span className={`hamburger-icon ${isSidebarOpen ? 'active' : ''}`}></span>
          </button>
        </div>

        {/* Logo for mobile */}
        <div className="header-logo-mobile">
          <div className="logo">
            <img src={`${process.env.PUBLIC_URL}/gulogo.svg`} alt="GUtech Logo" className="gulogo" />
          </div>
        </div>

        {/* Right navigation */}
        <nav className="header-nav">
          <a href="#" className="header-nav-item">Help</a>
          <a href="#" className="header-nav-item">Support</a>
          <a href="#" className="header-nav-item notification-icon">
            <span>🔔</span>
            <span className="notification-badge">3</span>
          </a>
          
          {/* User profile */}
          <div className="user-profile">
            <div className="user-avatar" onClick={toggleProfileMenu}>
              <span>GU</span>
            </div>
            
            {/* Profile dropdown menu */}
            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <span className="profile-name">{user?.name}</span>
                  <span className="profile-email">{user?.email}</span>
                </div>
                  <a href="#" className="profile-menu-item logout" onClick={handleLogout}>
                    Logout
                  </a>
                </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Topbar;
