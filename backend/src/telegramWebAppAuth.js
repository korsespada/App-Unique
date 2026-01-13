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
  // Строгая валидация: только 300 секунд (5 минут) по умолчанию
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

  // Используем только актуальную версию подписи (v2 без signature)
  // Это предотвращает downgrade атаки
  const dataWithoutSignature = { ...data };
  delete dataWithoutSignature.signature;

  const dataCheckString = buildDataCheckString(dataWithoutSignature);

  // Только v2 (актуальная версия Telegram WebApp)
  const secretKey = crypto.createHmac('sha256', botTokenStr).update('WebAppData').digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!safeHexEqual(calculatedHash, hash)) {
    const botIdFromToken = String(botTokenStr).split(':')[0] || '';
    const botTokenSha256Prefix = crypto.createHash('sha256').update(botTokenStr).digest('hex').slice(0, 12);
    
    return {
      ok: false,
      error: 'initData не прошёл проверку подписи',
      debug: {
        botIdFromToken,
        botTokenSha256Prefix,
        receivedHashPrefix: String(hash || '').slice(0, 12),
        calculatedHashPrefix: String(calculatedHash || '').slice(0, 12),
        keysUsed: Object.keys(dataWithoutSignature).sort(),
      },
    };
  }

  // Проверка времени жизни (строгая)
  const authDate = Number(data.auth_date);
  if (Number.isFinite(authDate) && authDate > 0) {
    const now = Math.floor(Date.now() / 1000);
    const age = now - authDate;
    
    if (age > maxAgeSeconds) {
      return { 
        ok: false, 
        error: `initData устарел (${age}с > ${maxAgeSeconds}с)` 
      };
    }
    
    // Защита от атак с будущим временем
    if (age < -60) {
      return { 
        ok: false, 
        error: 'initData из будущего (возможная атака)' 
      };
    }
  } else {
    return { 
      ok: false, 
      error: 'auth_date отсутствует или некорректен' 
    };
  }

  let user = null;
  if (data.user) {
    try {
      user = JSON.parse(data.user);
    } catch {
      return { ok: false, error: 'Некорректные данные пользователя' };
    }
  }

  const botIdFromToken = String(botTokenStr).split(':')[0] || '';
  const botTokenSha256Prefix = crypto.createHash('sha256').update(botTokenStr).digest('hex').slice(0, 12);

  return {
    ok: true,
    data,
    user,
    debug: {
      version: 'v2-strict',
      botIdFromToken,
      botTokenSha256Prefix,
      age: Math.floor(Date.now() / 1000) - authDate,
    }
  };
}

module.exports = {
  validateTelegramInitData,
  parseInitData,
};
