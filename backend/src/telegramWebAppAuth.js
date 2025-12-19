const crypto = require('crypto');

function normalizeEnvString(value) {
  let s = String(value ?? '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

function parseInitData(initData) {
  const raw = String(initData || '').trim();
  const normalized = raw.startsWith('?') ? raw.slice(1) : raw;
  const params = new URLSearchParams(normalized);
  const hash = params.get('hash') || '';

  const data = {};
  params.forEach((value, key) => {
    if (key === 'hash') return;
    if (key === 'signature') return;
    data[key] = value;
  });

  return { hash, data };
}

function buildDataCheckString(data) {
  return Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('\n');
}

function validateTelegramInitData(initData, botToken, options = {}) {
  const maxAgeSeconds = Number(options.maxAgeSeconds ?? 86400);

  const initDataStr = normalizeEnvString(initData);
  const botTokenStr = normalizeEnvString(botToken);

  if (!initDataStr) {
    return { ok: false, error: 'initData отсутствует' };
  }

  if (!botTokenStr) {
    return { ok: false, error: 'botToken отсутствует' };
  }

  const { hash, data } = parseInitData(initDataStr);
  if (!hash) {
    return { ok: false, error: 'hash отсутствует' };
  }

  const dataCheckString = buildDataCheckString(data);
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botTokenStr).digest();
  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  let isValid = false;
  try {
    const a = Buffer.from(calculatedHash, 'hex');
    const b = Buffer.from(String(hash).toLowerCase(), 'hex');
    if (a.length === b.length && a.length > 0) {
      isValid = crypto.timingSafeEqual(a, b);
    }
  } catch {
    isValid = false;
  }

  if (!isValid) {
    return { ok: false, error: 'initData не прошёл проверку подписи' };
  }

  const authDate = Number(data.auth_date);
  if (Number.isFinite(authDate) && authDate > 0 && Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0) {
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > maxAgeSeconds) {
      return { ok: false, error: 'initData устарел' };
    }
  }

  let user = null;
  if (data.user) {
    try {
      user = JSON.parse(data.user);
    } catch {
      user = null;
    }
  }

  return { ok: true, data, user };
}

module.exports = {
  validateTelegramInitData,
  parseInitData,
};
