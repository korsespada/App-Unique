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
  const signature = params.get('signature') || '';

  const data = {};
  params.forEach((value, key) => {
    if (key === 'hash') return;
    data[key] = value;
  });

  return { hash, signature, data };
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
  const maxAgeSeconds = Number(options.maxAgeSeconds ?? 300);

  const initDataStr = normalizeEnvString(initData);
  const botTokenStr = normalizeEnvString(botToken);

  if (!initDataStr) {
    return { ok: false, error: 'initData отсутствует' };
  }

  if (!botTokenStr) {
    return { ok: false, error: 'botToken отсутствует' };
  }

  const { hash, signature, data } = parseInitData(initDataStr);
  if (!hash) {
    return { ok: false, error: 'hash отсутствует' };
  }

  const dataWithSignature = data;
  const dataWithoutSignature = { ...dataWithSignature };
  delete dataWithoutSignature.signature;

  const dataCheckStringWithSignature = buildDataCheckString(dataWithSignature);
  const dataCheckStringWithoutSignature = buildDataCheckString(dataWithoutSignature);

  const botIdFromToken = String(botTokenStr).split(':')[0] || '';
  const botTokenSha256Prefix = crypto.createHash('sha256').update(botTokenStr).digest('hex').slice(0, 12);

  const secretKeyV1 = crypto.createHmac('sha256', 'WebAppData').update(botTokenStr).digest();
  const secretKeyV2 = crypto.createHmac('sha256', botTokenStr).update('WebAppData').digest();

  const candidates = [
    {
      secret: 'v1',
      dcs: 'withSignature',
      value: crypto.createHmac('sha256', secretKeyV1).update(dataCheckStringWithSignature).digest('hex'),
    },
    {
      secret: 'v1',
      dcs: 'withoutSignature',
      value: crypto.createHmac('sha256', secretKeyV1).update(dataCheckStringWithoutSignature).digest('hex'),
    },
    {
      secret: 'v2',
      dcs: 'withSignature',
      value: crypto.createHmac('sha256', secretKeyV2).update(dataCheckStringWithSignature).digest('hex'),
    },
    {
      secret: 'v2',
      dcs: 'withoutSignature',
      value: crypto.createHmac('sha256', secretKeyV2).update(dataCheckStringWithoutSignature).digest('hex'),
    },
  ];

  const matched = candidates.find((c) => safeHexEqual(c.value, hash)) || null;

  if (!matched) {
    return {
      ok: false,
      error: 'initData не прошёл проверку подписи',
      debug: {
        botIdFromToken,
        botTokenSha256Prefix,
        hasSignatureParam: Boolean(signature) || String(initDataStr).includes('signature='),
        keysWithSignature: Object.keys(dataWithSignature).sort(),
        keysWithoutSignature: Object.keys(dataWithoutSignature).sort(),
        receivedHashPrefix: String(hash || '').slice(0, 12),
        calculatedPrefixes: {
          v1WithSignature: String(candidates[0].value || '').slice(0, 12),
          v1WithoutSignature: String(candidates[1].value || '').slice(0, 12),
          v2WithSignature: String(candidates[2].value || '').slice(0, 12),
          v2WithoutSignature: String(candidates[3].value || '').slice(0, 12),
        },
        dcsSha256Prefixes: {
          withSignature: crypto.createHash('sha256').update(dataCheckStringWithSignature).digest('hex').slice(0, 12),
          withoutSignature: crypto.createHash('sha256').update(dataCheckStringWithoutSignature).digest('hex').slice(0, 12),
        }
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

  return {
    ok: true,
    data,
    user,
    debug: {
      matched: `${matched.secret}:${matched.dcs}`,
      botIdFromToken,
      botTokenSha256Prefix,
    }
  };
}

module.exports = {
  validateTelegramInitData,
  parseInitData,
};
