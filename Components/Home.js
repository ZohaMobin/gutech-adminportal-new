import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeart } from 'react-icons/fa';
import '../Styles/Home.css';

function Home({ addToCart }) {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState(new Set());

  const products = [
    {
      id: 1,
      name: 'Headphones',
      price: 119.99,
      image: 'https://fonepro.pk/wp-content/uploads/2020/12/as-images.apple-6.png.webp',
      altText: 'A pair of wireless headphones',
    },
    {
      id: 2,
      name: 'Shoes',
      price: 98.99,
      image: 'https://static.nike.com/a/images/t_PDP_936_v1/f_auto,q_auto:eco,u_126ab356-44d8-4a06-89b4-fcdcc8df0245,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/f0ecd816-0bad-42ab-a76f-28c494a3534e/AIR+JORDAN+1+MID+%28GS%29.png',
      altText: 'A pair of Nike Air Jordan shoes',
    },
    {
      id: 3,
      name: 'Jacket',
      price: 79.99,
      image: 'https://www.thejacketmaker.ie/cdn/shop/files/Mystical_Black_Leather_Jacket_2e4fb493-b499-4195-8c70-ffe1a7699d10.jpg?v=1734703148',
      altText: 'A black leather jacket',
    },
    {
      id: 4,
      name: 'Watch',
      price: 350.99,
      image: 'https://media.rolex.com/image/upload/q_auto:eco/f_auto/t_v7-grid/c_limit,w_2440/v1/catalogue/2024/upright-bba-with-shadow/m128239-0066',
      altText: 'A Rolex watch',
    },
    {
      id: 5,
      name: 'Bracelet',
      price: 39.99,
      image: 'https://www.oliverheemeyer.com/cdn/shop/products/DiamondTennisBraceletWG5.0ct.png?v=1646841824&width=1946',
      altText: 'A diamond tennis bracelet',
    },
    {
      id: 6,
      name: 'Macbook M3 AIR',
      price: 999.99,
      image: 'https://www.alphastore.com.kw/wp-content/uploads/2024/03/mba13-m3-midnight-gallery5-202402-600x461.jpg',
      altText: 'A MacBook Air M3 in midnight color',
    },
  ];

  const handleAddToCart = (product) => {
    addToCart(product);
    navigate('/cart');
  };

  const toggleFavorite = (e, productId) => {
    e.preventDefault(); // Prevent event bubbling
    setFavorites(prevFavorites => {
      const newFavorites = new Set(prevFavorites);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  return (
    <div className="home-container">
      <div className="products-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <div className="product-image">
              <img src={product.image} alt={product.altText} />
            </div>
            <div className="product-info">
              <h3 className="product-name">{product.name}</h3>
              <p className="product-price">${product.price}</p>
              <div className="button-container">
                <button
                  className="add-to-cart-button"
                  onClick={() => handleAddToCart(product)}
                >
                  Add to Cart
                </button>
                <button
                  className="favorite-button"
                  onClick={(e) => toggleFavorite(e, product.id)}
                  aria-label={favorites.has(product.id) ? "Remove from favorites" : "Add to favorites"}
                >
                  <FaHeart
                    className={`heart-icon ${favorites.has(product.id) ? 'favorite' : ''}`}
                    color={favorites.has(product.id) ? '#ff0000' : '#000000'}
                    size={24}
                  />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;