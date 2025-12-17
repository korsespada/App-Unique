// Load environment variables first
require('dotenv').config({ path: '.env' });

// Check for required environment variables
const checkEnvVars = () => {
  const envVars = {
    // Required for Telegram bot functionality
    BOT_TOKEN: {
      required: false,
      message: 'Bot token is missing - Telegram bot features will be disabled'
    },
    MANAGER_CHAT_ID: {
      required: false,
      message: 'Manager chat ID is missing - Order notifications will not be sent'
    },
    // Required for Google Sheets integration
    GOOGLE_SERVICE_ACCOUNT_EMAIL: {
      required: false,
      message: 'Google service account email is missing - Using mock data'
    },
    GOOGLE_PRIVATE_KEY: {
      required: false,
      message: 'Google private key is missing - Using mock data'
    },
    GOOGLE_SHEETS_SPREADSHEET_ID: {
      required: false,
      message: 'Google Sheets ID is missing - Using mock data'
    }
  };

  let hasCriticalError = false;
  
  Object.entries(envVars).forEach(([key, { required, message }]) => {
    if (!process.env[key]) {
      if (required) {
        console.error(`❌ Missing required environment variable: ${key}`);
        hasCriticalError = true;
      } else {
        console.warn(`⚠️  ${message} (${key})`);
      }
    }
  });

  return {
    isBotEnabled: !!process.env.BOT_TOKEN && !!process.env.MANAGER_CHAT_ID,
    isGoogleSheetsEnabled: !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    )
  };
};

const { isBotEnabled, isGoogleSheetsEnabled } = checkEnvVars();

if (!isBotEnabled) {
  console.warn('⚠️  Bot functionality is disabled due to missing configuration');
}

if (!isGoogleSheetsEnabled) {
  console.warn('⚠️  Google Sheets integration is disabled - Using mock data');
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const NodeCache = require('node-cache');
const { loadProductsAndPhotos, loadPublicProducts } = require('./googleSheets');

const app = express();
const PORT = process.env.PORT || 3000;

const externalProductsCache = new NodeCache({ stdTTL: 60 });

// In-memory storage for profiles (in production, use a database)
const profiles = new Map();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Middleware to load products and photos for each request
async function loadData() {
  try {
    console.log('Loading data from Google Sheets...');
    const data = await loadProductsAndPhotos();
    console.log('Successfully loaded data from Google Sheets');
    return data;
  } catch (error) {
    console.error('Error loading data from Google Sheets:', error.message);
    throw error;
  }
}

// Helper function to get product with photos
function getProductWithPhotos(product, photos) {
  const productPhotos = photos
    .filter(photo => photo.product_id === product.id)
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(photo => ({
      ...photo,
      url: `/images/${product.id}/${photo.filename}`
    }));

  return {
    ...product,
    photos: productPhotos
  };
}

function getProductImages(productId) {
  if ((process.env.DISABLE_IMAGES || '').toLowerCase() === 'true') {
    return [];
  }

  const imagesDir = path.join(__dirname, '..', 'public', 'images', productId);

  try {
    if (!fs.existsSync(imagesDir)) {
      return [];
    }

    const files = fs.readdirSync(imagesDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => name.toLowerCase().endsWith('.jpg'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const baseUrl = 'https://back-unique.vercel.app';
    return files.map((filename) => `${baseUrl}/images/${productId}/${filename}`);
  } catch (error) {
    console.error(`Error reading images for product ${productId}:`, error.message);
    return [];
  }
}

// Routes
app.get('/api/:version/:shop/external-products', async (req, res) => {
  const { version, shop } = req.params;
  const cacheKey = `external-products:${version}:${shop}`;

  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const upstreamUrl = 'https://app-unique.vercel.app/api/products';

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

app.get('/api/external-products', async (req, res) => {
  const cacheKey = 'external-products:default';

  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const upstreamUrl = 'https://app-unique.vercel.app/api/products';

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

app.get('/api/products', async (req, res) => {
  try {
    const products = await loadPublicProducts();

    const result = products.map((p) => ({
      product_id: p.product_id,
      description: p.description,
      category: p.category,
      season_title: p.season_title,
      status: p.status,
      images: getProductImages(p.product_id),
    }));

    res.json({ products: result });
  } catch (error) {
    console.error('Error in /api/products:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.get('/products', async (req, res) => {
  try {
    const { products, photos } = await loadData();
    let filteredProducts = [...products];
    
    // Apply filters
    if (req.query.search) {
      const searchTerm = req.query.search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        p => p.title.toLowerCase().includes(searchTerm) ||
             p.description?.toLowerCase().includes(searchTerm)
      );
    }
    
    if (req.query.category) {
      filteredProducts = filteredProducts.filter(
        p => p.category === req.query.category
      );
    }
    
    if (req.query.brand) {
      filteredProducts = filteredProducts.filter(
        p => p.brand === req.query.brand
      );
    }
    
    res.json(filteredProducts.map(p => getProductWithPhotos(p, photos)));
  } catch (error) {
    console.error('Error in /products:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const { products, photos } = await loadData();
    const product = products.find(p => p.id === req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(getProductWithPhotos(product, photos));
  } catch (error) {
    console.error('Error in /products/:id:', error);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

app.get('/profile', (req, res) => {
  const { telegramUserId } = req.query;
  if (!telegramUserId) {
    return res.status(400).json({ error: 'telegramUserId is required' });
  }
  
  const profile = profiles.get(telegramUserId) || { telegramUserId };
  res.json(profile);
});

app.post('/profile', (req, res) => {
  const { telegramUserId, ...profileData } = req.body;
  if (!telegramUserId) {
    return res.status(400).json({ error: 'telegramUserId is required' });
  }
  
  profiles.set(telegramUserId, { ...profileData, telegramUserId });
  res.json({ success: true });
});

app.post('/orders', async (req, res) => {
  const { items, address, telegramUser } = req.body;
  
  if (!items || !address || !telegramUser || !telegramUser.id) {
    return res.status(400).json({ error: 'Invalid order data' });
  }
  
  try {
    // Load current products to calculate total
    const { products } = await loadData();
    
    // Calculate total
    const total = items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    
    // Format message for Telegram
    const message = `
🛒 *New Order* 🛒

👤 *Customer*: ${telegramUser.first_name} ${telegramUser.last_name || ''} (@${telegramUser.username || 'no_username'})
📱 *User ID*: ${telegramUser.id}

📦 *Order Items*:
${items.map(item => {
  const product = products.find(p => p.id === item.productId);
  return `- ${product?.title || 'Unknown Product'} x${item.quantity} - $${(product?.price * item.quantity).toFixed(2)}`;
}).join('\n')}

💵 *Total*: $${total.toFixed(2)}

🏠 *Delivery Address*:
${Object.entries(address).map(([key, value]) => `- ${key}: ${value}`).join('\n')}
`;

    // Send message to Telegram
    await axios.post(
      `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
      {
        chat_id: process.env.MANAGER_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing order:', error);
    res.status(500).json({ error: 'Failed to process order' });
  }
});

// Start server
const server = require('http').createServer(app);

async function startServer() {
  const port = await getAvailablePort(PORT);
  
  server.listen(port, () => {
    console.log(`\n=== Server is running ===`);
    console.log(`Local:   http://localhost:${port}`);
    console.log(`API:     http://localhost:${port}/api`);
    console.log(`Health:  http://localhost:${port}/health\n`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying next port...`);
      startServer();
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });
}

// Helper function to find an available port
function getAvailablePort(desiredPort) {
  return new Promise((resolve, reject) => {
    const server = require('http').createServer();
    
    server.listen(desiredPort, '0.0.0.0');
    
    server.on('listening', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try the next port
        getAvailablePort(0).then(resolve);
      } else {
        reject(err);
      }
    });
  });
}

// Start the server
loadData()
  .then(() => startServer())
  .catch(error => {
    console.error('Failed to load initial data:', error);
    console.log('Starting server with mock data...');
    startServer(); // Start server anyway with mock data
  });
