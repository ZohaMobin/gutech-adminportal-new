import React from 'react';
import { toast } from 'react-hot-toast';
import './Toast.css';

// Toast types
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

// Default toast options
const defaultOptions = {
  duration: 5000,
  position: 'top-right',
  style: {
    padding: '16px',
    borderRadius: '8px',
    maxWidth: '500px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    fontSize: '14px',
    fontWeight: '500',
  }
};

// Toast styles for different types
const toastStyles = {
  [TOAST_TYPES.SUCCESS]: {
    background: '#f0fdf4',
    color: '#166534',
    border: '1px solid #86efac',
    icon: '✅'
  },
  [TOAST_TYPES.ERROR]: {
    background: '#fef2f2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    icon: '❌'
  },
  [TOAST_TYPES.INFO]: {
    background: '#eff6ff',
    color: '#1e40af',
    border: '1px solid #bfdbfe',
    icon: 'ℹ️'
  },
  [TOAST_TYPES.WARNING]: {
    background: '#fffbeb',
    color: '#92400e',
    border: '1px solid #fcd34d',
    icon: '⚠️'
  }
};

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast (success, error, info, warning)
 * @param {object} options - Additional options for the toast
 */
export const showToast = (message, type = TOAST_TYPES.INFO, options = {}) => {
  const style = {
    ...defaultOptions.style,
    ...toastStyles[type]
  };

  const toastOptions = {
    ...defaultOptions,
    ...options,
    style
  };

  switch (type) {
    case TOAST_TYPES.SUCCESS:
      toast.success(message, toastOptions);
      break;
    case TOAST_TYPES.ERROR:
      toast.error(message, toastOptions);
      break;
    case TOAST_TYPES.WARNING:
      toast(message, { ...toastOptions, icon: toastStyles[TOAST_TYPES.WARNING].icon });
      break;
    case TOAST_TYPES.INFO:
    default:
      toast(message, { ...toastOptions, icon: toastStyles[TOAST_TYPES.INFO].icon });
      break;
  }
};

/**
 * Show multiple toast notifications
 * @param {Array} messages - Array of messages to display
 * @param {string} type - The type of toast (success, error, info, warning)
 * @param {object} options - Additional options for the toast
 */
export const showMultipleToasts = (messages, type = TOAST_TYPES.INFO, options = {}) => {
  if (!Array.isArray(messages)) {
    showToast(messages, type, options);
    return;
  }

  messages.forEach((message, index) => {
    // Add a small delay between toasts to prevent them from stacking
    setTimeout(() => {
      showToast(message, type, options);
    }, index * 300);
  });
};

/**
 * Show conflict messages as toasts
 * @param {Array} conflicts - Array of conflict objects with message property
 */
export const showConflictToasts = (conflicts) => {
  if (!Array.isArray(conflicts)) return;
  
  conflicts.forEach((conflict, index) => {
    setTimeout(() => {
      showToast(conflict.message, TOAST_TYPES.ERROR);
    }, index * 300);
  });
};

// Toast container component
const ToastContainer = () => {
  return null; // This is just a placeholder, the actual container is provided by react-hot-toast
};

export default ToastContainer; 