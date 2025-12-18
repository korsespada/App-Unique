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
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;

  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
    console.warn('Google Sheets credentials not configured properly');
    return null;
  }

  try {
    const key = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return auth;
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

    // Load products from products_processed sheet
    const productsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'products_processed!A2:I',
    });

    // Load photos from product_photos sheet
    const photosResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'product_photos!A2:F',
    });

    const productsRows = productsResponse.data.values || [];
    const photosRows = photosResponse.data.values || [];
    
    // Create a map of product_id -> photos
    // Columns: A=id, B=product_id, C=photo_filename, D=photo_url, E=photo_order, F=is_main
    const photosMap = {};
    photosRows.forEach((row, index) => {
      const productId = row[1];      // B: product_id
      const filename = row[2];       // C: photo_filename
      const photoUrl = row[3];       // D: photo_url
      const order = row[4];          // E: photo_order
      const isMain = row[5];         // F: is_main
      
      if (!productId) {
        return; // Skip rows without product_id
      }
      
      if (!photosMap[productId]) {
        photosMap[productId] = [];
      }
      photosMap[productId].push({
        filename: filename,
        photoUrl: photoUrl,
        is_main: isMain === 'true' || isMain === true || isMain === 'TRUE',
        order: parseInt(order) || 0
      });
    });

    // Map products with their photos
    const products = productsRows
      .filter(row => row[8] === 'processed') // Filter by status column (I)
      .map((row) => {
        const productId = row[0]; // product_id (A) - это же folder_path
        const photos = photosMap[productId] || [];
        
        // Sort photos by order and get main photo first
        photos.sort((a, b) => {
          if (a.is_main && !b.is_main) return -1;
          if (!a.is_main && b.is_main) return 1;
          return a.order - b.order;
        });

        // Use photo URLs from Google Sheets if available, otherwise construct URLs
        // VK Cloud Object Storage: set VK_IMAGES_BASE_URL like:
        // https://<bucket>.<region>.vkcs.cloud  (or your CDN/public endpoint)
        const imagesBaseUrl = (process.env.VK_IMAGES_BASE_URL || '').replace(/\/$/, '');
        const images = photos.map((photo) => {
          // If photo_url is provided in the sheet, use it
          if (photo.photoUrl && String(photo.photoUrl).trim()) {
            return String(photo.photoUrl).trim();
          }
          // Otherwise, construct URL using VK_IMAGES_BASE_URL
          if (imagesBaseUrl) {
            return `${imagesBaseUrl}/images/${productId}/${photo.filename}`;
          }
          return '';
        }).filter(Boolean);

        // Fallback image if no photos
        if (images.length === 0) {
          images.push('https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500');
        }

        return {
          id: productId,
          title: row[3] || 'Unnamed Product', // name (D)
          brand: row[7] || 'Golden Goose', // brand (H)
          price: 200 + Math.floor(Math.random() * 300), // Random price 200-500
          description: row[4] || '', // description (E)
          images: images,
          category: row[5] || 'Shoes', // category (F)
          seo_title: row[6] || '', // seo_title (G)
          inStock: true
        };
      });

    return products;
  } catch (error) {
    console.error('Error loading products from Google Sheets:', error.message);
    return null;
  }
}

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

async function handleExternalProducts(req, res, cacheKey) {
  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const sheetsProducts = await loadProductsFromSheets();
  if (sheetsProducts && sheetsProducts.length > 0) {
    const payload = { products: sheetsProducts };
    externalProductsCache.set(cacheKey, payload);
    return res.json(payload);
  }

  const payload = { products: mockProducts };
  externalProductsCache.set(cacheKey, payload);
  return res.json(payload);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// External products endpoint
app.get('/api/external-products', async (req, res) => {
  return handleExternalProducts(req, res, 'external-products:default');
});

// Versioned external products endpoint (alias for Telegram frontend)
app.get('/api/:version/:shop/external-products', async (req, res) => {
  const { version, shop } = req.params;
  return handleExternalProducts(req, res, `external-products:${version}:${shop}`);
});

// Export for Vercel serverless
module.exports = app;
