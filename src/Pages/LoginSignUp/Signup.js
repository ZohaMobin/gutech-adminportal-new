import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';
import { useAuth } from '../../Components/AuthContext';

// Administrator login. There is deliberately no sign-up here: administrator accounts are
// created by an existing administrator (Setup → Administrators) or, for the very first one,
// with scripts/create-admin.js on the server side.
const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });

  const navigate = useNavigate();

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm({ ...loginForm, [name]: value });
    setError('');
  };

  const validateLoginForm = () => {
    if (!loginForm.email || !loginForm.password) {
      setError('All fields are required');
      return false;
    }
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!validateLoginForm()) return;

    try {
      setIsSubmitting(true);
      setError('');

      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await axios.post(`${apiUrl}/api/auth/login`, {
        email: loginForm.email,
        password: loginForm.password,
      });

      // Check if the user is an admin
      if (response.data.user.role !== 'admin') {
        setError('Access denied. This portal is for administrators only.');
        return;
      }

      // Use the login function from AuthContext
      login(response.data.user, response.data.token);

      // There is no dashboard page; land on the first real one.
      navigate('/attendance');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      console.error('Login error:', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Sign In Form */}
        <div className="form-container sign-in">
          <form onSubmit={handleLogin}>
            <h1 className="form-title">Sign In</h1>

            {error && <div className="error-message">{error}</div>}

            <input
              type="email"
              name="email"
              placeholder="Email"
              autoComplete="username"
              value={loginForm.email}
              onChange={handleLoginChange}
              disabled={isSubmitting}
            />

            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={handleLoginChange}
                disabled={isSubmitting}
              />
              <div
                className="password-toggle"
                onClick={togglePasswordVisibility}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <i className="fas fa-eye-slash"></i> : <i className="fas fa-eye"></i>}
              </div>
            </div>

            <Link to="/forgot-password" className="forgot-password">Forgot Your Password?</Link>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Welcome panel */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-right">
              <h1>Welcome Back</h1>
              <p>Access your account to use all features and services</p>
              <p className="toggle-message">
                Need administrator access?<br />Ask an existing administrator to add you.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
