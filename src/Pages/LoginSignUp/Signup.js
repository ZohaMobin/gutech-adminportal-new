import React, { useState } from 'react';
import axios from 'axios';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import './Signup.css';
import { useAuth } from '../../Components/AuthContext';
import { formMessageOf } from '../../utils/apiMessage';
import { BusyLabel } from '../../Components/Loading/Loading';
import { InlineAlert } from '../../Components/ErrorState/ErrorState';

// Administrator login. There is deliberately no sign-up here: administrator accounts are
// created by an existing administrator (Setup → Administrators) or, for the very first one,
// with scripts/create-admin.js on the server side.
const Signup = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuth();

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
        portal: 'admin', // the server refuses other roles here; the check below covers an older server
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
      const errorMessage = formMessageOf(error, 'Login failed. Please check your credentials.');
      setError(errorMessage);
      console.error('Login error:', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Already signed in: no reason to show the login page again.
  if (isAuthenticated) return <Navigate to="/attendance" replace />;

  return (
    <div className="auth-page">
      <div className="auth-container login-only">
        <aside className="brand-panel">
          <h2>Welcome back</h2>
          <p>Manage the university's academics, attendance and accounts.</p>
          <ul>
            <li><i className="fas fa-calendar-alt" aria-hidden="true"></i>Class schedule</li>
            <li><i className="fas fa-clipboard-check" aria-hidden="true"></i>Attendance</li>
            <li><i className="fas fa-user-shield" aria-hidden="true"></i>Access and approvals</li>
          </ul>
        </aside>

        <div className="form-container login-form">
          <form onSubmit={handleLogin}>
            <h1 className="form-title">Administrator sign in</h1>

            <InlineAlert message={error} />

            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="name@example.com"
              autoComplete="username"
              value={loginForm.email}
              onChange={handleLoginChange}
              disabled={isSubmitting}
            />

            <div className="field-label row">
              <label htmlFor="password">Password</label>
              <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
            </div>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={handleLoginChange}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'} aria-hidden="true"></i>
              </button>
            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              <BusyLabel busy={isSubmitting} busyText="Signing in…" idle="Sign In" />
            </button>

            <p className="help-text">Need administrator access? Ask an existing administrator to add you.</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Signup;
