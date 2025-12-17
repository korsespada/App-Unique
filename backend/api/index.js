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

// Serve static files from public directory
app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));

const externalProductsCache = new NodeCache({ stdTTL: 60 });

// Google Sheets auth
function getAuthClient() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;
  
  console.log('Checking Google Sheets credentials...');
  console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET');
  console.log('GOOGLE_PRIVATE_KEY:', GOOGLE_PRIVATE_KEY ? 'SET (length: ' + GOOGLE_PRIVATE_KEY.length + ')' : 'NOT SET');
  console.log('GOOGLE_SHEETS_SPREADSHEET_ID:', GOOGLE_SHEETS_SPREADSHEET_ID ? 'SET' : 'NOT SET');
  
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID) {
    console.warn('Google Sheets credentials not configured properly');
    return null;
  }

  try {
    const key = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    console.log('Creating JWT auth client...');
    
    const auth = new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    
    console.log('JWT auth client created successfully');
    return auth;
  } catch (error) {
    console.error('Error creating Google Sheets auth client:', error.message);
    console.error('Error stack:', error.stack);
    return null;
  }
}

async function loadProductsFromSheets() {
  console.log('loadProductsFromSheets: Starting...');
  const auth = getAuthClient();
  
  if (!auth) {
    console.log('loadProductsFromSheets: No auth client, returning null');
    return null;
  }

  try {
    console.log('loadProductsFromSheets: Creating sheets client...');
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('loadProductsFromSheets: Fetching products from sheet...');
    // Load products from products_processed sheet
    const productsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'products_processed!A2:I',
    });

    console.log('loadProductsFromSheets: Fetching photos from sheet...');
    // Load photos from product_photos sheet
    const photosResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: 'product_photos!A2:F',
    });

    const productsRows = productsResponse.data.values || [];
    const photosRows = photosResponse.data.values || [];
    
    console.log(`loadProductsFromSheets: Loaded ${productsRows.length} products and ${photosRows.length} photos`);
    
    // Create a map of product_id -> photos
    // Columns: A=id, B=product_id, C=photo_filename, D=photo_url, E=photo_order, F=is_main
    const photosMap = {};
    photosRows.forEach((row, index) => {
      const productId = row[1];      // B: product_id
      const filename = row[2];       // C: photo_filename
      const order = row[4];          // E: photo_order
      const isMain = row[5];         // F: is_main
      
      if (index < 3) {
        console.log(`Photo row ${index}:`, { productId, filename, order, isMain });
      }
      
      if (!productId || !filename) {
        return; // Skip rows without product_id or filename
      }
      
      if (!photosMap[productId]) {
        photosMap[productId] = [];
      }
      photosMap[productId].push({
        filename: filename,
        is_main: isMain === 'true' || isMain === true || isMain === 'TRUE',
        order: parseInt(order) || 0
      });
    });
    
    console.log(`PhotosMap keys sample:`, Object.keys(photosMap).slice(0, 5));

    // Map products with their photos
    const products = productsRows
      .filter(row => row[8] === 'processed') // Filter by status column (I)
      .map((row) => {
        const productId = row[0]; // product_id (A) - это же folder_path
        const folderPath = row[1]; // folder_path (B)
        const photos = photosMap[productId] || [];
        
        // Sort photos by order and get main photo first
        photos.sort((a, b) => {
          if (a.is_main && !b.is_main) return -1;
          if (!a.is_main && b.is_main) return 1;
          return a.order - b.order;
        });

        // Construct image URLs using productId as folder path
        const baseUrl = 'https://app-unique.vercel.app';
        const images = photos.map(photo => 
          `${baseUrl}/images/${productId}/${photo.filename}`
        );

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to check environment variables
app.get('/debug/env', (req, res) => {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID } = process.env;
  
  res.json({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'SET' : 'NOT SET',
    GOOGLE_PRIVATE_KEY: GOOGLE_PRIVATE_KEY ? `SET (length: ${GOOGLE_PRIVATE_KEY.length})` : 'NOT SET',
    GOOGLE_SHEETS_SPREADSHEET_ID: GOOGLE_SHEETS_SPREADSHEET_ID ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV || 'not set'
  });
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
