const crypto = require('crypto');

function parseInitData(initData) {
  const params = new URLSearchParams(String(initData || ''));
  const hash = params.get('hash') || '';

  const data = {};
  params.forEach((value, key) => {
    if (key === 'hash') return;
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

  if (!initData || typeof initData !== 'string') {
    return { ok: false, error: 'initData отсутствует' };
  }

  if (!botToken) {
    return { ok: false, error: 'botToken отсутствует' };
  }

  const { hash, data } = parseInitData(initData);
  if (!hash) {
    return { ok: false, error: 'hash отсутствует' };
  }

  const dataCheckString = buildDataCheckString(data);
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
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
