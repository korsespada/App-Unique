// Serverless function wrapper for Vercel
const path = require('path');

// Set the correct path for .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import the app after env is loaded
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');
const { validateTelegramInitData } = require('../src/telegramWebAppAuth');
const { listActiveProducts } = require('../src/pocketbaseClient');

const app = express();

const normalizeDescription = (s) =>
  typeof s === 'string' ? s.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n') : s;

function normalizeProductDescriptions(payload) {
  if (!payload) return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeProductDescriptions(item));
  }

  if (typeof payload !== 'object') return payload;

  if (Array.isArray(payload.products)) {
    return {
      ...payload,
      products: payload.products.map((p) => ({
        ...p,
        description: normalizeDescription(p?.description),
      })),
    };
  }

  if ('description' in payload) {
    return {
      ...payload,
      description: normalizeDescription(payload.description),
    };
  }

  return payload;
}

let cachedBotUsername = null;

async function getBotUsername(botToken) {
  const fromEnv = String(process.env.BOT_USERNAME || '').trim().replace(/^@/, '');
  if (fromEnv) return fromEnv;
  if (cachedBotUsername) return cachedBotUsername;

  try {
    const url = `https://api.telegram.org/bot${botToken}/getMe`;
    const resp = await axios.get(url);
    const username = resp?.data?.result?.username ? String(resp.data.result.username) : '';
    cachedBotUsername = username;
    return username;
  } catch {
    return '';
  }
}

function buildProductStartParam(productId) {
  return `product_${String(productId)}`;
}

function buildMiniAppLink(botUsername, startParam) {
  const safeUsername = String(botUsername || '').replace(/^@/, '').trim();
  if (!safeUsername) return null;
  return `https://t.me/${safeUsername}?startapp=${encodeURIComponent(String(startParam || ''))}`;
}

// Middleware
const corsAllowList = String(process.env.CORS_ALLOW_ORIGINS || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsAllowList.length === 0) return callback(null, true);
      const ok = corsAllowList.includes(origin);
      return callback(ok ? null : new Error('Not allowed by CORS'), ok);
    }
  })
);
app.use(express.json());

const externalProductsCache = new NodeCache({ stdTTL: 60 });

async function getCachedActiveProducts() {
  const cacheKey = 'pb:active-products';
  const cached = externalProductsCache.get(cacheKey);
  if (cached) return cached;

  const products = await listActiveProducts();
  externalProductsCache.set(cacheKey, products);
  return products;
}

// Legacy name kept, but source is now PocketBase
async function loadProductsFromSheets() {
  try {
    const pbProducts = await listActiveProducts();
    return pbProducts.map((p) => ({
      id: String(p.id || '').trim(),
      title: String(p.title || p.name || ''),
      brand: String(p.brand || ''),
      price: Number(p.price) || 0,
      description: String(p.description || ''),
      images: Array.isArray(p.images) ? p.images : [],
      category: String(p.category || ''),
      seo_title: '',
      inStock: true,
    }));
  } catch (error) {
    console.error('Error loading products from PocketBase:', error?.message || error);
    return null;
  }
}

async function handleExternalProducts(req, res, cacheKey) {
  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    return res.json(normalizeProductDescriptions(cached));
  }

  const products = await getCachedActiveProducts();
  const payload = normalizeProductDescriptions({ products });
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

app.get('/api/products', async (req, res) => {
  try {
    const products = await getCachedActiveProducts();
    const result = products.map((p) => ({
      product_id: String(p.product_id || p.id || '').trim(),
      description: normalizeDescription(p.description),
      category: String(p.category || ''),
      season_title: String(p.season_title || p.brand || ''),
      status: String(p.status || ''),
      images: Array.isArray(p.images) ? p.images : [],
    }));

    return res.json({ products: result });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load products', message: error?.message });
  }
});

app.get('/products', async (req, res) => {
  try {
    const products = await getCachedActiveProducts();

    let filteredProducts = [...products];

    if (req.query.search) {
      const searchTerm = String(req.query.search).toLowerCase();
      filteredProducts = filteredProducts.filter(
        (p) =>
          String(p.title || '').toLowerCase().includes(searchTerm) ||
          String(p.description || '').toLowerCase().includes(searchTerm)
      );
    }

    if (req.query.category) {
      filteredProducts = filteredProducts.filter((p) => String(p.category || '') === String(req.query.category));
    }

    if (req.query.brand) {
      filteredProducts = filteredProducts.filter((p) => String(p.brand || '') === String(req.query.brand));
    }

    return res.json(
      filteredProducts.map((p) => ({
        ...p,
        description: normalizeDescription(p?.description),
        photos: (Array.isArray(p.images) ? p.images : []).map((url) => ({ url })),
      }))
    );
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load products', message: error?.message });
  }
});

app.get(['/api/products/:id', '/products/:id'], async (req, res) => {
  try {
    const products = await getCachedActiveProducts();
    const id = String(req.params.id || '').trim();
    const product = products.find((p) => String(p.id || p.product_id || '').trim() === id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    return res.json({
      ...product,
      description: normalizeDescription(product?.description),
      photos: (Array.isArray(product.images) ? product.images : []).map((url) => ({ url })),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load product', message: error?.message });
  }
});

app.post(['/orders', '/api/orders'], async (req, res) => {
  try {
    const botToken = process.env.BOTTOKEN || process.env.BOT_TOKEN;
    const managerChatId = process.env.MANAGERCHATID || process.env.MANAGER_CHAT_ID;

    if (!botToken || !managerChatId) {
      return res.status(500).json({ error: 'Бот не сконфигурирован' });
    }

    const { initData, items } = req.body;

    const auth = validateTelegramInitData(initData, botToken, {
      maxAgeSeconds: Number(process.env.TG_INITDATA_MAX_AGE_SECONDS || 86400)
    });
    if (!auth.ok) {
      console.warn('initData validation failed', {
        error: auth.error,
        debug: auth.debug,
        initDataLen: String(initData ?? '').length,
        hasHashParam: String(initData ?? '').includes('hash='),
        hasSignatureParam: String(initData ?? '').includes('signature='),
      });
      return res.status(401).json({ error: auth.error || 'initData невалиден' });
    }

    const user = auth.user || null;
    const telegramUserId = user?.id ? String(user.id) : '';
    const username = user?.username ? String(user.username) : '';
    const firstname = user?.first_name ? String(user.first_name) : '';
    const lastname = user?.last_name ? String(user.last_name) : '';

    if (!telegramUserId) {
      return res.status(400).json({ error: 'Некорректные данные пользователя Telegram' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные заказа' });
    }

    if (items.length > 50) {
      return res.status(400).json({ error: 'Слишком много позиций в заказе' });
    }

    const normalizedItems = items
      .map((it) => {
        const id = String(it?.id ?? '').trim().slice(0, 80);
        const title = String(it?.title ?? '').trim().slice(0, 120);
        const quantity = Math.min(99, Math.max(1, Number(it?.quantity) || 1));
        const hasPrice = it?.hasPrice === false ? false : true;
        const price = hasPrice ? Number(it?.price) : NaN;

        return {
          id,
          title,
          quantity,
          hasPrice,
          price: hasPrice ? price : null,
        };
      })
      .filter((it) => it.id && it.title);

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: 'Некорректные данные заказа' });
    }

    let hasUnknownPrice = false;
    const total = normalizedItems.reduce((sum, it) => {
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

    const botUsername = await getBotUsername(botToken);

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
        normalizedItems.map((it, idx) => {
          const qty = Number(it?.quantity) || 1;
          const hasPrice = it?.hasPrice === false ? false : true;
          const price = Number(it?.price);
          const titleText = escapeHtml(String(it?.title || '').trim() || 'Без названия');
          const id = escapeHtml(String(it?.id || '').trim() || '-');

          const startParam = buildProductStartParam(String(it?.id || '').trim());
          const link = buildMiniAppLink(botUsername, startParam);
          const title = link ? `<a href="${escapeHtml(link)}">${titleText}</a>` : titleText;

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

    console.log('Заказ отправлен менеджеру', { telegramUserId, itemsCount: normalizedItems.length });

    return res.json({
      ok: true,
      orderId: Date.now().toString()
    });
  } catch (error) {
    console.error('Ошибка отправки заказа менеджеру', error?.response?.data || error.message);
    return res.status(500).json({ error: 'Не удалось отправить заказ менеджеру' });
  }
});

// Export for Vercel serverless
module.exports = app;
