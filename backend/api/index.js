// Serverless function wrapper for Vercel
const path = require('path');

// Set the correct path for .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import the app after env is loaded
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const NodeCache = require('node-cache');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const externalProductsCache = new NodeCache({ stdTTL: 60 });

// Google Sheets auth
function getAuthClient() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.warn('Google Sheets credentials not configured');
    return null;
  }

  try {
    return new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } catch (error) {
    console.error('Error creating Google Sheets auth client:', error.message);
    return null;
  }
}

async function loadProductsFromSheets() {
  const auth = getAuthClient();
  
  if (!auth) {
    return null;
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'Sheet1!A2:I', // Adjust range based on your sheet
    });

    const rows = response.data.values || [];
    
    const products = rows
      .filter(row => row[8] === 'processed') // Filter by status column
      .map((row, index) => ({
        id: row[0] || `product-${index}`,
        title: row[3] || 'Unnamed Product',
        brand: row[7] || 'Golden Goose',
        price: 200 + Math.floor(Math.random() * 300), // Random price 200-500
        description: row[4] || '',
        images: row[1] ? [`https://your-cdn.com/${row[1]}/main.jpg`] : ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500'],
        category: row[5] || 'Shoes',
        inStock: true
      }));

    return products;
  } catch (error) {
    console.error('Error loading products from Google Sheets:', error.message);
    return null;
  }
}

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

  // Try to load from Google Sheets
  const sheetsProducts = await loadProductsFromSheets();
  
  if (sheetsProducts && sheetsProducts.length > 0) {
    const payload = { products: sheetsProducts };
    externalProductsCache.set(cacheKey, payload);
    return res.json(payload);
  }

  // Fallback to mock data if Google Sheets fails
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
    }
  ];

  const payload = { products: mockProducts };
  externalProductsCache.set(cacheKey, payload);
  return res.json(payload);
});

// Export for Vercel serverless
module.exports = app;
