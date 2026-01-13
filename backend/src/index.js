// Load environment variables first
require("dotenv").config({ path: ".env" });

// Check for required environment variables
const checkEnvVars = () => {
  const envVars = {
    // Required for Telegram bot functionality
    BOT_TOKEN: {
      required: false,
      message: "Bot token is missing - Telegram bot features will be disabled",
    },
    MANAGER_CHAT_ID: {
      required: false,
      message:
        "Manager chat ID is missing - Order notifications will not be sent",
    },
    // Required for Google Sheets integration
    PB_URL: {
      required: false,
      message:
        "PB_URL is missing - PocketBase product data will be unavailable",
    },
    PB_TOKEN: {
      required: false,
      message: "PB_TOKEN is missing - PocketBase requests may fail",
    },
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

  const botToken = process.env.BOT_TOKEN;
  const managerChatId = process.env.MANAGER_CHAT_ID;

  return {
    isBotEnabled: !!botToken && !!managerChatId,
    isGoogleSheetsEnabled: !!String(process.env.PB_URL || "").trim(),
  };
};

const { isBotEnabled, isGoogleSheetsEnabled } = checkEnvVars();

if (!isBotEnabled) {
  console.warn(
    "⚠️  Bot functionality is disabled due to missing configuration"
  );
}

if (!isGoogleSheetsEnabled) {
  console.warn("⚠️  PocketBase integration is disabled - Using mock data");
}

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const NodeCache = require("node-cache");
const {
  listActiveProducts,
  getProfileByTelegramId,
  updateProfileCartAndFavorites,
} = require("./pocketbaseClient");
const {
  validateTelegramInitData,
  parseInitData,
} = require("./telegramWebAppAuth");

const app = express();
const PORT = process.env.PORT || 3000;

const ORDER_RATE_WINDOW_MS = Number(
  process.env.ORDER_RATE_WINDOW_MS || 5 * 60 * 1000
);
const ORDER_RATE_MAX = Number(process.env.ORDER_RATE_MAX || 30);
const TG_ORDER_INITDATA_MAX_AGE_SECONDS = Number(
  process.env.TG_ORDER_INITDATA_MAX_AGE_SECONDS ||
    process.env.TG_INITDATA_MAX_AGE_SECONDS ||
    300
);
const ORDER_ANTI_REPLAY_TTL_SECONDS = Number(
  process.env.ORDER_ANTI_REPLAY_TTL_SECONDS || 10 * 60
);

// Import centralized cache manager
const cacheManager = require("./cacheManager");

const normalizeDescription = (s) =>
  typeof s === "string" ? s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n") : s;

function normalizeProductDescriptions(payload) {
  if (!payload) return payload;

  if (Array.isArray(payload)) {
    return payload.map((item) => normalizeProductDescriptions(item));
  }

  if (typeof payload !== "object") return payload;

  if (Array.isArray(payload.products)) {
    return {
      ...payload,
      products: payload.products.map((p) => ({
        ...p,
        description: normalizeDescription(p?.description),
      })),
    };
  }

  if ("description" in payload) {
    return {
      ...payload,
      description: normalizeDescription(payload.description),
    };
  }

  return payload;
}

function hashStringToUint32(seed) {
  const str = String(seed ?? "");
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

function mixByBrandRoundRobin(products, seed) {
  const list = Array.isArray(products) ? products : [];
  if (list.length <= 1) return list;

  const byBrand = new Map();
  for (const p of list) {
    const brand = String(p?.brand ?? "").trim() || "__unknown__";
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand).push(p);
  }

  const brands = Array.from(byBrand.keys());
  const shuffledBrands = shuffleDeterministic(brands, `brands:${seed}`);
  for (const b of shuffledBrands) {
    const items = byBrand.get(b) || [];
    byBrand.set(b, shuffleDeterministic(items, `brand:${b}:${seed}`));
  }

  const pointers = new Map(shuffledBrands.map((b) => [b, 0]));
  const remaining = new Set(shuffledBrands);
  const out = [];

  while (remaining.size) {
    let progressed = false;
    for (const b of shuffledBrands) {
      if (!remaining.has(b)) continue;
      const items = byBrand.get(b) || [];
      const idx = pointers.get(b) || 0;
      if (idx >= items.length) {
        remaining.delete(b);
        continue;
      }
      out.push(items[idx]);
      pointers.set(b, idx + 1);
      progressed = true;
    }
    if (!progressed) break;
  }

  return out;
}

function buildPagedExternalProductsResponse(allProducts, { page, perPage }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(2000, Number(perPage) || 200));

  const totalItems = Array.isArray(allProducts) ? allProducts.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const normalizedPage = Math.min(safePage, totalPages);
  const start = (normalizedPage - 1) * safePerPage;
  const end = start + safePerPage;
  const products = (Array.isArray(allProducts) ? allProducts : []).slice(
    start,
    end
  );

  return {
    products,
    page: normalizedPage,
    perPage: safePerPage,
    totalPages,
    totalItems,
    hasNextPage: normalizedPage < totalPages,
  };
}

function toProductArray(productsLike) {
  if (Array.isArray(productsLike)) return productsLike;
  if (
    productsLike &&
    typeof productsLike === "object" &&
    Array.isArray(productsLike.items)
  ) {
    return productsLike.items;
  }
  return [];
}

let cachedBotUsername = null;

async function getBotUsername(botToken) {
  const fromEnv = String(process.env.BOT_USERNAME || "")
    .trim()
    .replace(/^@/, "");
  if (fromEnv) return fromEnv;
  if (cachedBotUsername) return cachedBotUsername;

  try {
    const url = `https://api.telegram.org/bot${botToken}/getMe`;
    const resp = await axios.get(url);
    const username = resp?.data?.result?.username
      ? String(resp.data.result.username)
      : "";
    cachedBotUsername = username;
    return username;
  } catch {
    return "";
  }
}

function buildProductStartParam(productId) {
  return `product__${String(productId)}`;
}

function buildMiniAppLink(botUsername, startParam) {
  const safeUsername = String(botUsername || "")
    .replace(/^@/, "")
    .trim();
  if (!safeUsername) return null;
  return `https://t.me/${safeUsername}?startapp=${encodeURIComponent(
    String(startParam || "")
  )}`;
}

function splitTelegramMessage(text, maxLen = 3500) {
  const raw = String(text ?? "");
  if (raw.length <= maxLen) return [raw];

  const lines = raw.split("\n");
  const parts = [];
  let current = "";

  const pushCurrent = () => {
    if (current) parts.push(current);
    current = "";
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

    for (let i = 0; i < line.length; i += maxLen) {
      parts.push(line.slice(i, i + maxLen));
    }
  }

  pushCurrent();
  return parts.length ? parts : [""];
}

// Caches are now managed by cacheManager
let lastGoodActiveProducts = null;

function buildProfileFieldsFromTelegramUser(user) {
  if (!user || typeof user !== "object") return { username: "", nickname: "" };
  const username = user?.username ? String(user.username).trim() : "";
  const first = user?.first_name ? String(user.first_name).trim() : "";
  const last = user?.last_name ? String(user.last_name).trim() : "";
  const nickname = `${first} ${last}`.trim();
  return { username, nickname };
}

function getInitDataFromRequest(req) {
  const header = req?.headers?.["x-telegram-init-data"];
  if (typeof header === "string" && header.trim()) return header;
  return "";
}

function telegramAuthFromRequest(req) {
  const botToken = process.env.BOT_TOKEN;
  const initData = getInitDataFromRequest(req);
  const auth = validateTelegramInitData(initData, botToken, {
    maxAgeSeconds: Number(process.env.TG_INITDATA_MAX_AGE_SECONDS || 300),
  });

  if (!auth.ok) {
    return {
      ok: false,
      status: 401,
      error: auth.error || "initData невалиден",
    };
  }

  const user = auth.user || null;
  const telegramId = user?.id ? String(user.id) : "";
  if (!telegramId) {
    return {
      ok: false,
      status: 400,
      error: "Некорректные данные пользователя Telegram",
    };
  }

  return { ok: true, telegramId, user };
}

// Middleware
const corsAllowList = String(
  process.env.CORS_ALLOW_ORIGINS || process.env.ALLOWED_ORIGINS || ""
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (corsAllowList.length === 0) return callback(null, true);
      const ok = corsAllowList.includes(origin);
      return callback(ok ? null : new Error("Not allowed by CORS"), ok);
    },
  })
);
app.use(express.json());
app.use(express.static("public"));

const orderRateLimiter = rateLimit({
  windowMs: ORDER_RATE_WINDOW_MS,
  max: ORDER_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов. Попробуйте позже." },
});

// Simple health check endpoint
app.get("/health", (req, res) => {
  const cacheHealth = cacheManager.getHealth();
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    cache: cacheHealth,
    version: "2026-01-13-auth-fix",
    authConfig: {
      maxAgeSeconds: TG_ORDER_INITDATA_MAX_AGE_SECONDS,
      orderRateMax: ORDER_RATE_MAX,
      orderRateWindow: ORDER_RATE_WINDOW_MS,
    }
  });
});

// Cache statistics endpoint (for monitoring)
app.get("/api/cache/stats", (req, res) => {
  const stats = cacheManager.getStats();
  res.json(stats);
});

// Cache invalidation endpoint - protected with admin key
app.post("/api/cache/invalidate", (req, res) => {
  const adminKey = process.env.ADMIN_API_KEY;
  const providedKey = req.headers["x-admin-key"] || req.body.adminKey;
  
  // Require admin key in production
  if (!adminKey || adminKey !== providedKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const { type } = req.body;
  
  switch (type) {
    case "products":
      cacheManager.invalidateProducts();
      break;
    case "relations":
      cacheManager.invalidateRelations();
      break;
    case "all":
      cacheManager.flushAll();
      break;
    default:
      return res.status(400).json({ error: "Invalid cache type" });
  }
  
  res.json({ success: true, invalidated: type });
});

// Debug endpoint - disabled in production
// To enable for local debugging, set DEBUG_AUTH_ENABLED=true in .env
if (process.env.DEBUG_AUTH_ENABLED === "true" && process.env.NODE_ENV !== "production") {
  app.post("/api/debug/auth", (req, res) => {
    const botToken = process.env.BOT_TOKEN;
    const { initData } = req.body;
    
    if (!botToken) {
      return res.status(500).json({ error: "BOT_TOKEN not configured" });
    }
    
    const auth = validateTelegramInitData(initData, botToken, {
      maxAgeSeconds: 300,
    });
    
    res.json({
      ok: auth.ok,
      error: auth.error,
      debug: auth.debug,
      user: auth.user ? {
        id: auth.user.id,
        first_name: auth.user.first_name,
        username: auth.user.username,
      } : null,
    });
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Backend is running",
    endpoints: {
      health: "/health",
      api: "/api",
      cacheStats: "/api/cache/stats",
    },
  });
});

// Middleware to load products and photos for each request
async function loadData() {
  try {
    console.log("Loading data from PocketBase...");
    const products = await getCachedActiveProducts();
    console.log("Successfully loaded data from PocketBase");
    return { products };
  } catch (error) {
    console.error("Error loading data from PocketBase:", error.message);
    throw error;
  }
}

async function getCachedActiveProducts() {
  const cacheKey = "pb:active-products";
  const cached = cacheManager.get("products", cacheKey);
  if (cached) {
    return cached;
  }

  const pbUrlRaw = process.env.PB_URL;
  if (typeof pbUrlRaw === "string" && /\s/.test(pbUrlRaw)) {
    console.warn(
      "PB_URL contains whitespace. Please remove spaces/newlines in .env",
      {
        pbUrlPreview: pbUrlRaw.slice(0, 80),
      }
    );
    process.env.PB_URL = pbUrlRaw.trim();
  }

  try {
    const products = await listActiveProducts();
    lastGoodActiveProducts = products;
    cacheManager.set("products", cacheKey, products);
    return products;
  } catch (err) {
    if (lastGoodActiveProducts) {
      console.warn(
        "PocketBase unavailable, serving last known products snapshot"
      );
      return lastGoodActiveProducts;
    }
    throw err;
  }
}

/**
 * Validates that a string is a valid PocketBase record ID
 * PocketBase IDs are 15-character alphanumeric strings
 */
function isValidPocketBaseId(id) {
  if (typeof id !== "string") return false;
  return /^[a-z0-9]{15}$/.test(id);
}

async function resolveRelationIdByNameSafe(collection, name) {
  const safeName = String(name || "").trim();
  if (!safeName) return "";

  const cacheKey = `relid:${collection}:${safeName.toLowerCase()}`;
  const cached = cacheManager.get("relations", cacheKey);
  if (typeof cached === "string") return cached;

  const api = axios.create({
    baseURL: String(process.env.PB_URL || "")
      .trim()
      .replace(/\/+$/, ""),
    timeout: 30000,
    headers: {
      Accept: "application/json",
      ...(String(process.env.PB_TOKEN || "").trim()
        ? {
            Authorization: String(process.env.PB_TOKEN || "")
              .trim()
              .includes(" ")
              ? String(process.env.PB_TOKEN || "").trim()
              : `Bearer ${String(process.env.PB_TOKEN || "").trim()}`,
          }
        : {}),
    },
  });

  const resp = await api.get(`/api/collections/${collection}/records`, {
    params: {
      page: 1,
      perPage: 2000,
      fields: "id,name",
      sort: "name",
    },
  });

  const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
  // Filter in memory - safe from SQL injection
  const found = items.find((it) => String(it?.name || "").trim() === safeName);
  const id = found?.id ? String(found.id).trim() : "";

  if (!id) {
    cacheManager.set("relations", cacheKey, "", 5 * 60);
    return "";
  }

  cacheManager.set("relations", cacheKey, id);
  return id;
}

// Routes
app.get("/api/:version/:shop/external-products", async (req, res) => {
  const { version, shop } = req.params;
  const search = String(req.query.search || "")
    .replace(/\s+/g, " ")
    .trim();
  const productId = String(req.query.productId || "").trim();
  const brand = String(req.query.brand || "").trim();
  const category = String(req.query.category || "").trim();
  const seed = String(req.query.seed || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Math.min(2000, Number(req.query.perPage) || 200));

  const cacheKey = `external-products:${version}:${shop}:${search}:${productId}:${brand}:${category}:${seed}:${page}:${perPage}`;

  const cached = cacheManager.get("products", cacheKey);
  if (cached) {
    return res.json(normalizeProductDescriptions(cached));
  }

  try {
    const hasFilters = brand || category;
    let items, totalItems, totalPages;

    if (hasFilters) {
      let filterParts = ['status = "active"'];
      let brandId = "";
      let categoryId = "";
      if (brand) brandId = await resolveRelationIdByNameSafe("brands", brand);
      if (category)
        categoryId = await resolveRelationIdByNameSafe("categories", category);

      if ((brand && !brandId) || (category && !categoryId)) {
        const payload = normalizeProductDescriptions(
          buildPagedExternalProductsResponse([], { page, perPage })
        );
        cacheManager.set("products", cacheKey, payload);
        return res.json(payload);
      }

      // Validate IDs to prevent SQL injection
      if (brandId) {
        if (!isValidPocketBaseId(brandId)) {
          console.warn("Invalid brand ID format:", brandId);
          const payload = normalizeProductDescriptions(
            buildPagedExternalProductsResponse([], { page, perPage })
          );
          cacheManager.set("products", cacheKey, payload);
          return res.json(payload);
        }
        filterParts.push(`brand = "${brandId}"`);
      }
      
      if (categoryId) {
        if (!isValidPocketBaseId(categoryId)) {
          console.warn("Invalid category ID format:", categoryId);
          const payload = normalizeProductDescriptions(
            buildPagedExternalProductsResponse([], { page, perPage })
          );
          cacheManager.set("products", cacheKey, payload);
          return res.json(payload);
        }
        filterParts.push(`category = "${categoryId}"`);
      }
      
      const filter = filterParts.join(" && ");

      const products = await listActiveProducts(page, perPage, filter);
      const baseList = toProductArray(products);
      items = baseList;
      totalItems = products?.totalItems || 0;
      totalPages = products?.totalPages || 1;
    } else {
      const products = await getCachedActiveProducts();
      const baseList = toProductArray(products);
      items = baseList;
      totalItems = items.length;
      totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    }

    const q = search.toLowerCase();
    const tokens = q
      ? q
          .split(" ")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const filtered = items.filter((p) => {
      if (productId) {
        const id = String(p.id || p.product_id || "").trim();
        return id === productId;
      }
      if (tokens.length) {
        const title = String(
          p.title || p.name || p.product_id || ""
        ).toLowerCase();
        const desc = String(p.description || "").toLowerCase();
        const pid = String(p.product_id || p.id || "").toLowerCase();
        const hay = `${title} ${desc} ${pid}`;
        for (const tok of tokens) {
          if (!hay.includes(tok)) return false;
        }
      }
      return true;
    });

    const shuffled = seed ? shuffleDeterministic(filtered, seed) : filtered;
    const mixed = seed
      ? mixByBrandRoundRobin(shuffled, seed)
      : mixByBrandRoundRobin(shuffled, "");

    const payload = normalizeProductDescriptions(
      buildPagedExternalProductsResponse(mixed, { page, perPage })
    );
    cacheManager.set("products", cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load products",
      message: error?.message,
    });
  }
});

app.get("/api/external-products", async (req, res) => {
  const search = String(req.query.search || "")
    .replace(/\s+/g, " ")
    .trim();
  const productId = String(req.query.productId || "").trim();
  const brand = String(req.query.brand || "").trim();
  const category = String(req.query.category || "").trim();
  const seed = String(req.query.seed || "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Math.min(2000, Number(req.query.perPage) || 200));
  const cacheKey = `external-products:default:${search}:${productId}:${brand}:${category}:${seed}:${page}:${perPage}`;

  const cached = cacheManager.get("products", cacheKey);
  if (cached) {
    return res.json(normalizeProductDescriptions(cached));
  }

  try {
    let filterParts = ['status = "active"'];
    let brandId = "";
    let categoryId = "";
    if (brand) brandId = await resolveRelationIdByNameSafe("brands", brand);
    if (category)
      categoryId = await resolveRelationIdByNameSafe("categories", category);

    if ((brand && !brandId) || (category && !categoryId)) {
      const payload = normalizeProductDescriptions({
        ...buildPagedExternalProductsResponse([], { page, perPage }),
      });
      cacheManager.set("products", cacheKey, payload);
      return res.json(payload);
    }

    // Validate IDs to prevent SQL injection
    if (brandId) {
      if (!isValidPocketBaseId(brandId)) {
        console.warn("Invalid brand ID format:", brandId);
        const payload = normalizeProductDescriptions({
          ...buildPagedExternalProductsResponse([], { page, perPage }),
        });
        cacheManager.set("products", cacheKey, payload);
        return res.json(payload);
      }
      filterParts.push(`brand = "${brandId}"`);
    }
    
    if (categoryId) {
      if (!isValidPocketBaseId(categoryId)) {
        console.warn("Invalid category ID format:", categoryId);
        const payload = normalizeProductDescriptions({
          ...buildPagedExternalProductsResponse([], { page, perPage }),
        });
        cacheManager.set("products", cacheKey, payload);
        return res.json(payload);
      }
      filterParts.push(`category = "${categoryId}"`);
    }
    
    const filter = filterParts.join(" && ");

    const products = await listActiveProducts(page, perPage, filter);
    const baseList = toProductArray(products);
    const q = search.toLowerCase();
    const tokens = q
      ? q
          .split(" ")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    const filtered = baseList.filter((p) => {
      if (productId) {
        const id = String(p.id || p.product_id || "").trim();
        return id === productId;
      }
      if (tokens.length) {
        const title = String(
          p.title || p.name || p.product_id || ""
        ).toLowerCase();
        const desc = String(p.description || "").toLowerCase();
        const pid = String(p.product_id || p.id || "").toLowerCase();
        const hay = `${title} ${desc} ${pid}`;
        for (const tok of tokens) {
          if (!hay.includes(tok)) return false;
        }
      }
      return true;
    });

    const shuffled = seed ? shuffleDeterministic(filtered, seed) : filtered;
    const mixed = seed
      ? mixByBrandRoundRobin(shuffled, seed)
      : mixByBrandRoundRobin(shuffled, "");
    const payload = normalizeProductDescriptions({
      ...buildPagedExternalProductsResponse(mixed, { page, perPage }),
    });
    cacheManager.set("products", cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load products",
      message: error?.message,
    });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await getCachedActiveProducts();
    const result = products.map((p) => ({
      product_id: String(p.product_id || p.id || "").trim(),
      description: normalizeDescription(p.description),
      category: String(p.category || ""),
      season_title: String(p.season_title || p.brand || ""),
      status: String(p.status || ""),
      images: Array.isArray(p.images) ? p.images : [],
    }));

    res.json({ products: result });
  } catch (error) {
    console.error("Error in /api/products:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.get("/products", async (req, res) => {
  try {
    const { products } = await loadData();
    let filteredProducts = [...products];

    // Apply filters
    if (req.query.search) {
      const searchTerm = req.query.search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        (p) =>
          p.title.toLowerCase().includes(searchTerm) ||
          p.description?.toLowerCase().includes(searchTerm)
      );
    }

    if (req.query.category) {
      filteredProducts = filteredProducts.filter(
        (p) => p.category === req.query.category
      );
    }

    if (req.query.brand) {
      filteredProducts = filteredProducts.filter(
        (p) => p.brand === req.query.brand
      );
    }

    res.json(
      filteredProducts.map((p) => ({
        ...p,
        description: normalizeDescription(p?.description),
      }))
    );
  } catch (error) {
    console.error("Error in /products:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
});

app.get(["/api/products/:id", "/products/:id"], async (req, res) => {
  try {
    const { products } = await loadData();
    const product = products.find(
      (p) =>
        String(p.id || p.product_id || "").trim() ===
        String(req.params.id || "").trim()
    );
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({
      ...product,
      description: normalizeDescription(product?.description),
    });
  } catch (error) {
    console.error("Error in /products/:id:", error);
    res.status(500).json({ error: "Failed to load product" });
  }
});

app.get(["/api/profile/state", "/profile/state"], async (req, res) => {
  try {
    const auth = telegramAuthFromRequest(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const cacheKey = `profile:${auth.telegramId}`;
    const cached = cacheManager.get("profiles", cacheKey);
    if (cached) return res.json(cached);

    const profile = await getProfileByTelegramId(auth.telegramId);
    const payload = {
      ok: true,
      profileExists: Boolean(profile),
      cart: Array.isArray(profile?.cart) ? profile.cart : [],
      favorites: Array.isArray(profile?.favorites) ? profile.favorites : [],
      nickname: typeof profile?.nickname === "string" ? profile.nickname : "",
    };
    cacheManager.set("profiles", cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to load profile state", message: error?.message });
  }
});

app.post(["/api/profile/state", "/profile/state"], async (req, res) => {
  try {
    const auth = telegramAuthFromRequest(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const cart = Array.isArray(body.cart) ? body.cart : [];
    const favorites = Array.isArray(body.favorites) ? body.favorites : [];
    const fallback = buildProfileFieldsFromTelegramUser(auth.user);
    const nickname = String(body.nickname || fallback.nickname || "").trim();
    const username = String(body.username || fallback.username || "").trim();

    const updated = await updateProfileCartAndFavorites({
      telegramId: auth.telegramId,
      username,
      nickname,
      cart,
      favorites,
    });

    cacheManager.del("profiles", `profile:${auth.telegramId}`);

    return res.json({
      ok: true,
      profileExists: true,
      cart: Array.isArray(updated?.cart) ? updated.cart : [],
      favorites: Array.isArray(updated?.favorites) ? updated.favorites : [],
      nickname:
        typeof updated?.nickname === "string" ? updated.nickname : nickname,
      username:
        typeof updated?.username === "string" ? updated.username : username,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update profile state",
      message: error?.message,
    });
  }
});

app.post(["/orders", "/api/orders"], orderRateLimiter, async (req, res) => {
  try {
    const botToken = process.env.BOT_TOKEN;
    const managerChatId = process.env.MANAGER_CHAT_ID;

    if (!botToken || !managerChatId) {
      return res.status(500).json({ error: "Бот не сконфигурирован" });
    }

    const { initData, items, comment } = req.body;
    const safeCommentRaw = typeof comment === "string" ? comment.trim() : "";
    const safeComment = safeCommentRaw.slice(0, 1000);

    let initDataHash = "";
    try {
      initDataHash = String(parseInitData(initData).hash || "").trim();
    } catch {
      initDataHash = "";
    }

    if (initDataHash) {
      const replayKey = `order:initDataHash:${initDataHash}`;
      if (cacheManager.get("antiReplay", replayKey)) {
        return res.status(409).json({
          error:
            "Повторная отправка заказа. Обновите приложение и попробуйте снова.",
        });
      }
    }

    const auth = validateTelegramInitData(initData, botToken, {
      maxAgeSeconds: TG_ORDER_INITDATA_MAX_AGE_SECONDS,
    });
    if (!auth.ok) {
      console.warn("initData validation failed", {
        error: auth.error,
        debug: auth.debug,
        initDataLen: String(initData ?? "").length,
        hasHashParam: String(initData ?? "").includes("hash="),
        hasSignatureParam: String(initData ?? "").includes("signature="),
      });
      return res
        .status(401)
        .json({ error: auth.error || "initData невалиден" });
    }

    if (initDataHash) {
      cacheManager.set("antiReplay", `order:initDataHash:${initDataHash}`, true);
    }

    const user = auth.user || null;
    const telegramUserId = user?.id ? String(user.id) : "";
    const username = user?.username ? String(user.username) : "";
    const firstname = user?.first_name ? String(user.first_name) : "";
    const lastname = user?.last_name ? String(user.last_name) : "";

    if (!telegramUserId) {
      return res
        .status(400)
        .json({ error: "Некорректные данные пользователя Telegram" });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Некорректные данные заказа" });
    }

    const normalizedItems = items
      .map((it) => {
        const id = String(it?.id ?? "")
          .trim()
          .slice(0, 80);
        const title = String(it?.title ?? "")
          .trim()
          .slice(0, 120);
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
      return res.status(400).json({ error: "Некорректные данные заказа" });
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
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    };

    const safeFirst = escapeHtml((firstname || "").trim());
    const safeLast = escapeHtml((lastname || "").trim());
    const safeUsername = escapeHtml((username || "").trim());
    const safeTelegramId = escapeHtml(String(telegramUserId));

    const botUsername = await getBotUsername(botToken);

    const orderText = [
      "🆕 Новый заказ из Telegram Mini App",
      "",
      `👤 Клиент: ${`${safeFirst} ${safeLast}`.trim()}`.trim(),
      safeUsername ? `@${safeUsername}` : "username: отсутствует",
      `Telegram ID: <code>${safeTelegramId}</code>`,
      safeComment ? `Комментарий: ${escapeHtml(safeComment)}` : "",
      "",
      "🛒 Товары:",
    ]
      .filter(Boolean)
      .concat(
        normalizedItems.map((it, idx) => {
          const qty = Number(it?.quantity) || 1;
          const hasPrice = it?.hasPrice === false ? false : true;
          const price = Number(it?.price);
          const titleText = escapeHtml(
            String(it?.title || "").trim() || "Без названия"
          );
          const id = escapeHtml(String(it?.id || "").trim() || "-");

          const startParam = buildProductStartParam(
            String(it?.id || "").trim()
          );
          const link = buildMiniAppLink(botUsername, startParam);
          const title = titleText;
          const linkLine = link ? `\n${escapeHtml(link)}` : "";

          if (!hasPrice || !Number.isFinite(price) || price <= 0) {
            return `${
              idx + 1
            }. ${title}${linkLine} (id: <code>${id}</code>) — ${qty} шт — Цена по запросу`;
          }

          const lineTotal = price * qty;
          return `${
            idx + 1
          }. ${title}${linkLine} (id: <code>${id}</code>) — ${qty} шт × ${price} ₽ = ${lineTotal} ₽`;
        })
      )
      .concat([
        "",
        total > 0
          ? `💰 Итого: ${escapeHtml(String(total))} ₽`
          : "💰 Итого: Цена по запросу",
        "",
        "Доп. данные (адрес, телефон) пока не заполняются в мини-приложении.",
      ])
      .join("\n");

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const messages = splitTelegramMessage(orderText, 3500);
    for (let i = 0; i < messages.length; i += 1) {
      const part = messages[i];
      await axios.post(url, {
        chat_id: managerChatId,
        text: part,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }

    console.log("Заказ отправлен менеджеру", {
      telegramUserId,
      itemsCount: normalizedItems.length,
    });

    return res.json({
      ok: true,
      orderId: Date.now().toString(),
    });
  } catch (error) {
    console.error(
      "Ошибка отправки заказа менеджеру",
      error?.response?.data || error.message
    );
    return res
      .status(500)
      .json({ error: "Не удалось отправить заказ менеджеру" });
  }
});

// Start server
async function startServer() {
  const port = await getAvailablePort(PORT);

  // Preload cache for faster first request
  console.log("Preloading product order cache...");
  try {
    const { loadProductIdsOnly } = require("./pocketbaseClient");
    const idRecords = await loadProductIdsOnly(2000, null);

    // Shuffle and mix for default order (no seed, no filters)
    const {
      shuffleDeterministic,
      mixByCategoryRoundRobin,
    } = require("../api/index");
    const shuffled = shuffleDeterministic(idRecords, "");
    const mixed = mixByCategoryRoundRobin(shuffled, "");
    const orderedIds = mixed.map((p) => p.id);

    shuffleOrderCache.set("order:::", orderedIds);
    console.log(`Preloaded ${orderedIds.length} product IDs to cache`);
  } catch (err) {
    console.warn("Failed to preload cache:", err.message);
  }

  const server = require("http").createServer(app);

  server.listen(port, () => {
    console.log(`\n=== Server is running ===`);
    console.log(`Local:   http://localhost:${port}`);
    console.log(`API:     http://localhost:${port}/api`);
    console.log(`Health:  http://localhost:${port}/health\n`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.warn(`Port ${port} is in use, trying next port...`);
      try {
        server.close(() => startServer());
      } catch {
        startServer();
      }
    } else {
      console.error("Server error:", error);
      process.exit(1);
    }
  });
}

// Helper function to find an available port
function getAvailablePort(desiredPort) {
  return new Promise((resolve, reject) => {
    const server = require("http").createServer();

    server.listen(desiredPort, "0.0.0.0");

    server.on("listening", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
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
  .catch((error) => {
    console.error("Failed to load initial data:", error);
    console.log("Starting server with mock data...");
    startServer(); // Start server anyway with mock data
  });
