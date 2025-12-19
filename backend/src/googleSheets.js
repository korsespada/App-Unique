const { google } = require('googleapis');
const NodeCache = require('node-cache');

// Cache for 60 seconds
const cache = new NodeCache({ stdTTL: 60 });
const CACHE_KEY = 'productsAndPhotos';
const PUBLIC_PRODUCTS_CACHE_KEY = 'publicProducts';

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function buildHeaderIndex(headersRow) {
  const headers = Array.isArray(headersRow) ? headersRow : [];
  const idx = {};
  headers.forEach((h, i) => {
    const key = normalizeHeader(h);
    if (!key) return;
    if (idx[key] == null) idx[key] = i;
  });
  return idx;
}

function looksLikeHeaderRow(row) {
  if (!Array.isArray(row)) return false;
  const normalized = row.map(normalizeHeader);
  return (
    normalized.includes('product_id') ||
    normalized.includes('photo_filename') ||
    normalized.includes('photo_order') ||
    normalized.includes('is_main') ||
    normalized.includes('status')
  );
}

function parseBoolean(value, defaultValue) {
  if (value == null || value === '') return defaultValue;
  const v = String(value).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return defaultValue;
}

function parsePrice(value) {
  const raw = String(value ?? '').replace(/\s+/g, '').replace(',', '.');
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function normalizePhotoFilename(value) {
  const filename = String(value || '').trim();
  if (!filename) return filename;
  if (/\.[a-z0-9]+$/i.test(filename)) return filename;
  return `${filename}.jpg`;
}

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
    
    const productsData = await getSheetData(auth, 'products_processed!A1:Z');
    const photosData = await getSheetData(auth, 'product_photos!A1:Z');

    let productsRows = Array.isArray(productsData) ? productsData : [];
    let productsHeader = null;
    if (productsRows.length && looksLikeHeaderRow(productsRows[0])) {
      productsHeader = buildHeaderIndex(productsRows[0]);
      productsRows = productsRows.slice(1);
    }

    const products = productsRows
      .map((row) => {
        if (!Array.isArray(row)) return null;

        if (productsHeader) {
          const pidIdx = productsHeader.product_id ?? productsHeader.id;
          const nameIdx = productsHeader.name ?? productsHeader.title;
          const descriptionIdx = productsHeader.description;
          const categoryIdx = productsHeader.category;
          const brandIdx = productsHeader.brand;
          const priceIdx = productsHeader.price;
          const statusIdx = productsHeader.status;
          const inStockIdx = productsHeader.in_stock ?? productsHeader.instock;

          const id = pidIdx != null ? row[pidIdx] : row[0];
          const status = statusIdx != null ? row[statusIdx] : undefined;

          if (status != null && String(status).trim() && String(status).trim() !== 'processed') {
            return null;
          }

          return {
            id: String(id || '').trim(),
            title: String((nameIdx != null ? row[nameIdx] : '') || 'Unnamed Product'),
            description: String((descriptionIdx != null ? row[descriptionIdx] : '') || ''),
            brand: String((brandIdx != null ? row[brandIdx] : '') || 'Unknown Brand'),
            category: String((categoryIdx != null ? row[categoryIdx] : '') || 'uncategorized'),
            price: parsePrice(priceIdx != null ? row[priceIdx] : 0),
            inStock: parseBoolean(inStockIdx != null ? row[inStockIdx] : undefined, true),
          };
        }

        const inStockRaw = row[6];
        const inStockMaybe = parseBoolean(inStockRaw, undefined);
        const isOldFormat = typeof inStockMaybe === 'boolean';

        if (isOldFormat) {
          return {
            id: String(row[0] || '').trim(),
            title: row[1] || 'Unnamed Product',
            description: row[2] || '',
            brand: row[3] || 'Unknown Brand',
            category: row[4] || 'uncategorized',
            price: parsePrice(row[5]),
            inStock: inStockMaybe,
          };
        }

        const status = row[6];
        if (status != null && String(status).trim() && String(status).trim() !== 'processed') {
          return null;
        }

        return {
          id: String(row[0] || '').trim(),
          title: row[1] || 'Unnamed Product',
          description: row[2] || '',
          category: row[3] || 'uncategorized',
          brand: row[4] || 'Unknown Brand',
          price: parsePrice(row[5]),
          inStock: true,
        };
      })
      .filter((p) => p && p.id);

    let photosRows = Array.isArray(photosData) ? photosData : [];
    let photosHeader = null;
    if (photosRows.length && looksLikeHeaderRow(photosRows[0])) {
      photosHeader = buildHeaderIndex(photosRows[0]);
      photosRows = photosRows.slice(1);
    }

    const photos = photosRows
      .map((row) => {
        if (!Array.isArray(row)) return null;

        if (photosHeader) {
          const productIdIdx = photosHeader.product_id;
          const filenameIdx = photosHeader.photo_filename ?? photosHeader.filename;
          const orderIdx = photosHeader.photo_order ?? photosHeader.order;
          const isMainIdx = photosHeader.is_main;

          const productId = productIdIdx != null ? row[productIdIdx] : '';
          const filename = filenameIdx != null ? row[filenameIdx] : '';
          const order = orderIdx != null ? row[orderIdx] : 0;
          const isMain = isMainIdx != null ? row[isMainIdx] : false;

          return {
            product_id: String(productId || '').trim(),
            filename: normalizePhotoFilename(filename) || 'default.jpg',
            is_main: parseBoolean(isMain, false),
            order: parseInt(order) || 0,
          };
        }

        if (row.length >= 5) {
          return {
            product_id: String(row[1] || '').trim(),
            filename: normalizePhotoFilename(row[2]) || 'default.jpg',
            is_main: parseBoolean(row[4], false),
            order: parseInt(row[3]) || 0,
          };
        }

        return {
          product_id: String(row[0] || '').trim(),
          filename: normalizePhotoFilename(row[1]) || 'default.jpg',
          is_main: parseBoolean(row[2], false),
          order: parseInt(row[3]) || 0,
        };
      })
      .filter((p) => p && p.product_id);

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

    const rows = await getSheetData(auth, 'products_processed!A1:Z');

    let dataRows = Array.isArray(rows) ? rows : [];
    let header = null;
    if (dataRows.length && looksLikeHeaderRow(dataRows[0])) {
      header = buildHeaderIndex(dataRows[0]);
      dataRows = dataRows.slice(1);
    }

    const products = dataRows
      .map((row) => {
        if (!Array.isArray(row)) return null;

        if (header) {
          const pidIdx = header.product_id ?? header.id;
          const descriptionIdx = header.description;
          const categoryIdx = header.category;
          const statusIdx = header.status;

          const productId = pidIdx != null ? row[pidIdx] : row[0];
          return {
            product_id: String(productId || '').trim(),
            description: String((descriptionIdx != null ? row[descriptionIdx] : '') || ''),
            category: String((categoryIdx != null ? row[categoryIdx] : '') || ''),
            season_title: '',
            status: String((statusIdx != null ? row[statusIdx] : '') || ''),
          };
        }

        return {
          product_id: String(row[0] || '').trim(),
          description: String(row[2] || ''),
          category: String(row[3] || ''),
          season_title: '',
          status: String(row[6] || ''),
        };
      })
      .filter((p) => p && p.product_id);

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
