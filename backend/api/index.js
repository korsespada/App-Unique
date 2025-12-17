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

  const upstreamUrl = 'https://back-unique.vercel.app/api/products';

  try {
    const response = await axios.get(upstreamUrl, {
      timeout: 28000,
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      return res.status(502).json({
        error: 'Upstream service returned non-2xx status',
        upstream_status: response.status,
      });
    }

    const upstreamProducts = Array.isArray(response.data?.products) ? response.data.products : [];
    const products = upstreamProducts.map((p) => ({
      ...p,
      brand: p.brand || p.season_title || '',
    }));

    const payload = { products };
    externalProductsCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    if (error?.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Upstream request timeout',
        upstream_url: upstreamUrl,
      });
    }

    const upstreamStatus = error?.response?.status;
    return res.status(502).json({
      error: 'Failed to fetch upstream products',
      upstream_url: upstreamUrl,
      upstream_status: upstreamStatus,
      message: error?.message,
    });
  }
});

// Export for Vercel serverless
module.exports = app;
