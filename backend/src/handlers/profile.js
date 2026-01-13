/**
 * Profile handling logic
 */
const cacheManager = require("../cacheManager");
const {
  getProfileByTelegramId,
  updateProfileCartAndFavorites,
} = require("../pocketbaseClient");
const {
  telegramAuthFromRequest,
  buildProfileFieldsFromTelegramUser,
} = require("../utils/telegram");

async function handleGetProfileState(req, res) {
  const auth = telegramAuthFromRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const cacheKey = `profile:${auth.telegramId}`;
  const cached = cacheManager.get("profiles", cacheKey);
  if (cached) return res.json(cached);

  const profile = await getProfileByTelegramId(auth.telegramId);
  const payload = {
    ok: true,
    profileExists: Boolean(profile),
    cart: Array.isArray(profile?.cart) ? profile.cart : [],
    favorites: Array.isArray(profile?.favorites) ? profile.favorites : [],
    nickname: typeof profile?.nickname === "string" ? profile.nickname : "",
  };
  cacheManager.set("profiles", cacheKey, payload);
  return res.json(payload);
}

async function handleUpdateProfileState(req, res) {
  const auth = telegramAuthFromRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const favorites = Array.isArray(body.favorites) ? body.favorites : [];
  const fallback = buildProfileFieldsFromTelegramUser(auth.user);
  const nickname = String(body.nickname || fallback.nickname || "").trim();
  const username = String(body.username || fallback.username || "").trim();

  const updated = await updateProfileCartAndFavorites({
    telegramId: auth.telegramId,
    username,
    nickname,
    cart,
    favorites,
  });

  cacheManager.del("profiles", `profile:${auth.telegramId}`);

  return res.json({
    ok: true,
    profileExists: true,
    cart: Array.isArray(updated?.cart) ? updated.cart : [],
    favorites: Array.isArray(updated?.favorites) ? updated.favorites : [],
    nickname: typeof updated?.nickname === "string" ? updated.nickname : nickname,
    username: typeof updated?.username === "string" ? updated.username : username,
  });
}

module.exports = {
  handleGetProfileState,
  handleUpdateProfileState,
};
