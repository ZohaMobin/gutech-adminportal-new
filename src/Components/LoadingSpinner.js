import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ fullScreen = false, message = 'Loading...' }) => {
  return (
    <div className={`loading-container ${fullScreen ? 'fullscreen' : ''}`}>
      <div className="loading-spinner"></div>
      {message && <p className="loading-message">{message}</p>}
    </div>
  );
};

export default LoadingSpinner; 