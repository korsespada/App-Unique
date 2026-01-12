// Serverless function wrapper for Vercel
const path = require("path");

// Set the correct path for .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Import the app after env is loaded
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const NodeCache = require("node-cache");
const { validateTelegramInitData } = require("../src/telegramWebAppAuth");
const {
  listActiveProducts,
  listAllActiveProducts,
  getActiveProductById,
  getProfileByTelegramId,
  updateProfileCartAndFavorites,
  loadProductIdsOnly,
  loadProductsByIds,
} = require("../src/pocketbaseClient");

const app = express();

const profilesCache = new NodeCache({ stdTTL: 60 });

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
    maxAgeSeconds: Number(process.env.TG_INITDATA_MAX_AGE_SECONDS || 86400),
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
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object") {
    const msg = data.message || data.error || data.detail;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (typeof err?.message === "string" && err.message.trim())
    return err.message;
  return "Request failed";
}

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

function mixByCategoryRoundRobin(products, seed) {
  const list = Array.isArray(products) ? products : [];
  if (list.length <= 1) return list;

  const byCategory = new Map();
  for (const p of list) {
    const category = String(p?.category ?? "").trim() || "__unknown__";
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(p);
  }

  const categories = Array.from(byCategory.keys());
  const shuffledCategories = shuffleDeterministic(
    categories,
    `categories:${seed}`
  );
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
  return `product_${String(productId)}`;
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

    // Fallback: split a single very long line
    for (let i = 0; i < line.length; i += maxLen) {
      parts.push(line.slice(i, i + maxLen));
    }
  }

  pushCurrent();
  return parts.length ? parts : [""];
}

function buildCartKeyboardAiogram3() {
  return `from __future__ import annotations

from typing import Iterable, TypedDict

from aiogram.types import InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder


BOT_USERNAME = "YeezyUniqueBot"


class CartProduct(TypedDict):
    name: str
    price: int | float
    id: str


def build_cart_keyboard(
    products: Iterable[CartProduct],
    *,
    bot_username: str = BOT_USERNAME,
    row_width: int = 2,
    checkout_callback: str = "cart:checkout",
    clear_callback: str = "cart:clear",
) -> InlineKeyboardMarkup:
    kb = InlineKeyboardBuilder()

    for p in products:
        name = str(p.get("name", "")).strip() or "Товар"
        price = p.get("price", None)
        pid = str(p.get("id", "")).strip()

        if isinstance(price, (int, float)):
            title = f"{name} — {price:g} ₽"
        else:
            title = name

        url = f"https://t.me/{bot_username}?startapp=product__{pid}"
        kb.button(text=title, url=url)

    kb.adjust(row_width)

    kb.button(text="Оформить", callback_data=checkout_callback)
    kb.button(text="Очистить", callback_data=clear_callback)
    kb.adjust(row_width, 2)

    return kb.as_markup()
`;
}

// Middleware
const corsAllowList = String(
  process.env.CORS_ALLOW_ORIGINS || process.env.ALLOWED_ORIGINS || ""
)
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);

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

const externalProductsCache = new NodeCache({ stdTTL: 60 });
let lastGoodAllActiveProducts = null;
let lastGoodCatalogFilters = null;
const pbSnapshotCache = new NodeCache({ stdTTL: 5 * 60 });

const shuffleOrderCache = new NodeCache({ stdTTL: 15 * 60 });
const pageDataCache = new NodeCache({ stdTTL: 3 * 60 });

function setCatalogCacheHeaders(res) {
  res.set("Cache-Control", "s-maxage=60, stale-while-revalidate=30");
}

async function getAllActiveProductsSafe(perPage) {
  const snapshotCacheKey = `pb:all-active:${Number(perPage) || 2000}`;
  const cached = pbSnapshotCache.get(snapshotCacheKey);
  if (cached) {
    lastGoodAllActiveProducts = cached;
    return cached;
  }

  try {
    const pbAll = await listAllActiveProducts(perPage);
    lastGoodAllActiveProducts = pbAll;
    pbSnapshotCache.set(snapshotCacheKey, pbAll);
    return pbAll;
  } catch (err) {
    if (lastGoodAllActiveProducts) {
      console.warn(
        "PocketBase unavailable, serving last known products snapshot"
      );
      return lastGoodAllActiveProducts;
    }
    throw err;
  }
}

async function handleCatalogFilters(req, res) {
  const cacheKey = "catalog-filters:v2";
  const cached = externalProductsCache.get(cacheKey);
  if (cached) {
    console.log("Using cached catalog filters");
    setCatalogCacheHeaders(res);
    return res.json(cached);
  }

  const pbUrl = String(process.env.PB_URL || "").trim();
  if (!pbUrl) {
    throw new Error("PB_URL is not configured");
  }

  const pb = axios.create({
    baseURL: pbUrl,
    timeout: 15000,
    headers: {
      Accept: "application/json",
    },
  });

  try {
    const [categoriesResp, brandsResp] = await Promise.all([
      pb.get("/api/collections/categories/records", {
        params: {
          page: 1,
          perPage: 2000,
          sort: "name",
          fields: "id,name",
        },
      }),
      pb.get("/api/collections/brands/records", {
        params: {
          page: 1,
          perPage: 2000,
          sort: "name",
          fields: "id,name",
        },
      }),
    ]);

    const categoriesItems = Array.isArray(categoriesResp?.data?.items)
      ? categoriesResp.data.items
      : [];
    const brandsItems = Array.isArray(brandsResp?.data?.items)
      ? brandsResp.data.items
      : [];

    const categories = categoriesItems
      .map((x) => String(x?.name || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    const brands = brandsItems
      .map((x) => String(x?.name || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const brandsByCategory = Object.fromEntries(
      categories.map((c) => [c, brands])
    );

    const payload = {
      categories,
      brands,
      brandsByCategory,
    };

    lastGoodCatalogFilters = payload;
    externalProductsCache.set(cacheKey, payload, 6 * 60 * 60);
    setCatalogCacheHeaders(res);
    return res.json(payload);
  } catch (err) {
    const status = extractAxiosStatus(err);
    console.error("Catalog filters load failed", {
      status,
      message: err?.message || err,
    });

    const fallback = lastGoodCatalogFilters || {
      categories: [],
      brands: [],
      brandsByCategory: {},
    };

    externalProductsCache.set(cacheKey, fallback, 60);
    setCatalogCacheHeaders(res);
    return res.json(fallback);
  }
}

// Legacy name kept, but source is now PocketBase
async function loadProductsFromSheets() {
  try {
    const pbProducts = await listActiveProducts();
    return pbProducts.map((p) => ({
      id: String(p.id || "").trim(),
      title: String(p.title || p.name || ""),
      brand: String(p.brand || ""),
      price: Number(p.price) || 0,
      description: String(p.description || ""),
      images: Array.isArray(p.images) ? p.images : [],
      category: String(p.category || ""),
      seo_title: "",
      inStock: true,
    }));
  } catch (error) {
    console.error(
      "Error loading products from PocketBase:",
      error?.message || error
    );
    return null;
  }
}

async function handleExternalProducts(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const perPage = Math.max(1, Math.min(200, Number(req.query.perPage) || 40));
  const seed = String(req.query.seed || "").trim();

  const search = String(req.query.search || "")
    .replace(/\s+/g, " ")
    .trim();
  const brand = String(req.query.brand || "").trim();
  const category = String(req.query.category || "").trim();

  const cacheKey = `external-products:${page}:${perPage}:${search}:${brand}:${category}:${seed}`;
  const cached = pageDataCache.get(cacheKey);
  if (cached) {
    setCatalogCacheHeaders(res);
    return res.json(normalizeProductDescriptions(cached));
  }

  let filterParts = ['status = "active"'];
  if (brand) filterParts.push(`brand.name = "${brand.replace(/"/g, '\\"')}"`);
  if (category)
    filterParts.push(`category.name = "${category.replace(/"/g, '\\"')}"`);
  const customFilter = filterParts.join(" && ");

  const orderCacheKey = `order:${seed}:${brand}:${category}`;
  let orderedIds = shuffleOrderCache.get(orderCacheKey);

  if (!orderedIds) {
    const idRecords = await loadProductIdsOnly(2000, customFilter);

    let filteredIds = idRecords;
    if (search) {
      const q = search.toLowerCase();
      const tokens = q
        .split(" ")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tokens.length) {
        filteredIds = idRecords.filter((p) => {
          const title = String(
            p?.title || p?.name || p?.product_id || p?.id || ""
          ).toLowerCase();
          const desc = String(p?.description || "").toLowerCase();
          const pid = String(p?.product_id || p?.id || "").toLowerCase();
          const hay = `${title} ${desc} ${pid}`;
          for (const tok of tokens) {
            if (!hay.includes(tok)) return false;
          }
          return true;
        });
      }
    }

    let shuffled = seed ? shuffleDeterministic(filteredIds, seed) : filteredIds;
    let mixed = mixByCategoryRoundRobin(shuffled, seed || "");
    orderedIds = mixed.map((p) => p.id);

    shuffleOrderCache.set(orderCacheKey, orderedIds);
  }

  const totalItems = orderedIds.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const end = start + perPage;
  const pageIds = orderedIds.slice(start, end);

  const pageProducts = await loadProductsByIds(pageIds);

  const pageItems = pageProducts.map((p) => {
    const thumb = typeof p?.thumb === "string" ? String(p.thumb).trim() : "";
    const firstImage =
      Array.isArray(p?.images) && p.images.length
        ? String(p.images[0]).trim()
        : "";
    const preview = thumb || firstImage;
    return {
      ...p,
      thumb: preview,
    };
  });

  const payload = {
    products: pageItems,
    page: safePage,
    perPage,
    totalPages,
    totalItems,
    hasNextPage: safePage < totalPages,
  };

  pageDataCache.set(cacheKey, payload);
  setCatalogCacheHeaders(res);
  return res.json(normalizeProductDescriptions(payload));
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// External products endpoint
app.get(
  "/api/external-products",
  asyncRoute(async (req, res) => {
    return handleExternalProducts(req, res);
  })
);

// Versioned external products endpoint (alias for Telegram frontend)
app.get(
  "/api/:version/:shop/external-products",
  asyncRoute(async (req, res) => {
    return handleExternalProducts(req, res);
  })
);

// Catalog filters endpoint (categories, brands, brandsByCategory)
app.get(
  "/api/catalog-filters",
  asyncRoute(async (req, res) => {
    return handleCatalogFilters(req, res);
  })
);

// Versioned catalog filters endpoint (alias for Telegram frontend)
app.get(
  "/api/:version/:shop/catalog-filters",
  asyncRoute(async (req, res) => {
    return handleCatalogFilters(req, res);
  })
);

app.get("/api/products", async (req, res) => {
  try {
    const pb = await listActiveProducts(1, 2000);
    const products = pb.items;
    const result = products.map((p) => ({
      product_id: String(p.product_id || p.id || "").trim(),
      description: normalizeDescription(p.description),
      category: String(p.category || ""),
      season_title: String(p.season_title || p.brand || ""),
      status: String(p.status || ""),
      images: Array.isArray(p.images) ? p.images : [],
      thumb: String(p.thumb || ""),
    }));

    return res.json({ products: result });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to load products", message: error?.message });
  }
});

app.get("/products", async (req, res) => {
  try {
    const pb = await listActiveProducts(1, 2000);
    const products = pb.items;

    let filteredProducts = [...products];

    if (req.query.search) {
      const searchTerm = String(req.query.search).toLowerCase();
      filteredProducts = filteredProducts.filter(
        (p) =>
          String(p.title || "")
            .toLowerCase()
            .includes(searchTerm) ||
          String(p.description || "")
            .toLowerCase()
            .includes(searchTerm)
      );
    }

    if (req.query.category) {
      filteredProducts = filteredProducts.filter(
        (p) => String(p.category || "") === String(req.query.category)
      );
    }

    if (req.query.brand) {
      filteredProducts = filteredProducts.filter(
        (p) => String(p.brand || "") === String(req.query.brand)
      );
    }

    return res.json(
      filteredProducts.map((p) => ({
        ...p,
        description: normalizeDescription(p?.description),
        photos: (Array.isArray(p.images) ? p.images : []).map((url) => ({
          url,
        })),
      }))
    );
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to load products", message: error?.message });
  }
});

app.get(["/api/products/:id", "/products/:id"], async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    const product = await getActiveProductById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({
      ...product,
      description: normalizeDescription(product?.description),
      photos: (Array.isArray(product.images) ? product.images : []).map(
        (url) => ({ url })
      ),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to load product", message: error?.message });
  }
});

app.get(["/api/profile/state", "/profile/state"], async (req, res) => {
  try {
    const auth = telegramAuthFromRequest(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const cacheKey = `profile:${auth.telegramId}`;
    const cached = profilesCache.get(cacheKey);
    if (cached) return res.json(cached);

    const profile = await getProfileByTelegramId(auth.telegramId);
    const payload = {
      ok: true,
      profileExists: Boolean(profile),
      cart: Array.isArray(profile?.cart) ? profile.cart : [],
      favorites: Array.isArray(profile?.favorites) ? profile.favorites : [],
      nickname: typeof profile?.nickname === "string" ? profile.nickname : "",
    };
    profilesCache.set(cacheKey, payload);
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

    profilesCache.del(`profile:${auth.telegramId}`);

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

app.post(["/orders", "/api/orders"], async (req, res) => {
  try {
    const botToken = process.env.BOT_TOKEN;
    const managerChatId = process.env.MANAGER_CHAT_ID;

    // ...
    if (!botToken || !managerChatId) {
      return res.status(500).json({ error: "Бот не сконфигурирован" });
    }

    const { initData, items, comment } = req.body;
    const safeCommentRaw = typeof comment === "string" ? comment.trim() : "";
    const safeComment = safeCommentRaw.slice(0, 1000);

    const auth = validateTelegramInitData(initData, botToken, {
      maxAgeSeconds: Number(process.env.TG_INITDATA_MAX_AGE_SECONDS || 86400),
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

          const titleWithId = `${titleText} <code>${id}</code>`;

          if (!hasPrice || !Number.isFinite(price) || price <= 0) {
            return `${idx + 1}. ${titleWithId} | ${qty} шт | Цена по запросу`;
          }

          const lineTotal = price * qty;
          return `${
            idx + 1
          }. ${titleWithId} | ${qty} шт | ${price} ₽ | ${lineTotal} ₽`;
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

app.use((err, req, res, next) => {
  try {
    const status = extractAxiosStatus(err);
    const message = extractAxiosMessage(err);

    console.error("Unhandled API error", {
      path: req?.path,
      method: req?.method,
      upstreamStatus: status,
      message,
    });

    if (!res.headersSent) {
      if (status === 401 || status === 403) {
        return res
          .status(502)
          .json({ error: "Upstream authorization failed", message });
      }
      if (status && status >= 400 && status < 600) {
        return res.status(502).json({
          error: "Upstream request failed",
          message,
          upstreamStatus: status,
        });
      }
      return res.status(500).json({ error: "Internal server error", message });
    }
  } catch (e) {
    // fallthrough
  }

  return next(err);
});

// Export for Vercel serverless
module.exports = app;

// Export utility functions for cache preloading
module.exports.shuffleDeterministic = shuffleDeterministic;
module.exports.mixByCategoryRoundRobin = mixByCategoryRoundRobin;
