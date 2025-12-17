// Serverless function wrapper for Vercel
// Import the Express app from src/index.js
const path = require('path');

// Set the correct path for .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import the app after env is loaded
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const externalProductsCache = new NodeCache({ stdTTL: 60 });

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// External products endpoint
app.get('/api/external-products', async (req, res) => {
  const cacheKey = 'external-products:default';

  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Mock products data
  const mockProducts = [
    {
      id: '1',
      title: 'Yeezy Boost 350 V2',
      brand: 'Yeezy',
      price: 220,
      description: 'Classic Yeezy Boost 350 V2 sneakers',
      images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
      category: 'Sneakers',
      inStock: true
    },
    {
      id: '2',
      title: 'Yeezy Slide',
      brand: 'Yeezy',
      price: 90,
      description: 'Comfortable Yeezy Slide sandals',
      images: ['https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=500'],
      category: 'Slides',
      inStock: true
    },
    {
      id: '3',
      title: 'Yeezy Foam Runner',
      brand: 'Yeezy',
      price: 80,
      description: 'Innovative Yeezy Foam Runner',
      images: ['https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=500'],
      category: 'Footwear',
      inStock: true
    },
    {
      id: '4',
      title: 'Yeezy 700 V3',
      brand: 'Yeezy',
      price: 200,
      description: 'Futuristic Yeezy 700 V3 design',
      images: ['https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=500'],
      category: 'Sneakers',
      inStock: true
    },
    {
      id: '5',
      title: 'Yeezy 500',
      brand: 'Yeezy',
      price: 200,
      description: 'Retro-inspired Yeezy 500',
      images: ['https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=500'],
      category: 'Sneakers',
      inStock: true
    }
  ];

  const payload = { products: mockProducts };
  externalProductsCache.set(cacheKey, payload);
  return res.json(payload);
});

// Export for Vercel serverless
module.exports = app;
