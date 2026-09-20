import React, { useState } from "react";

// A password field with a show/hide eye, matching the toggle used on the login and reset screens.
// Use this for any new place a password is typed.
const PasswordInput = ({ name, value, onChange, disabled = false, autoComplete, placeholder, id }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="pw-field">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        tabIndex={0}
      >
        <i className={`fas ${visible ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true"></i>
      </button>
    </div>
  );
};

export default PasswordInput;
