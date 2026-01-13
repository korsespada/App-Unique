/**
 * Shared utility functions
 */

function normalizeDescription(s) {
  return typeof s === "string" ? s.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n") : s;
}

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

function buildPagedResponse(allProducts, { page, perPage }) {
  const safePage = Math.max(1, Number(page) || 1);
  const safePerPage = Math.max(1, Math.min(2000, Number(perPage) || 200));

  const totalItems = Array.isArray(allProducts) ? allProducts.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePerPage));
  const normalizedPage = Math.min(safePage, totalPages);
  const start = (normalizedPage - 1) * safePerPage;
  const end = start + safePerPage;
  const products = (Array.isArray(allProducts) ? allProducts : []).slice(start, end);

  return {
    products,
    page: normalizedPage,
    perPage: safePerPage,
    totalPages,
    totalItems,
    hasNextPage: normalizedPage < totalPages,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

/**
 * Validates that a string is a valid PocketBase record ID
 * PocketBase IDs are 15-character alphanumeric strings
 */
function isValidPocketBaseId(id) {
  if (typeof id !== "string") return false;
  return /^[a-z0-9]{15}$/.test(id);
}

module.exports = {
  normalizeDescription,
  normalizeProductDescriptions,
  hashStringToUint32,
  shuffleDeterministic,
  mixByBrandRoundRobin,
  mixByCategoryRoundRobin,
  buildPagedResponse,
  escapeHtml,
  splitTelegramMessage,
  isValidPocketBaseId,
};
