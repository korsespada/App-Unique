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
const { listActiveProducts, listAllActiveProducts } = require('../src/pocketbaseClient');

const app = express();

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function extractAxiosStatus(err) {
  const status = err?.response?.status;
  return Number.isFinite(status) ? status : null;
}

function extractAxiosMessage(err) {
  const data = err?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    const msg = data.message || data.error || data.detail;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  return 'Request failed';
}

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

function hashStringToUint32(seed) {
  const str = String(seed ?? '');
  let x = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    x ^= str.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  return x >>> 0;
}

function shuffleDeterministic(items, seed) {
  const arr = Array.isArray(items) ? items.slice() : [];
  let x = hashStringToUint32(seed);

  const rand = () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }

  return arr;
}

function mixByCategoryRoundRobin(products, seed) {
  const list = Array.isArray(products) ? products : [];
  if (list.length <= 1) return list;

  const byCategory = new Map();
  for (const p of list) {
    const category = String(p?.category ?? '').trim() || '__unknown__';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(p);
  }

  const categories = Array.from(byCategory.keys());
  const shuffledCategories = shuffleDeterministic(categories, `categories:${seed}`);
  for (const c of shuffledCategories) {
    const items = byCategory.get(c) || [];
    byCategory.set(c, shuffleDeterministic(items, `category:${c}:${seed}`));
  }

  const pointers = new Map(shuffledCategories.map((c) => [c, 0]));
  const remaining = new Set(shuffledCategories);
  const out = [];

  while (remaining.size) {
    let progressed = false;
    for (const c of shuffledCategories) {
      if (!remaining.has(c)) continue;
      const items = byCategory.get(c) || [];
      const idx = pointers.get(c) || 0;
      if (idx >= items.length) {
        remaining.delete(c);
        continue;
      }
      out.push(items[idx]);
      pointers.set(c, idx + 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  return out;
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

function splitTelegramMessage(text, maxLen = 3500) {
  const raw = String(text ?? '');
  if (raw.length <= maxLen) return [raw];

  const lines = raw.split('\n');
  const parts = [];
  let current = '';

  const pushCurrent = () => {
    if (current) parts.push(current);
    current = '';
  };

  for (const line of lines) {
    const chunk = current ? `${current}\n${line}` : line;
    if (chunk.length <= maxLen) {
      current = chunk;
      continue;
    }

    pushCurrent();

    if (line.length <= maxLen) {
      current = line;
      continue;
    }

    // Fallback: split a single very long line
    for (let i = 0; i < line.length; i += maxLen) {
      parts.push(line.slice(i, i + maxLen));
    }
  }

  pushCurrent();
  return parts.length ? parts : [''];
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
let lastGoodAllActiveProducts = null;

function setCatalogCacheHeaders(res) {
  res.set('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
}

async function getAllActiveProductsSafe(perPage) {
  try {
    const pbAll = await listAllActiveProducts(perPage);
    lastGoodAllActiveProducts = pbAll;
    return pbAll;
  } catch (err) {
    if (lastGoodAllActiveProducts) {
      console.warn('PocketBase unavailable, serving last known products snapshot');
      return lastGoodAllActiveProducts;
    }
    throw err;
  }
}

async function handleCatalogFilters(req, res) {
  const cacheKey = 'catalog-filters:v1';
  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    setCatalogCacheHeaders(res);
    return res.json(cached);
  }

  const pbAll = await getAllActiveProductsSafe(2000);
  const items = Array.isArray(pbAll?.items) ? pbAll.items : [];

  const categoriesSet = new Set();
  const brandsSet = new Set();
  const brandsByCategory = {};

  for (const p of items) {
    const category = String(p?.category || '').trim();
    const brand = String(p?.brand || '').trim();

    if (category) categoriesSet.add(category);
    if (brand) brandsSet.add(brand);

    if (category && brand) {
      if (!brandsByCategory[category]) brandsByCategory[category] = new Set();
      brandsByCategory[category].add(brand);
    }
  }

  const categories = Array.from(categoriesSet).sort((a, b) => a.localeCompare(b));
  const brands = Array.from(brandsSet).sort((a, b) => a.localeCompare(b));
  const brandsByCategoryPlain = Object.fromEntries(
    Object.entries(brandsByCategory).map(([cat, set]) => [cat, Array.from(set).sort((a, b) => a.localeCompare(b))])
  );

  const payload = { categories, brands, brandsByCategory: brandsByCategoryPlain };
  externalProductsCache.set(cacheKey, payload);
  setCatalogCacheHeaders(res);
  return res.json(payload);
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

async function handleExternalProducts(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Math.min(200, Number(req.query.perPage) || 40));
  const seed = String(req.query.seed || '').trim();

  const search = String(req.query.search || '').trim();
  const brand = String(req.query.brand || '').trim();
  const category = String(req.query.category || '').trim();

  const cacheKey = `external-products:${page}:${perPage}:${search}:${brand}:${category}:${seed}`;
  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    setCatalogCacheHeaders(res);
    return res.json(normalizeProductDescriptions(cached));
  }

  const pbAll = await getAllActiveProductsSafe(2000);

  const q = search.toLowerCase();
  const items = Array.isArray(pbAll?.items) ? pbAll.items : [];
  const filtered = items.filter((p) => {
    if (brand && String(p.brand || '') !== brand) return false;
    if (category && String(p.category || '') !== category) return false;
    if (q) {
      const title = String(p.title || p.name || '').toLowerCase();
      const desc = String(p.description || '').toLowerCase();
      if (!title.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  const shuffled = seed ? shuffleDeterministic(filtered, seed) : filtered;
  const mixed = mixByCategoryRoundRobin(shuffled, seed || '');

  const totalItems = mixed.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const end = start + perPage;
  const pageItems = mixed.slice(start, end);

  const payload = {
    products: pageItems,
    page: safePage,
    perPage,
    totalPages,
    totalItems,
    hasNextPage: safePage < totalPages,
  };

  externalProductsCache.set(cacheKey, payload);
  setCatalogCacheHeaders(res);
  return res.json(normalizeProductDescriptions(payload));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// External products endpoint
app.get(
  '/api/external-products',
  asyncRoute(async (req, res) => {
    return handleExternalProducts(req, res);
  })
);

// Versioned external products endpoint (alias for Telegram frontend)
app.get(
  '/api/:version/:shop/external-products',
  asyncRoute(async (req, res) => {
    return handleExternalProducts(req, res);
  })
);

// Catalog filters endpoint (categories, brands, brandsByCategory)
app.get(
  '/api/catalog-filters',
  asyncRoute(async (req, res) => {
    return handleCatalogFilters(req, res);
  })
);

// Versioned catalog filters endpoint (alias for Telegram frontend)
app.get(
  '/api/:version/:shop/catalog-filters',
  asyncRoute(async (req, res) => {
    return handleCatalogFilters(req, res);
  })
);

app.get('/api/products', async (req, res) => {
  try {
    const pb = await listActiveProducts(1, 2000);
    const products = pb.items;
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
    const pb = await listActiveProducts(1, 2000);
    const products = pb.items;

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
    const pb = await listActiveProducts(1, 2000);
    const products = pb.items;
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
    const botToken = process.env.BOT_TOKEN;
    const managerChatId = process.env.MANAGER_CHAT_ID;

    // ...
    if (!botToken || !managerChatId) {
      return res.status(500).json({ error: 'Бот не сконфигурирован' });
    }

    const { initData, items, comment } = req.body;
    const safeCommentRaw = typeof comment === 'string' ? comment.trim() : '';
    const safeComment = safeCommentRaw.slice(0, 1000);

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
      safeComment ? `Комментарий: ${escapeHtml(safeComment)}` : '',
      '',
      '🛒 Товары:'
    ]
      .filter(Boolean)
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
            return `${idx + 1}. ${title} (id: <code>${id}</code>) — ${qty} шт — Цена по запросу`;
          }

          const lineTotal = price * qty;
          return `${idx + 1}. ${title} (id: <code>${id}</code>) — ${qty} шт × ${price} ₽ = ${lineTotal} ₽`;
        })
      )
      .concat([
        '',
        total > 0
          ? `💰 Итого: ${escapeHtml(String(total))} ₽`
          : '💰 Итого: Цена по запросу',
        '',
        'Доп. данные (адрес, телефон) пока не заполняются в мини-приложении.'
      ])
      .join('\n');

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const messages = splitTelegramMessage(orderText, 3500);
    for (let i = 0; i < messages.length; i += 1) {
      const part = messages[i];
      await axios.post(url, {
        chat_id: managerChatId,
        text: part,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }

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

app.use((err, req, res, next) => {
  try {
    const status = extractAxiosStatus(err);
    const message = extractAxiosMessage(err);

    console.error('Unhandled API error', {
      path: req?.path,
      method: req?.method,
      upstreamStatus: status,
      message,
    });

    if (!res.headersSent) {
      if (status === 401 || status === 403) {
        return res.status(502).json({ error: 'Upstream authorization failed', message });
      }
      if (status && status >= 400 && status < 600) {
        return res.status(502).json({ error: 'Upstream request failed', message, upstreamStatus: status });
      }
      return res.status(500).json({ error: 'Internal server error', message });
    }
  } catch (e) {
    // fallthrough
  }

  return next(err);
});

// Export for Vercel serverless
module.exports = app;
