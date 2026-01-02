const axios = require('axios');

function getPbConfig() {
  const url = String(process.env.PB_URL || '').trim().replace(/\/+$/, '');
  const token = String(process.env.PB_TOKEN || '').trim();
  return { url, token };
}

function pbApi() {
  const { url, token } = getPbConfig();
  if (!url) {
    throw new Error('PB_URL is not set');
  }

  const headers = { Accept: 'application/json' };
  if (token) {
    const trimmed = String(token).trim();
    headers.Authorization = trimmed.includes(' ') ? trimmed : `Bearer ${trimmed}`;
  }

  return axios.create({
    baseURL: url,
    headers,
    timeout: 10000,
  });
}

function safeString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
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
    .map((x) => String(x ?? '').trim())
    .filter(Boolean);
}

function normalizeCart(value) {
  const arr = safeArray(value);
  return arr
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const id = safeString(it.id);
      const name = safeString(it.name);
      const quantity = Math.min(99, Math.max(1, Number(it.quantity) || 1));
      const brand = safeString(it.brand) || ' ';
      const category = safeString(it.category) || 'Все';
      const priceRaw = Number(it.price);
      const hasPrice = it.hasPrice === false ? false : Number.isFinite(priceRaw) && priceRaw > 0;
      const price = hasPrice ? priceRaw : 0;
      const images = safeArray(it.images).map((x) => safeString(x)).filter(Boolean);
      const description = safeString(it.description);
      const details = safeArray(it.details).map((x) => safeString(x)).filter(Boolean);
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

async function getProfileByTelegramId(telegramId) {
  const api = pbApi();
  const tg = safeString(telegramId);
  if (!tg) throw new Error('telegramId is required');

  try {
    const resp = await api.get('/api/collections/profiles/records', {
      params: {
        page: 1,
        perPage: 1,
        filter: `telegramid = "${tg.replace(/"/g, '\\"')}"`,
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
  const data = payload && typeof payload === 'object' ? payload : {};
  const telegramid = safeString(data.telegramid);
  if (!telegramid) throw new Error('telegramid is required');
  const resp = await api.post('/api/collections/profiles/records', data);
  return resp?.data || null;
}

async function ensureProfileByTelegramId({ telegramId, username, nickname }) {
  const tg = safeString(telegramId);
  if (!tg) throw new Error('telegramId is required');

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
  if (!id) throw new Error('profileId is required');
  const data = patch && typeof patch === 'object' ? patch : {};
  const resp = await api.patch(`/api/collections/profiles/records/${encodeURIComponent(id)}`, data);
  return resp?.data || null;
}

async function updateProfileCartAndFavorites({ telegramId, username, nickname, cart, favorites }) {
  const profile = await ensureProfileByTelegramId({ telegramId, username, nickname });
  const patch = {
    cart: normalizeCart(cart),
    favorites: normalizeFavorites(favorites),
  };
  if (safeString(username)) patch.username = safeString(username);
  if (safeString(nickname)) patch.nickname = safeString(nickname);
  return await patchProfile(profile.id, patch);
}

function pickRecordLabel(record) {
  if (!record || typeof record !== 'object') return '';

  const candidates = ['name', 'title', 'label', 'slug'];
  for (const key of candidates) {
    const v = record[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }

  for (const [key, value] of Object.entries(record)) {
    if (key === 'id') continue;
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return safeString(record.id);
}

function mapPbProductToExternal(record) {
  const productId = safeString(record.productId || record.product_id || record.productid || record.id);
  const name = safeString(record.name || record.title || record.titletext || record.titleText || productId);
  const description = safeString(record.description || '');
  const status = safeString(record.status || '');

  const expand = record.expand && typeof record.expand === 'object' ? record.expand : {};
  const brandValue = expand.brand ? pickRecordLabel(expand.brand) : safeString(record.brand);
  const categoryValue = expand.category ? pickRecordLabel(expand.category) : safeString(record.category);

  const imagesCandidates = [
    record.images,
    record.photos,
    record.photo,
    record.pictures,
    record.gallery,
  ];
  const imagesRaw = safeArray(imagesCandidates.find((v) => Array.isArray(v) && v.length));
  const images = imagesRaw.map((p) => safeString(p)).filter(Boolean);

  const thumb = safeString(record.thumb || record.thumbs || record.thumb_new || record.thumbs_new);

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
      : ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000'],
    thumb,
    inStock: true,
  };
}

async function listActiveProducts(page = 1, perPage = 2000) {
  const api = pbApi();

  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(2000, Number(perPage) || 2000));

  let data;
  try {
    const resp = await api.get('/api/collections/products/records', {
      params: {
        page: safePage,
        perPage: safePerPage,
        filter: 'status = "active" && ((thumb != null && thumb != "") || (photos != null && photos != ""))',
        sort: '-updated',
        fields: 'name,photos,thumb,price,brand,category,expand.brand,expand.category',
        skipTotal: true,
        expand: 'brand,category',
      },
    });
    data = resp?.data;
  } catch (err) {
    const status = err?.response?.status;
    const respData = err?.response?.data;
    const msg =
      (typeof respData === 'string' && respData.trim())
        ? respData
        : (respData && typeof respData === 'object' && (respData.message || respData.error))
          ? String(respData.message || respData.error)
          : (err?.message ? String(err.message) : 'PocketBase request failed');

    console.error('PocketBase request failed', {
      baseURL: api?.defaults?.baseURL,
      path: '/api/collections/products/records',
      status,
      message: msg,
    });

    const statusText = Number.isFinite(status) ? String(status) : 'unknown';
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
  const all = [...(first.items || [])];

  const totalPages = Math.max(1, Number(first.totalPages) || 1);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listActiveProducts(page, safePerPage);
    if (Array.isArray(next?.items) && next.items.length) {
      all.push(...next.items);
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

module.exports = {
  listActiveProducts,
  getProfileByTelegramId,
  ensureProfileByTelegramId,
  updateProfileCartAndFavorites,
  listAllActiveProducts,
};
