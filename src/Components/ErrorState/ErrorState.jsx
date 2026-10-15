import React from "react";
import { FiAlertCircle as AlertCircle, FiRefreshCw as RefreshCw, FiWifiOff as WifiOff } from "react-icons/fi";
import { NETWORK_MESSAGE } from "../../utils/apiMessage";
import "./ErrorState.css";

// How a failed request looks, the same on every page of the portal.
//   <ErrorState message onRetry />   a page or a card that could not load: centred, calm, with a way to try again
//   <InlineAlert message onRetry />  a banner above a form or a table: one line, with an optional retry
// A lost connection is shown in a softer amber, since it is nobody's mistake; a real error is red.
const isOffline = (message) => message === NETWORK_MESSAGE;

export const InlineAlert = ({ message, onRetry, onDismiss, className = "" }) => {
  if (!message) return null;
  const Icon = isOffline(message) ? WifiOff : AlertCircle;
  return (
    <div className={`ia ${isOffline(message) ? "is-network" : ""} ${className}`} role="alert">
      <Icon size={16} aria-hidden="true" />
      <span className="ia-text">{message}</span>
      {onRetry && <button type="button" className="ia-retry" onClick={onRetry}>Try again</button>}
      {onDismiss && <button type="button" className="ia-dismiss" onClick={onDismiss} aria-label="Dismiss">×</button>}
    </div>
  );
};

const ErrorState = ({ message, onRetry, title, retryLabel = "Try again", children }) => {
  const offline = isOffline(message);
  const Icon = offline ? WifiOff : AlertCircle;
  return (
    <div className={`es ${offline ? "is-network" : ""}`} role="alert">
      <span className="es-icon" aria-hidden="true"><Icon size={22} /></span>
      <div className="es-title">{title || (offline ? "Can't connect" : "Something went wrong")}</div>
      <p>{message}</p>
      {onRetry && <button type="button" className="es-btn" onClick={onRetry}><RefreshCw size={14} aria-hidden="true" />{retryLabel}</button>}
      {children}
    </div>
  );
};

export default ErrorState;
