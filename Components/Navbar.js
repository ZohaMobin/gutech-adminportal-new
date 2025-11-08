import { Link } from 'react-router-dom';
import '../Styles/Navbar.css';
import React, { useState } from 'react';

function Navbar({ cartItemCount }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <nav className="navbar">
            <div className="navbar-container">
                {/* Logo */}
                <Link to="/" className="logo">
                    <i className="fas fa-store"></i> Gutech exam store
                </Link>

                {/* Navigation Links */}
                <div className={`navbar-menu ${isMenuOpen ? 'show' : ''}`}>
                    <div className="nav-links">
                        <Link to="/" className="nav-link">Home</Link>
                        
                        {/* Cart Link with Text and Icon */}
                        <Link to="/cart" className="nav-link cart-link">
                            <i className="fas fa-shopping-cart"></i> Cart
                        </Link>
                    </div>
                </div>

                {/* Hamburger Menu for Mobile */}
                <div 
                    className={`hamburger ${isMenuOpen ? 'active' : ''}`} 
                    onClick={toggleMenu}
                >
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </nav>
    );
}

export default Navbar;
