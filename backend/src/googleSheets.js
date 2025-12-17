const { google } = require('googleapis');
const NodeCache = require('node-cache');

// Cache for 60 seconds
const cache = new NodeCache({ stdTTL: 60 });
const CACHE_KEY = 'productsAndPhotos';
const PUBLIC_PRODUCTS_CACHE_KEY = 'publicProducts';

// Mock data for when Google Sheets is not configured
const MOCK_PRODUCTS = [
  {
    id: '1',
    title: 'Sample Product',
    description: 'This is a sample product (mock data)',
    brand: 'Sample Brand',
    category: 'sample',
    price: 9.99,
    inStock: true
  }
];

const MOCK_PUBLIC_PRODUCTS = [
  {
    product_id: 'b4681a56-50a',
    description: 'Mock description',
    category: 'Mock category',
    season_title: 'Mock season',
    status: 'processed'
  }
];

const MOCK_PHOTOS = [
  {
    product_id: '1',
    filename: 'sample.jpg',
    is_main: true,
    order: 1
  }
];

function getAuthClient() {
  const { GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
  
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    console.warn('Google Sheets credentials not configured - using mock data');
    return null;
  }

  try {
    return new google.auth.JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } catch (error) {
    console.error('Error creating Google Sheets auth client:', error.message);
    return null;
  }
}

async function getSheetData(auth, range) {
  if (!auth) {
    console.warn('Google Sheets not configured - returning mock data');
    return range.includes('products') ?
      MOCK_PRODUCTS.map(p => [p.id, p.title, p.description, p.brand, p.category, p.price, p.inStock]) :
      MOCK_PHOTOS.map(p => [p.product_id, p.filename, p.is_main, p.order]);
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range,
    });
    return response.data.values || [];
  } catch (error) {
    console.error('Error fetching data from Google Sheets:', error.message);
    return [];
  }
}

async function loadProductsAndPhotos() {
  // Check cache first
  const cachedData = cache.get(CACHE_KEY);
  if (cachedData) {
    return cachedData;
  }

  try {
    const auth = await getAuthClient();
    
    // Load products
    const productsData = await getSheetData(auth, 'products_processed!A2:G');
    const products = productsData.map(row => ({
      id: row[0] || '',
      title: row[1] || 'Unnamed Product',
      description: row[2] || '',
      brand: row[3] || 'Unknown Brand',
      category: row[4] || 'uncategorized',
      price: parseFloat(row[5]) || 0,
      inStock: row[6] ? row[6].toLowerCase() === 'true' : true,
    }));

    // Load photos
    const photosData = await getSheetData(auth, 'product_photos!A2:D');
    const photos = photosData.map(row => ({
      product_id: row[0] || '',
      filename: row[1] || 'default.jpg',
      is_main: row[2] ? row[2].toLowerCase() === 'true' : false,
      order: parseInt(row[3]) || 0,
    }));

    const result = { 
      products: products.length ? products : MOCK_PRODUCTS,
      photos: photos.length ? photos : MOCK_PHOTOS
    };
    
    // Cache the result
    cache.set(CACHE_KEY, result);
    
    return result;
  } catch (error) {
    console.error('Error in loadProductsAndPhotos:', error.message);
    // Return mock data in case of error
    return {
      products: MOCK_PRODUCTS,
      photos: MOCK_PHOTOS
    };
  }
}

async function loadPublicProducts() {
  const cachedData = cache.get(PUBLIC_PRODUCTS_CACHE_KEY);
  if (cachedData) {
    return cachedData;
  }

  try {
    const auth = await getAuthClient();

    if (!auth) {
      cache.set(PUBLIC_PRODUCTS_CACHE_KEY, MOCK_PUBLIC_PRODUCTS);
      return MOCK_PUBLIC_PRODUCTS;
    }

    const rows = await getSheetData(auth, 'products_processed!A2:H');

    const products = rows.map((row) => ({
      product_id: row[0] || '',
      description: row[3] || '',
      category: row[4] || row[6] || '',
      season_title: row[5] || '',
      status: row[7] || ''
    })).filter(p => p.product_id);

    const result = products.length ? products : MOCK_PUBLIC_PRODUCTS;
    cache.set(PUBLIC_PRODUCTS_CACHE_KEY, result);
    return result;
  } catch (error) {
    console.error('Error in loadPublicProducts:', error.message);
    return MOCK_PUBLIC_PRODUCTS;
  }
}

module.exports = {
  loadProductsAndPhotos,
  loadPublicProducts,
};
