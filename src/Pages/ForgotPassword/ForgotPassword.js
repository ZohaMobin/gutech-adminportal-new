import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./ForgotPassword.css";

// Emailed reset codes are off until the sending domain is verified. Set REACT_APP_EMAIL_PASSWORD_RESET=true to bring the
// self-service flow back; until then this page tells people who can reset their password for them.
const EMAIL_RESET_ENABLED = process.env.REACT_APP_EMAIL_PASSWORD_RESET === "true";

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleEmailSubmit = async () => {
    if (!email) {
      setErrorMessage("Please enter your email address");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      await axios.post(`${apiUrl}/api/auth/forgot-password`, { email });
      setStep(2);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to send reset code. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (!otp) {
      setErrorMessage("Please enter the verification code");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      await axios.post(`${apiUrl}/api/auth/verify-reset-code`, { email, code: otp });
      setStep(3);
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Invalid verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordSubmit = async () => {
    if (!pass || !confirm) {
      setErrorMessage("Please fill in all fields");
      return;
    }

    if (pass !== confirm) {
      setErrorMessage("ERROR ! Passwords do not match");
      return;
    }

    if (pass.length < 6) {
      setErrorMessage("Password must be at least 6 characters long");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage("");
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      await axios.post(`${apiUrl}/api/auth/reset-password`, {
        email,
        code: otp,
        newPassword: pass
      });
      alert("Password reset successfully!");
      navigate("/");
    } catch (error) {
      setErrorMessage(error.response?.data?.message || "Failed to reset password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!EMAIL_RESET_ENABLED) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-password-container reset-disabled" role="status">
          <button className="back-button" onClick={() => navigate("/")}>
            ← Back to sign in
          </button>
          <div className="reset-disabled-icon" aria-hidden="true">🔒</div>
          <h1>Forgot your password?</h1>
          <span className="reset-disabled-badge">Self-service reset is currently disabled</span>
          <div className="reset-disabled-steps">
            <p>Ask the super administrator to reset it. They will give you a temporary password that works straight away.</p>
            <p>Once you are signed in, you can choose your own password from the profile menu → Change password.</p>
          </div>
          <p className="reset-disabled-note">If you are the super administrator, contact the IT team.</p>
          <button type="button" className="reset-disabled-primary" onClick={() => navigate("/")}>
            Return to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        <button className="back-button" onClick={() => navigate("/")}>
          ←
        </button>

        {/* EMAIL */}
        {step === 1 && (
          <div className="step step-active">
            <h1>Forgot Password</h1>
            <p className="descriptionMail">Enter your registered email address to reset your password.</p>
            <input
              type="email"
              placeholder="GU-Tech E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <button type="button" onClick={handleEmailSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Submit"}
            </button>
          </div>
        )}

        {/* OTP */}
        {step === 2 && (
          <div className="step step-active">
            <p>Enter the code sent to your email.</p>
            <input
              type="text"
              className="otp"
              placeholder="Enter Code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={isSubmitting}
            />
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <button type="button" onClick={handleCodeSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "Submit"}
            </button>
          </div>
        )}

        {/* PASSWORD */}
        {step === 3 && (
          <div className="step step-active">
            <p>Enter your new password.</p>
            <div className="password-container">
              <input
                type={showPass ? "text" : "password"}
                className="otp"
                placeholder="New Password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                disabled={isSubmitting}
              />
              <span
                className="eyess"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? (
                  <i className="fas fa-eye-slash"></i>
                ) : (
                  <i className="fas fa-eye"></i>
                )}
              </span>
            </div>
            <div className="password-container">
              <input
                type={showConfirmPass ? "text" : "password"}
                className="otp"
                placeholder="Confirm Password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={isSubmitting}
              />
              <span
                className="eyess"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
              >
                {showConfirmPass ? (
                  <i className="fas fa-eye-slash"></i>
                ) : (
                  <i className="fas fa-eye"></i>
                )}
              </span>
            </div>
            {errorMessage && <p className="error-message">{errorMessage}</p>}
            <button type="button" onClick={handlePasswordSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword; 