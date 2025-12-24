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
    headers.Authorization = trimmed.includes(' ') ? trimmed : trimmed;
  }

  return axios.create({
    baseURL: url,
    headers,
    timeout: 30000,
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

  const photos = safeArray(record.photos);
  const images = photos
    .map((p) => safeString(p))
    .filter(Boolean);

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
        filter: 'status = "active"',
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
  listAllActiveProducts,
};
