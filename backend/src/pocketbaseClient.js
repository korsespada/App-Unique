const axios = require("axios");
const https = require("https");

// Shared agent для переиспользования TCP-соединений
const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 60000,
});

function getPbConfig() {
  const url = String(process.env.PB_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const token = String(process.env.PB_TOKEN || "").trim();
  return { url, token };
}

function pbApi() {
  const { url, token } = getPbConfig();
  if (!url) {
    throw new Error("PB_URL is not set");
  }

  const headers = { Accept: "application/json" };
  if (token) {
    const trimmed = String(token).trim();
    headers.Authorization = trimmed.includes(" ")
      ? trimmed
      : `Bearer ${trimmed}`;
  }

  return axios.create({
    baseURL: url,
    headers,
    timeout: 60000,
    httpsAgent,
  });
}

function safeString(value) {
  if (value == null) return "";
  return String(value).trim();
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isAxiosNotFound(err) {
  const status = err?.response?.status;
  return status === 404;
}

function isAxiosConflict(err) {
  const status = err?.response?.status;
  return status === 409;
}

function normalizeFavorites(value) {
  return safeArray(value)
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

function normalizeCart(value) {
  const arr = safeArray(value);
  return arr
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const id = safeString(it.id);
      const name = safeString(it.name);
      const quantity = Math.min(99, Math.max(1, Number(it.quantity) || 1));
      const brand = safeString(it.brand) || " ";
      const category = safeString(it.category) || "Все";
      const priceRaw = Number(it.price);
      const hasPrice =
        it.hasPrice === false
          ? false
          : Number.isFinite(priceRaw) && priceRaw > 0;
      const price = hasPrice ? priceRaw : 0;
      const images = safeArray(it.images)
        .map((x) => safeString(x))
        .filter(Boolean);
      const description = safeString(it.description);
      const details = safeArray(it.details)
        .map((x) => safeString(x))
        .filter(Boolean);
      if (!id || !name) return null;
      return {
        id,
        name,
        brand,
        category,
        price,
        hasPrice,
        images,
        description,
        details,
        quantity,
      };
    })
    .filter(Boolean);
}

/**
 * Validates that a string is a valid Telegram user ID (numeric only)
 */
function isValidTelegramId(id) {
  if (typeof id !== "string" && typeof id !== "number") return false;
  const str = String(id).trim();
  return /^\d{1,20}$/.test(str);
}

async function getProfileByTelegramId(telegramId) {
  const api = pbApi();
  const tg = safeString(telegramId);
  if (!tg) throw new Error("telegramId is required");

  // Validate telegramId format to prevent injection
  if (!isValidTelegramId(tg)) {
    throw new Error("Invalid telegramId format");
  }

  try {
    const resp = await api.get("/api/collections/profiles/records", {
      params: {
        page: 1,
        perPage: 1,
        filter: `telegramid = "${tg}"`,
      },
    });
    const items = Array.isArray(resp?.data?.items) ? resp.data.items : [];
    return items[0] || null;
  } catch (err) {
    if (isAxiosNotFound(err)) {
      throw new Error('PocketBase collection "profiles" not found');
    }
    throw err;
  }
}

async function createProfile(payload) {
  const api = pbApi();
  const data = payload && typeof payload === "object" ? payload : {};
  const telegramid = safeString(data.telegramid);
  if (!telegramid) throw new Error("telegramid is required");
  const resp = await api.post("/api/collections/profiles/records", data);
  return resp?.data || null;
}

async function ensureProfileByTelegramId({ telegramId, username, nickname }) {
  const tg = safeString(telegramId);
  if (!tg) throw new Error("telegramId is required");

  const existing = await getProfileByTelegramId(tg);
  if (existing) return existing;

  try {
    return await createProfile({
      telegramid: tg,
      username: safeString(username),
      nickname: safeString(nickname),
      favorites: [],
      cart: [],
    });
  } catch (err) {
    if (isAxiosConflict(err)) {
      return await getProfileByTelegramId(tg);
    }
    throw err;
  }
}

async function patchProfile(profileId, patch) {
  const api = pbApi();
  const id = safeString(profileId);
  if (!id) throw new Error("profileId is required");
  const data = patch && typeof patch === "object" ? patch : {};
  const resp = await api.patch(
    `/api/collections/profiles/records/${encodeURIComponent(id)}`,
    data
  );
  return resp?.data || null;
}

async function updateProfileCartAndFavorites({
  telegramId,
  username,
  nickname,
  cart,
  favorites,
}) {
  const profile = await ensureProfileByTelegramId({
    telegramId,
    username,
    nickname,
  });
  const patch = {
    cart: normalizeCart(cart),
    favorites: normalizeFavorites(favorites),
  };
  if (safeString(username)) patch.username = safeString(username);
  if (safeString(nickname)) patch.nickname = safeString(nickname);
  return await patchProfile(profile.id, patch);
}

function pickRecordLabel(record) {
  if (!record || typeof record !== "object") return "";

  const candidates = ["name", "title", "label", "slug"];
  for (const key of candidates) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === "id") continue;
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return safeString(record.id);
}

function mapPbProductToExternal(record) {
  const productId = safeString(
    record.productId || record.product_id || record.productid || record.id
  );
  const name = safeString(
    record.name ||
    record.title ||
    record.titletext ||
    record.titleText ||
    productId
  );
  const description = safeString(record.description || "");
  const status = safeString(record.status || "");

  const expand =
    record.expand && typeof record.expand === "object" ? record.expand : {};
  const brandValue = expand.brand
    ? pickRecordLabel(expand.brand)
    : safeString(record.brand);
  const categoryValue = expand.category
    ? pickRecordLabel(expand.category)
    : safeString(record.category);

  const imagesCandidates = [
    record.images,
    record.photos,
    record.photo,
    record.pictures,
    record.gallery,
  ];
  const imagesRaw = safeArray(
    imagesCandidates.find((v) => Array.isArray(v) && v.length)
  );
  const images = Array.from(
    new Set(imagesRaw.map((p) => safeString(p)).filter(Boolean))
  );

  const thumb = safeString(
    record.thumb || record.thumbs || record.thumb_new || record.thumbs_new
  );

  const rawPrice = Number(record.price);
  const price = Number.isFinite(rawPrice) ? rawPrice : 0;

  return {
    id: productId,
    product_id: productId,
    title: name,
    name,
    brand: brandValue,
    season_title: brandValue,
    category: categoryValue,
    description,
    status,
    price,
    images: images.length
      ? images
      : ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000"],
    thumb,
    inStock: true,
  };
}

async function listActiveProducts(
  page = 1,
  perPage = 2000,
  customFilter = null
) {
  const api = pbApi();

  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(2000, Number(perPage) || 2000));

  let data;
  try {
    const filter = customFilter || 'status = "active"';
    const resp = await api.get("/api/collections/products/records", {
      params: {
        page: safePage,
        perPage: safePerPage,
        filter,
        sort: "-updated",
        fields:
          "id,name,description,photos,thumb,price,brand,category,expand.brand,expand.category,updated",
        expand: "brand,category",
      },
    });
    data = resp?.data;
  } catch (err) {
    const status = err?.response?.status;
    const respData = err?.response?.data;
    const msg =
      typeof respData === "string" && respData.trim()
        ? respData
        : respData &&
          typeof respData === "object" &&
          (respData.message || respData.error)
          ? String(respData.message || respData.error)
          : err?.message
            ? String(err.message)
            : "PocketBase request failed";

    console.error("PocketBase request failed", {
      baseURL: api?.defaults?.baseURL,
      path: "/api/collections/products/records",
      status,
      message: msg,
    });

    const statusText = Number.isFinite(status) ? String(status) : "unknown";
    throw new Error(`PocketBase error ${statusText}: ${msg}`);
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const mapped = items.map(mapPbProductToExternal).filter((p) => p.id);

  return {
    items: mapped,
    page: Number(data?.page) || safePage,
    perPage: Number(data?.perPage) || safePerPage,
    totalPages: Number(data?.totalPages) || 1,
    totalItems: Number(data?.totalItems) || mapped.length,
  };
}

async function listAllActiveProducts(perPage = 2000) {
  const safePerPage = Math.max(1, Math.min(2000, Number(perPage) || 2000));

  const first = await listActiveProducts(1, safePerPage);
  const totalPages = Math.max(1, Number(first.totalPages) || 1);

  if (totalPages <= 1) {
    return first;
  }

  const pagePromises = [];
  for (let page = 2; page <= totalPages; page += 1) {
    pagePromises.push(listActiveProducts(page, safePerPage));
  }

  const remainingPages = await Promise.all(pagePromises);
  const all = [...(first.items || [])];
  for (const page of remainingPages) {
    if (Array.isArray(page?.items) && page.items.length) {
      all.push(...page.items);
    }
  }

  return {
    items: all,
    page: 1,
    perPage: safePerPage,
    totalPages,
    totalItems: Number(first.totalItems) || all.length,
  };
}

async function getActiveProductById(productId) {
  const api = pbApi();
  const id = safeString(productId);
  if (!id) throw new Error("productId is required");

  let record;
  try {
    const resp = await api.get(
      `/api/collections/products/records/${encodeURIComponent(id)}`,
      {
        params: {
          fields:
            "id,name,description,photos,thumb,price,brand,category,status,expand.brand,expand.category,updated",
          expand: "brand,category",
        },
      }
    );
    record = resp?.data || null;
  } catch (err) {
    if (isAxiosNotFound(err)) return null;
    throw err;
  }

  if (!record || typeof record !== "object") return null;
  if (safeString(record.status) !== "active") return null;
  const mapped = mapPbProductToExternal(record);
  return mapped && mapped.id ? mapped : null;
}

async function loadProductIdsOnly(perPage = 2000, customFilter = null) {
  const api = pbApi();
  const safePerPage = Math.max(1, Math.min(2000, Number(perPage) || 2000));

  let allIds = [];
  let page = 1;
  let totalPages = 1;

  try {
    const filter = customFilter || 'status = "active"';
    const hasBrandFilter = filter.includes("brand.name");
    const hasCategoryFilter = filter.includes("category.name");

    const requestedExpands = [];
    if (hasBrandFilter) requestedExpands.push("brand");
    if (hasCategoryFilter) requestedExpands.push("category");

    const fieldsParts = ["id", "name", "description", "category"];
    if (hasBrandFilter) fieldsParts.push("brand");
    if (requestedExpands.includes("brand")) fieldsParts.push("expand.brand");
    if (requestedExpands.includes("category"))
      fieldsParts.push("expand.category");

    const params = {
      page: 1,
      perPage: safePerPage,
      filter,
      sort: "-updated",
      fields: fieldsParts.join(","),
    };

    if (hasBrandFilter || hasCategoryFilter) {
      params.expand = requestedExpands.join(",");
    }

    console.log("PocketBase request params:", JSON.stringify(params, null, 2));

    const firstResp = await api.get("/api/collections/products/records", {
      params,
    });

    const firstData = firstResp?.data;
    if (!firstData) {
      return [];
    }

    const firstItems = Array.isArray(firstData.items) ? firstData.items : [];
    allIds.push(...firstItems);
    totalPages = Number(firstData.totalPages) || 1;

    if (totalPages > 1) {
      const pagePromises = [];
      for (let p = 2; p <= totalPages; p += 1) {
        const pageParams = {
          ...params,
          page: p,
        };
        pagePromises.push(
          api.get("/api/collections/products/records", { params: pageParams })
        );
      }

      const remainingPages = await Promise.all(pagePromises);
      for (const resp of remainingPages) {
        const data = resp?.data;
        if (data && Array.isArray(data.items)) {
          allIds.push(...data.items);
        }
      }
    }
  } catch (err) {
    const status = err?.response?.status;
    const responseData = err?.response?.data;
    const msg =
      typeof responseData === "string" && responseData.trim()
        ? responseData
        : responseData && typeof responseData === "object"
          ? JSON.stringify(responseData)
          : err?.message
            ? String(err.message)
            : "PocketBase request failed";

    console.error("PocketBase loadProductIdsOnly failed", {
      status,
      message: msg,
      responseData,
      filter: customFilter,
    });

    const statusText = Number.isFinite(status) ? String(status) : "unknown";
    throw new Error(`PocketBase error ${statusText}: ${msg}`);
  }

  console.log(
    `loadProductIdsOnly loaded ${allIds.length} items in ${totalPages} pages`
  );

  // КРИТИЧЕСКИ ВАЖНО: Сортируем по ID для детерминированного перемешивания (shuffle)
  return allIds.sort((a, b) => {
    const idA = String(a?.id || "");
    const idB = String(b?.id || "");
    return idA.localeCompare(idB);
  });
}

async function loadProductsByIds(ids) {
  const api = pbApi();
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const filter = ids
    .map((id) => `id = "${safeString(id).replace(/"/g, '\\"')}"`)
    .join(" || ");

  try {
    const resp = await api.get("/api/collections/products/records", {
      params: {
        page: 1,
        perPage: ids.length,
        filter,
        sort: "-updated",
        fields:
          "id,name,description,photos,thumb,price,brand,category,expand.brand,expand.category,updated",
        expand: "brand,category",
      },
    });

    const data = resp?.data;
    const items = Array.isArray(data?.items) ? data.items : [];
    const mapped = items.map(mapPbProductToExternal).filter((p) => p.id);

    const idMap = new Map(mapped.map((p) => [p.id, p]));
    return ids.map((id) => idMap.get(id)).filter(Boolean);
  } catch (err) {
    const status = err?.response?.status;
    const msg =
      typeof err?.response?.data === "string"
        ? err.response.data
        : err?.response?.data?.message ||
        err?.message ||
        "PocketBase request failed";

    console.error("PocketBase loadProductsByIds failed", {
      status,
      message: msg,
    });

    const statusText = Number.isFinite(status) ? String(status) : "unknown";
    throw new Error(`PocketBase error ${statusText}: ${msg}`);
  }
}

module.exports = {
  pbApi,
  listActiveProducts,
  getProfileByTelegramId,
  ensureProfileByTelegramId,
  updateProfileCartAndFavorites,
  listAllActiveProducts,
  getActiveProductById,
  loadProductIdsOnly,
  loadProductsByIds,
  createOrder,
  getOrdersByTelegramId,
};

async function createOrder(payload) {
  const api = pbApi();
  const data = payload && typeof payload === "object" ? payload : {};
  if (!data.telegram_id) throw new Error("telegram_id is required");

  const resp = await api.post("/api/collections/orders/records", data);
  return resp?.data || null;
}

async function getOrdersByTelegramId(telegramId) {
  const api = pbApi();
  const tg = safeString(telegramId);
  if (!tg) return [];

  try {
    const resp = await api.get("/api/collections/orders/records", {
      params: {
        page: 1,
        perPage: 50,
        sort: "-created",
        filter: `telegram_id = "${tg}"`,
      },
    });
    return Array.isArray(resp?.data?.items) ? resp.data.items : [];
  } catch (err) {
    if (isAxiosNotFound(err)) return [];
    console.error("Failed to fetch orders for", telegramId, err.message);
    return [];
  }
}
