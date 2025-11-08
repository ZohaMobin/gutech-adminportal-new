import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import '../Styles/thankyou.css';

const ThankYou = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="thank-you-container">
      <div className="thank-you-card">
        <div className="check-animation">
          <Check className="check-icon" size={40} />
        </div>
        
        <h1 className="thank-you-title">Thank You!</h1>
        <p className="confirmation-message">
          Your order has been successfully placed.
        </p>

        <div className="order-details">
          <p className="order-number">
            Order #: <span>ORD-{Math.random().toString(36).substr(2, 9).toUpperCase()}</span>
          </p>
          <p className="order-email">
            A confirmation email has been sent to your registered email address.
          </p>
        </div>

        <div className="info-section">
          <div className="info-item">
            <h3>Estimated Delivery</h3>
            <p>3-5 Business Days</p>
          </div>
          <div className="info-item">
            <h3>Track Order</h3>
            <p>You'll receive tracking information via email</p>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={() => navigate('/')}
            className="continue-shopping"
          >
            Continue Shopping
          </button>
          <button
            onClick={() => navigate('/orders')}
            className="view-order"
          >
            View Order
          </button>
        </div>

        <p className="redirect-notice">
          Redirecting to home page in 5 seconds...
        </p>
      </div>
    </div>
  );
};

export default ThankYou;