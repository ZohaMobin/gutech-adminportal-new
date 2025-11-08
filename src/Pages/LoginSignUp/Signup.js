import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import './Signup.css';
import { useDepartmentsAndPrograms } from '../../hooks/useDepartmentsAndPrograms';
import { useAuth } from '../../Components/AuthContext';

const Signup = () => {
  const { departments, loading: deptProgLoading } = useDepartmentsAndPrograms();
  const [isSignupActive, setIsSignupActive] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  // Signup form state
  const [signupForm, setSignupForm] = useState({
    name: '',
    email: '',
    employeeId: '',
    department: '',
    password: '',
  });

  // Login form state
  const [loginForm, setLoginForm] = useState({
    identifier: '', // Can be email or employee ID
    password: '',
  });

  const navigate = useNavigate();

  // Handle signup form input changes
  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupForm({ ...signupForm, [name]: value });
    setError('');
  };

  // Handle login form input changes
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm({ ...loginForm, [name]: value });
    setError('');
  };

  // Validate signup form
  const validateSignupForm = () => {
    if (!signupForm.name || !signupForm.email || !signupForm.employeeId || !signupForm.department || !signupForm.password) {
      setError('All fields are required');
      return false;
    }

    if (!signupForm.email.includes('@') || !signupForm.email.includes('.')) {
      setError('Please enter a valid email address');
      return false;
    }

    if (signupForm.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    return true;
  };

  // Validate login form
  const validateLoginForm = () => {
    if (!loginForm.identifier || !loginForm.password) {
      setError('All fields are required');
      return false;
    }
    return true;
  };

  // Handle signup submission
  const handleSignup = async (e) => {
    e.preventDefault();

    if (!validateSignupForm()) return;

    try {
      setIsSubmitting(true);
      setError('');

      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      const userData = {
        ...signupForm,
        role: 'admin', // Set role as admin
      };
      
      const response = await axios.post(`${apiUrl}/api/auth/register`, userData);

      // Reset form after successful registration
      setSignupForm({
        name: '',
        email: '',
        employeeId: '',
        department: '',
        password: '',
      });

      // Switch to login tab
      setIsSignupActive(false);

      // Show success message
      alert('Registration successful! Please log in with your credentials.');
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      console.error('Registration error:', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle login submission
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateLoginForm()) return;
    
    try {
      setIsSubmitting(true);
      setError('');
      
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await axios.post(`${apiUrl}/api/auth/login`, {
        email: loginForm.identifier,
        password: loginForm.password,
      });
      
      // Check if the user is an admin
      if (response.data.user.role !== 'admin') {
        setError('Access denied. This portal is for administrators only.');
        return;
      }
      
      // Use the login function from AuthContext
      login(response.data.user, response.data.token);
      
      // Navigate to dashboard
      navigate("/dashboard");
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      console.error('Login error:', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="auth-page">
      <div className={`auth-container ${isSignupActive ? 'active' : ''}`}>
        {/* Sign Up Form */}
        <div className="form-container sign-up">
          <form onSubmit={handleSignup}>
            <h1 className="form-title">Create Account</h1>

            {error && <div className="error-message">{error}</div>}

            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={signupForm.name}
              onChange={handleSignupChange}
              disabled={isSubmitting}
            />

            <input
              type="email"
              name="email"
              placeholder="Institutional Email"
              value={signupForm.email}
              onChange={handleSignupChange}
              disabled={isSubmitting}
            />

            <input
              type="text"
              name="employeeId"
              placeholder="Employee ID"
              value={signupForm.employeeId}
              onChange={handleSignupChange}
              disabled={isSubmitting}
            />

            <select
              name="department"
              value={signupForm.department}
              onChange={handleSignupChange}
              disabled={isSubmitting || deptProgLoading}
              className="department-select"
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>

            <div className="password-field">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={signupForm.password}
                onChange={handleSignupChange}
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

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Register'}
            </button>
          </form>
        </div>

        {/* Sign In Form */}
        <div className="form-container sign-in">
          <form onSubmit={handleLogin}>
            <h1 className="form-title">Sign In</h1>
            
            {error && <div className="error-message">{error}</div>}
            
            <input 
              type="text" 
              name="identifier"
              placeholder="Email or Employee ID" 
              value={loginForm.identifier}
              onChange={handleLoginChange}
              disabled={isSubmitting} 
            />
            
            <div className="password-field">
              <input 
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Password"
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

        {/* Toggle Container */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome</h1>
              <p>Create an account to access all features and services</p>
              <p className="toggle-message">Already have an account?<br />Sign in to continue.</p>
              <button className="toggle-button" onClick={() => setIsSignupActive(false)}>
                Sign In
              </button>
            </div>

            <div className="toggle-panel toggle-right">
              <h1>Welcome Back</h1>
              <p>Access your account to use all features and services</p>
              <p className="toggle-message">Don't have an account?<br />Register to get started.</p>
              <button className="toggle-button" onClick={() => setIsSignupActive(true)}>
                Register
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
