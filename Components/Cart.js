import React from 'react';
import '../Styles/Cart.css';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingCart } from 'lucide-react';

const Cart = ({ cartItems, removeFromCart, updateQuantity, clearCart }) => {
  const navigate = useNavigate();
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleCheckout = () => {
    navigate('/thank-you');
  };

  return (
    <div className="cart-container">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="cart-header">
          <h2>Your Cart</h2>
          {cartItems.length > 0 && (
            <button onClick={clearCart} className="clear-cart">
              Clear Cart
            </button>
          )}
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <ShoppingCart className="cart-icon" />
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.name} />
                  </div>
                  <div className="cart-item-details">
                    <div className="product-name-price">
                      <h3>{item.name}</h3>
                      <p className="product-price">${item.price.toFixed(2)}</p>
                    </div>
                    <div className="quantity-controls">
                      <button
                        onClick={() => updateQuantity(item.id, Math.max(0, item.quantity - 1))}
                        className="quantity-btn"
                      >
                        <Minus className="icon" />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="quantity-btn"
                      >
                        <Plus className="icon" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="cart-item-total">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className="cart-total">
              <div>
                <h3>Total</h3>
                <p>${total.toFixed(2)}</p>
              </div>
              <button onClick={handleCheckout} className="checkout-btn">
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;
