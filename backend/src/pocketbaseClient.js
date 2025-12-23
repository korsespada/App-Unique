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
    headers.Authorization = `Bearer ${token}`;
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

async function listActiveProducts() {
  const api = pbApi();

  const { data } = await api.get('/api/collections/products/records', {
    params: {
      page: 1,
      perPage: 2000,
      filter: 'status = "active"',
      expand: 'brand,category',
    },
  });

  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map(mapPbProductToExternal).filter((p) => p.id);
}

module.exports = {
  listActiveProducts,
};
