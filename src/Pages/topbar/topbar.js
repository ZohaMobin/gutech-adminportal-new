import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Components/AuthContext';
import usePendingApprovals from '../../hooks/usePendingApprovals';
import './topbar.css';

const Topbar = ({ toggleSidebar, isSidebarOpen }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const user = JSON.parse(sessionStorage.getItem('adminUser'));
  const pendingApprovals = usePendingApprovals();
  const initials = (user?.name || 'Admin').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

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
          <button type="button" className="header-nav-item">Help</button>
          <button type="button" className="header-nav-item">Support</button>
          <button
            type="button"
            className="header-nav-item notification-icon"
            title={pendingApprovals ? `${pendingApprovals} account(s) awaiting approval` : 'No pending approvals'}
            onClick={() => navigate('/account-approvals')}
          >
            <span>🔔</span>
            {pendingApprovals > 0 && <span className="notification-badge">{pendingApprovals > 9 ? '9+' : pendingApprovals}</span>}
          </button>
          
          {/* User profile */}
          <div className="user-profile">
            <div className="user-avatar" onClick={toggleProfileMenu}>
              <span>{initials}</span>
              {pendingApprovals > 0 && <span className="avatar-dot" aria-hidden="true" />}
            </div>
            
            {/* Profile dropdown menu */}
            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <div className="profile-header">
                  <span className="profile-name">{user?.name}</span>
                  <span className="profile-email">{user?.email}</span>
                </div>
                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => { setIsProfileMenuOpen(false); navigate('/account-approvals'); }}
                  >
                    Account Approvals
                    {pendingApprovals > 0 && <span className="menu-count">{pendingApprovals}</span>}
                  </button>
                  <button type="button" className="profile-menu-item logout" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default Topbar;
