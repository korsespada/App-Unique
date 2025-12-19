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

function safeHexEqual(hexA, hexB) {
  try {
    const a = Buffer.from(String(hexA || ''), 'hex');
    const b = Buffer.from(String(hexB || '').toLowerCase(), 'hex');
    if (a.length === 0 || b.length === 0) return false;
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
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
  // Telegram docs wording/implementations differ in argument order for HMAC helper functions.
  // We compute both variants (both are derived from bot token) and accept if either matches.
  const secretKeyV1 = crypto.createHmac('sha256', 'WebAppData').update(botTokenStr).digest();
  const calculatedHashV1 = crypto.createHmac('sha256', secretKeyV1).update(dataCheckString).digest('hex');

  const secretKeyV2 = crypto.createHmac('sha256', botTokenStr).update('WebAppData').digest();
  const calculatedHashV2 = crypto.createHmac('sha256', secretKeyV2).update(dataCheckString).digest('hex');

  const okV1 = safeHexEqual(calculatedHashV1, hash);
  const okV2 = safeHexEqual(calculatedHashV2, hash);

  if (!okV1 && !okV2) {
    return {
      ok: false,
      error: 'initData не прошёл проверку подписи',
      debug: {
        hasSignatureParam: String(initDataStr).includes('signature='),
        keys: Object.keys(data).sort(),
        receivedHashPrefix: String(hash || '').slice(0, 12),
        calculatedHashV1Prefix: String(calculatedHashV1 || '').slice(0, 12),
        calculatedHashV2Prefix: String(calculatedHashV2 || '').slice(0, 12),
        dataCheckStringSha256Prefix: crypto
          .createHash('sha256')
          .update(dataCheckString)
          .digest('hex')
          .slice(0, 12),
      },
    };
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

  return { ok: true, data, user, debug: { matched: okV1 ? 'v1' : 'v2' } };
}

module.exports = {
  validateTelegramInitData,
  parseInitData,
};
