import React from 'react';
import { FiSearch, FiFilter, FiRefreshCw } from 'react-icons/fi';
import './NoResultsFound.css';

const NoResultsFound = ({ 
  title = "No Results Found", 
  message = "We couldn't find any matching results.", 
  icon = "search",
  actionButton = null,
  actionButtonText = "Clear Filters",
  onActionButtonClick = null
}) => {
  const renderIcon = () => {
    switch (icon) {
      case "search":
        return <FiSearch className="no-results-icon" />;
      case "filter":
        return <FiFilter className="no-results-icon" />;
      case "refresh":
        return <FiRefreshCw className="no-results-icon" />;
      default:
        return <FiSearch className="no-results-icon" />;
    }
  };

  return (
    <div className="no-results-container">
      <div className="no-results-content">
        {renderIcon()}
        <h3>{title}</h3>
        <p>{message}</p>
        {actionButton && onActionButtonClick && (
          <button 
            className="action-button" 
            onClick={onActionButtonClick}
          >
            {actionButtonText}
          </button>
        )}
      </div>
    </div>
  );
};

export default NoResultsFound; 