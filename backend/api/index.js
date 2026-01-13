// Serverless function wrapper for Vercel
const path = require("path");
const { promises: fs } = require("fs");

// Set the correct path for .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

// Import the app after env is loaded
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

// Shared modules
const {
  listActiveProducts,
  getActiveProductById,
  loadProductIdsOnly,
  loadProductsByIds,
} = require("../src/pocketbaseClient");
const cacheManager = require("../src/cacheManager");
const {
  normalizeDescription,
  normalizeProductDescriptions,
  shuffleDeterministic,
  mixByCategoryRoundRobin,
  isValidPocketBaseId,
} = require("../src/utils/helpers");
const {
  telegramAuthFromRequest,
  buildProfileFieldsFromTelegramUser,
} = require("../src/utils/telegram");
const { handleOrderSubmission } = require("../src/handlers/orders");
const { handleGetProfileState, handleUpdateProfileState } = require("../src/handlers/profile");

const app = express();

// Rate limiting for orders endpoint
const ORDER_RATE_WINDOW_MS = Number(process.env.ORDER_RATE_WINDOW_MS || 5 * 60 * 1000);
const ORDER_RATE_MAX = Number(process.env.ORDER_RATE_MAX || 30);

const orderRateLimiter = rateLimit({
  windowMs: ORDER_RATE_WINDOW_MS,
  max: ORDER_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов. Попробуйте позже." },
});

const CACHE_DIR = path.join(__dirname, "..", ".cache");
const PRODUCTS_CACHE_FILE = path.join(CACHE_DIR, "products.json");
const CATALOG_FILTERS_CACHE_FILE = path.join(CACHE_DIR, "catalog-filters.json");

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (err) {
    console.warn("Failed to create cache directory:", err.message);
  }
}

async function saveToFile(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to save cache to ${filePath}:`, err.message);
  }
}

async function loadFromFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

ensureCacheDir();

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

// Caches are now managed by cacheManager
let lastGoodCatalogFilters = null;
let catalogFiltersErrorCount = 0;

function setCatalogCacheHeaders(res) {
  res.set("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
}

async function resolveRelationIdByName({ collection, name, pbUrl, pbHeaders }) {
  const safeName = String(name || "").trim();
  if (!safeName) return "";

  const cacheKey = `relid:${collection}:${safeName.toLowerCase()}`;
  const cached = cacheManager.get("relations", cacheKey);
  if (typeof cached === "string") return cached;

  const pb = axios.create({
    baseURL: pbUrl,
    timeout: 30000,
    headers: pbHeaders,
  });

  let resp;
  try {
    resp = await pb.get(`/api/collections/${collection}/records`, {
      params: {
        page: 1,
        perPage: 2000,
        fields: "id,name",
        sort: "name",
      },
    });
  } catch (err) {
    resp = await pb.get(`/api/collections/${collection}/records`, {
      params: {
        page: 1,
        perPage: 2000,
        fields: "id,name",
        sort: "name",
      },
    });
  }

  const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
  const found = items.find((it) => String(it?.name || "").trim() === safeName);
  const id = found?.id ? String(found.id).trim() : "";

  if (!id) {
    cacheManager.set("relations", cacheKey, "", 5 * 60);
    return "";
  }

  cacheManager.set("relations", cacheKey, id);
  return id;
}

async function handleCatalogFilters(req, res) {
  const cacheKey = "catalog-filters:v3";
  const cached = cacheManager.get("products", cacheKey);
  if (cached) {
    console.log("Using cached catalog filters");
    setCatalogCacheHeaders(res);
    return res.json(cached);
  }

  const pbUrl = String(process.env.PB_URL || "").trim();
  if (!pbUrl) {
    throw new Error("PB_URL is not configured");
  }

  const pbToken = String(process.env.PB_TOKEN || "").trim();
  const pbHeaders = { Accept: "application/json" };
  if (pbToken) {
    pbHeaders.Authorization = pbToken.includes(" ")
      ? pbToken
      : `Bearer ${pbToken}`;
  }

  const pb = axios.create({
    baseURL: pbUrl,
    timeout: 15000,
    headers: pbHeaders,
  });

  try {
    async function loadNamesFromCollection(
      collection,
      fallbackCollections = []
    ) {
      const collections = [collection, ...(fallbackCollections || [])];
      let lastErr = null;

      for (const col of collections) {
        try {
          const firstResp = await pb.get(`/api/collections/${col}/records`, {
            params: {
              page: 1,
              perPage: 2000,
              sort: "name",
              fields: "id,name",
            },
          });

          const firstData = firstResp?.data;
          const totalPages = Math.max(1, Number(firstData?.totalPages) || 1);
          const items = Array.isArray(firstData?.items) ? firstData.items : [];

          if (totalPages > 1) {
            for (let page = 2; page <= totalPages; page += 1) {
              const resp = await pb.get(`/api/collections/${col}/records`, {
                params: {
                  page,
                  perPage: 2000,
                  sort: "name",
                  fields: "id,name",
                },
              });
              const data = resp?.data;
              if (data && Array.isArray(data.items)) items.push(...data.items);
            }
          }

          return items
            .map((x) => String(x?.name || "").trim())
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        } catch (err) {
          lastErr = err;
          const status = extractAxiosStatus(err);
          if (status && status !== 404) {
            throw err;
          }
        }
      }

      if (lastErr) throw lastErr;
      return [];
    }

    async function loadFiltersFromProducts() {
      const pbProducts = axios.create({
        baseURL: pbUrl,
        timeout: 30000,
        headers: pbHeaders,
      });

      const firstResp = await pbProducts.get(
        "/api/collections/products/records",
        {
          params: {
            page: 1,
            perPage: 2000,
            filter: 'status = "active"',
            sort: "-updated",
            fields: "id,brand,category,expand.brand,expand.category",
            expand: "brand,category",
          },
        }
      );

      const firstData = firstResp?.data;
      const totalPages = Math.max(1, Number(firstData?.totalPages) || 1);
      const items = Array.isArray(firstData?.items) ? firstData.items : [];

      if (totalPages > 1) {
        for (let page = 2; page <= totalPages; page += 1) {
          const resp = await pbProducts.get(
            "/api/collections/products/records",
            {
              params: {
                page,
                perPage: 2000,
                filter: 'status = "active"',
                sort: "-updated",
                fields: "id,brand,category,expand.brand,expand.category",
                expand: "brand,category",
              },
            }
          );
          const data = resp?.data;
          if (data && Array.isArray(data.items)) items.push(...data.items);
        }
      }

      const categoriesSet = new Set();
      const brandsSet = new Set();
      const brandsByCategorySet = new Map();

      for (const p of items) {
        const categoryName = String(p?.expand?.category?.name || "").trim();
        const brandName = String(p?.expand?.brand?.name || "").trim();
        if (categoryName) {
          categoriesSet.add(categoryName);
          if (!brandsByCategorySet.has(categoryName)) {
            brandsByCategorySet.set(categoryName, new Set());
          }
          if (brandName) {
            brandsByCategorySet.get(categoryName).add(brandName);
          }
        }
        if (brandName) brandsSet.add(brandName);
      }

      const categories = Array.from(categoriesSet).sort((a, b) =>
        a.localeCompare(b)
      );
      const brands = Array.from(brandsSet).sort((a, b) => a.localeCompare(b));
      const brandsByCategory = Object.fromEntries(
        categories.map((c) => {
          const set = brandsByCategorySet.get(c);
          const arr = set ? Array.from(set) : [];
          arr.sort((a, b) => a.localeCompare(b));
          return [c, arr];
        })
      );

      return { categories, brands, brandsByCategory };
    }

    const fromProducts = await loadFiltersFromProducts();
    const payload = {
      categories: fromProducts.categories,
      brands: fromProducts.brands,
      brandsByCategory: fromProducts.brandsByCategory,
    };

    catalogFiltersErrorCount = 0;
    lastGoodCatalogFilters = payload;
    cacheManager.set("products", cacheKey, payload, 12 * 60 * 60);
    setCatalogCacheHeaders(res);
    return res.json(payload);
  } catch (err) {
    const status = extractAxiosStatus(err);
    console.error("Catalog filters load failed", {
      status,
      message: err?.message || err,
    });

    // Rate limit handling - exponential backoff
    if (status === 403 || status === 429) {
      catalogFiltersErrorCount++;
      const backoffSeconds = Math.min(
        300,
        Math.pow(2, catalogFiltersErrorCount)
      );
      console.log(
        `Rate limited, backing off for ${backoffSeconds}s (attempt ${catalogFiltersErrorCount})`
      );

      const fallback = lastGoodCatalogFilters || {
        categories: [],
        brands: [],
        brandsByCategory: {},
      };

      cacheManager.set("products", cacheKey, fallback, backoffSeconds);
      setCatalogCacheHeaders(res);
      return res.json(fallback);
    }

    let fallback = lastGoodCatalogFilters;
    if (!fallback) {
      try {
        fallback = await (async () => {
          const pbProducts = axios.create({
            baseURL: pbUrl,
            timeout: 30000,
            headers: pbHeaders,
          });

          const resp = await pbProducts.get(
            "/api/collections/products/records",
            {
              params: {
                page: 1,
                perPage: 2000,
                filter: 'status = "active"',
                sort: "-updated",
                fields: "id,brand,category,expand.brand,expand.category",
                expand: "brand,category",
              },
            }
          );

          const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
          const categoriesSet = new Set();
          const brandsSet = new Set();

          for (const p of items) {
            const categoryName = String(p?.expand?.category?.name || "").trim();
            const brandName = String(p?.expand?.brand?.name || "").trim();
            if (categoryName) categoriesSet.add(categoryName);
            if (brandName) brandsSet.add(brandName);
          }

          const categories = Array.from(categoriesSet).sort((a, b) =>
            a.localeCompare(b)
          );
          const brands = Array.from(brandsSet).sort((a, b) =>
            a.localeCompare(b)
          );
          const brandsByCategory = Object.fromEntries(
            categories.map((c) => [c, brands])
          );

          return { categories, brands, brandsByCategory };
        })();
      } catch {
        fallback = {
          categories: [],
          brands: [],
          brandsByCategory: {},
        };
      }
    }

    cacheManager.set("products", cacheKey, fallback, 60);
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
  const cached = cacheManager.get("pages", cacheKey);
  if (cached) {
    setCatalogCacheHeaders(res);
    return res.json(normalizeProductDescriptions(cached));
  }

  const isHomeUnfiltered = !search && !brand && !category;
  if (isHomeUnfiltered) {
    const orderCacheKey = `order:home:${seed || "default"}`;
    let orderedIds = cacheManager.get("shuffle", orderCacheKey);

    if (!orderedIds) {
      const idRecords = await loadProductIdsOnly(2000, 'status = "active"');
      const shuffled = seed
        ? shuffleDeterministic(idRecords, `home:${seed}`)
        : shuffleDeterministic(idRecords, "home:default");
      const mixed = mixByCategoryRoundRobin(shuffled, seed || "default");
      orderedIds = mixed.map((p) => p.id);
      cacheManager.set("shuffle", orderCacheKey, orderedIds);
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

    cacheManager.set("pages", cacheKey, payload);
    setCatalogCacheHeaders(res);
    return res.json(normalizeProductDescriptions(payload));
  }

  const pbUrl = String(process.env.PB_URL || "").trim();
  if (!pbUrl) {
    throw new Error("PB_URL is not configured");
  }

  const pbToken = String(process.env.PB_TOKEN || "").trim();
  const pbHeaders = { Accept: "application/json" };
  if (pbToken) {
    pbHeaders.Authorization = pbToken.includes(" ")
      ? pbToken
      : `Bearer ${pbToken}`;
  }

  let brandId = "";
  let categoryId = "";
  if (brand) {
    brandId = await resolveRelationIdByName({
      collection: "brands",
      name: brand,
      pbUrl,
      pbHeaders,
    });
  }
  if (category) {
    categoryId = await resolveRelationIdByName({
      collection: "categories",
      name: category,
      pbUrl,
      pbHeaders,
    });
  }

  if ((brand && !brandId) || (category && !categoryId)) {
    const payload = {
      products: [],
      page: 1,
      perPage,
      totalPages: 1,
      totalItems: 0,
      hasNextPage: false,
    };
    cacheManager.set("pages", cacheKey, payload);
    setCatalogCacheHeaders(res);
    return res.json(normalizeProductDescriptions(payload));
  }

  let filterParts = ['status = "active"'];
  
  // Validate IDs to prevent SQL injection
  if (brandId) {
    if (!isValidPocketBaseId(brandId)) {
      console.warn("Invalid brand ID format:", brandId);
      const payload = {
        products: [],
        page: 1,
        perPage,
        totalPages: 1,
        totalItems: 0,
        hasNextPage: false,
      };
      cacheManager.set("pages", cacheKey, payload);
      setCatalogCacheHeaders(res);
      return res.json(normalizeProductDescriptions(payload));
    }
    filterParts.push(`brand = "${brandId}"`);
  }
  
  if (categoryId) {
    if (!isValidPocketBaseId(categoryId)) {
      console.warn("Invalid category ID format:", categoryId);
      const payload = {
        products: [],
        page: 1,
        perPage,
        totalPages: 1,
        totalItems: 0,
        hasNextPage: false,
      };
      cacheManager.set("pages", cacheKey, payload);
      setCatalogCacheHeaders(res);
      return res.json(normalizeProductDescriptions(payload));
    }
    filterParts.push(`category = "${categoryId}"`);
  }
  
  const customFilter = filterParts.join(" && ");

  try {
    let totalItems = 0;
    let allIds = [];

    if (search || brand || category) {
      const idRecords = await loadProductIdsOnly(2000, customFilter);
      allIds = idRecords;

      if (search) {
        const q = search.toLowerCase();
        const tokens = q
          .split(" ")
          .map((t) => t.trim())
          .filter(Boolean);
        if (tokens.length) {
          allIds = idRecords.filter((p) => {
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

      if (seed) {
        allIds = shuffleDeterministic(allIds, seed);
      }

      totalItems = allIds.length;
      const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * perPage;
      const end = start + perPage;
      const pageIds = allIds
        .slice(start, end)
        .map((x) => String(x?.id || "").trim())
        .filter(Boolean);

      const pageProducts = await loadProductsByIds(pageIds);
      const pageItems = pageProducts.map((p) => {
        const thumb =
          typeof p?.thumb === "string" ? String(p.thumb).trim() : "";
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

      cacheManager.set("pages", cacheKey, payload);
      setCatalogCacheHeaders(res);
      return res.json(normalizeProductDescriptions(payload));
    }

    const pbResult = await listActiveProducts(page, perPage, customFilter);
    let products = pbResult.items;

    if (seed) {
      products = shuffleDeterministic(products, seed);
    }

    totalItems = pbResult.totalItems || products.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));

    const pageItems = products.map((p) => {
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
      page,
      perPage,
      totalPages,
      totalItems,
      hasNextPage: page < totalPages,
    };

    cacheManager.set("pages", cacheKey, payload);
    setCatalogCacheHeaders(res);
    return res.json(normalizeProductDescriptions(payload));
  } catch (err) {
    console.error("handleExternalProducts error:", err.message);
    throw err;
  }
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function handleImageProxy(req, res) {
  const rawUrl = String(req.query.u || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing u" });
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return res.status(400).json({ error: "Invalid u" });
  }

  const allowedHosts = new Set([
    "hb.ru-msk.vkcloud-storage.ru",
    "yeezy-app.hb.ru-msk.vkcloud-storage.ru",
  ]);
  if (!allowedHosts.has(url.hostname)) {
    return res.status(400).json({ error: "Host not allowed" });
  }

  const clientEtag = String(req.headers["if-none-match"] || "").trim();

  const upstream = axios.create({
    timeout: 30000,
    responseType: "arraybuffer",
    maxRedirects: 2,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const upstreamResp = await upstream.get(url.toString());
  const upstreamEtag = upstreamResp?.headers?.etag
    ? String(upstreamResp.headers.etag).trim()
    : "";

  if (clientEtag && upstreamEtag && clientEtag === upstreamEtag) {
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("ETag", upstreamEtag);
    return res.status(304).end();
  }

  const contentTypeRaw = upstreamResp?.headers?.["content-type"]
    ? String(upstreamResp.headers["content-type"]).trim()
    : "";
  const contentType = contentTypeRaw || "image/jpeg";

  res.set("Cache-Control", "public, max-age=31536000, immutable");
  if (upstreamEtag) res.set("ETag", upstreamEtag);
  if (upstreamResp?.headers?.["last-modified"]) {
    res.set(
      "Last-Modified",
      String(upstreamResp.headers["last-modified"]).trim()
    );
  }
  res.set("Content-Type", contentType);

  return res.status(200).send(upstreamResp.data);
}

// Image proxy (adds proper cache headers for VKCloud)
app.get(
  "/api/img",
  asyncRoute(async (req, res) => {
    return handleImageProxy(req, res);
  })
);

// Versioned image proxy (alias for Telegram frontend)
app.get(
  "/api/:version/:shop/img",
  asyncRoute(async (req, res) => {
    return handleImageProxy(req, res);
  })
);

// ISR endpoint for products with file caching
app.get(
  "/api/products/isr",
  asyncRoute(async (req, res) => {
    const cached = await loadFromFile(PRODUCTS_CACHE_FILE);
    if (cached) {
      res.set("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.json(normalizeProductDescriptions(cached));
    }

    try {
      const products = await listActiveProducts(1, 200);
      await saveToFile(PRODUCTS_CACHE_FILE, products);

      res.set("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
      return res.json(normalizeProductDescriptions(products));
    } catch (err) {
      console.error("ISR products error:", err.message);
      return res.status(500).json({ error: "Failed to load products" });
    }
  })
);

// ISR endpoint for catalog filters with file caching
app.get(
  "/api/catalog-filters/isr",
  asyncRoute(async (req, res) => {
    const cached = await loadFromFile(CATALOG_FILTERS_CACHE_FILE);
    if (cached) {
      res.set("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
      return res.json(cached);
    }

    try {
      const pbUrl = String(process.env.PB_URL || "").trim();
      if (!pbUrl) {
        throw new Error("PB_URL is not configured");
      }

      const pbToken = String(process.env.PB_TOKEN || "").trim();
      const pbHeaders = { Accept: "application/json" };
      if (pbToken) {
        pbHeaders.Authorization = pbToken.includes(" ")
          ? pbToken
          : `Bearer ${pbToken}`;
      }

      const pb = axios.create({
        baseURL: pbUrl,
        timeout: 15000,
        headers: pbHeaders,
      });

      const [categoriesResp, brandsResp] = await Promise.all([
        pb.get("/api/collections/categories/records", {
          params: { page: 1, perPage: 2000, sort: "name", fields: "id,name" },
        }),
        pb.get("/api/collections/brands/records", {
          params: { page: 1, perPage: 2000, sort: "name", fields: "id,name" },
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

      const payload = { categories, brands, brandsByCategory };
      await saveToFile(CATALOG_FILTERS_CACHE_FILE, payload);

      res.set("Cache-Control", "s-maxage=600, stale-while-revalidate=1200");
      return res.json(payload);
    } catch (err) {
      console.error("ISR catalog filters error:", err.message);
      return res.status(500).json({ error: "Failed to load catalog filters" });
    }
  })
);

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

// Profile endpoints - use shared handlers
app.get(["/api/profile/state", "/profile/state"], asyncRoute(handleGetProfileState));
app.post(["/api/profile/state", "/profile/state"], asyncRoute(handleUpdateProfileState));

// Orders endpoint - use shared handler
app.post(["/orders", "/api/orders"], orderRateLimiter, asyncRoute(handleOrderSubmission));

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
