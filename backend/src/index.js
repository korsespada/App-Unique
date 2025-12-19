// Load environment variables first
require('dotenv').config({ path: '.env' });

// Check for required environment variables
const checkEnvVars = () => {
  const envVars = {
    // Required for Telegram bot functionality
    BOTTOKEN: {
      required: false,
      message: 'Bot token is missing - Telegram bot features will be disabled'
    },
    BOT_TOKEN: {
      required: false,
      message: 'Bot token is missing - Telegram bot features will be disabled'
    },
    MANAGERCHATID: {
      required: false,
      message: 'Manager chat ID is missing - Order notifications will not be sent'
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
    const isAliasSatisfied =
      (key === 'BOT_TOKEN' && !!process.env.BOTTOKEN) ||
      (key === 'BOTTOKEN' && !!process.env.BOT_TOKEN) ||
      (key === 'MANAGER_CHAT_ID' && !!process.env.MANAGERCHATID) ||
      (key === 'MANAGERCHATID' && !!process.env.MANAGER_CHAT_ID);

    if (!process.env[key] && !isAliasSatisfied) {
      if (required) {
        console.error(`❌ Missing required environment variable: ${key}`);
        hasCriticalError = true;
      } else {
        console.warn(`⚠️  ${message} (${key})`);
      }
    }
  });

  const botToken = process.env.BOTTOKEN || process.env.BOT_TOKEN;
  const managerChatId = process.env.MANAGERCHATID || process.env.MANAGER_CHAT_ID;

  return {
    isBotEnabled: !!botToken && !!managerChatId,
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

  const imagesBaseUrlRaw = process.env.VK_IMAGES_BASE_URL || process.env.IMAGES_BASE_URL || '';
  const imagesBaseUrl = String(imagesBaseUrlRaw).trim().replace(/\/$/, '');

  try {
    if (!fs.existsSync(imagesDir)) {
      return [];
    }

    const files = fs.readdirSync(imagesDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => name.toLowerCase().endsWith('.jpg'))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (imagesBaseUrl) {
      return files.map((filename) => `${imagesBaseUrl}/images/${productId}/${filename}`);
    }

    return files.map((filename) => `/images/${productId}/${filename}`);
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

app.post(['/orders', '/api/orders'], async (req, res) => {
  try {
    const { telegramUserId, username, firstname, lastname, items } = req.body;

    if (!telegramUserId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные заказа' });
    }

    const botToken = process.env.BOTTOKEN || process.env.BOT_TOKEN;
    const managerChatId = process.env.MANAGERCHATID || process.env.MANAGER_CHAT_ID;

    if (!botToken || !managerChatId) {
      return res.status(500).json({ error: 'Бот не сконфигурирован' });
    }

    let hasUnknownPrice = false;
    const total = items.reduce((sum, it) => {
      const qty = Number(it?.quantity) || 1;
      const hasPrice = it?.hasPrice === false ? false : true;
      const price = Number(it?.price);
      if (!hasPrice || !Number.isFinite(price) || price <= 0) {
        hasUnknownPrice = true;
        return sum;
      }
      return sum + price * qty;
    }, 0);

    const escapeHtml = (value) => {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const safeFirst = escapeHtml((firstname || '').trim());
    const safeLast = escapeHtml((lastname || '').trim());
    const safeUsername = escapeHtml((username || '').trim());
    const safeTelegramId = escapeHtml(String(telegramUserId));

    const orderText = [
      '🆕 Новый заказ из Telegram Mini App',
      '',
      `👤 Клиент: ${`${safeFirst} ${safeLast}`.trim()}`.trim(),
      safeUsername ? `@${safeUsername}` : 'username: отсутствует',
      `Telegram ID: <code>${safeTelegramId}</code>`,
      '',
      '🛒 Товары:'
    ]
      .concat(
        items.map((it, idx) => {
          const qty = Number(it?.quantity) || 1;
          const hasPrice = it?.hasPrice === false ? false : true;
          const price = Number(it?.price);
          const title = escapeHtml(String(it?.title || '').trim() || 'Без названия');
          const id = escapeHtml(String(it?.id || '').trim() || '-');

          if (!hasPrice || !Number.isFinite(price) || price <= 0) {
            return `${idx + 1}. ${title} (id: <code>${id}</code>) — ${qty} шт — цена уточняется`;
          }

          const lineTotal = price * qty;
          return `${idx + 1}. ${title} (id: <code>${id}</code>) — ${qty} шт × ${price} ₽ = ${lineTotal} ₽`;
        })
      )
      .concat([
        '',
        hasUnknownPrice
          ? (total > 0 ? `💰 Итого (без товаров с уточняемой ценой): ${escapeHtml(String(total))} ₽` : '💰 Итого: цена уточняется')
          : `💰 Итого: ${escapeHtml(String(total))} ₽`,
        '',
        'Доп. данные (адрес, телефон) пока не заполняются в мини-приложении.'
      ])
      .join('\n');

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    await axios.post(url, {
      chat_id: managerChatId,
      text: orderText,
      parse_mode: 'HTML'
    });

    console.log('Заказ отправлен менеджеру', { telegramUserId, itemsCount: items.length });

    return res.json({
      ok: true,
      orderId: Date.now().toString()
    });
  } catch (error) {
    console.error('Ошибка отправки заказа менеджеру', error?.response?.data || error.message);
    return res.status(500).json({ error: 'Не удалось отправить заказ менеджеру' });
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
