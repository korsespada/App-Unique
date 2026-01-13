/**
 * Telegram-related utilities
 */
const axios = require("axios");
const { validateTelegramInitData, parseInitData } = require("../telegramWebAppAuth");

let cachedBotUsername = null;

async function getBotUsername(botToken) {
  const fromEnv = String(process.env.BOT_USERNAME || "").trim().replace(/^@/, "");
  if (fromEnv) return fromEnv;
  if (cachedBotUsername) return cachedBotUsername;

  try {
    const url = `https://api.telegram.org/bot${botToken}/getMe`;
    const resp = await axios.get(url);
    const username = resp?.data?.result?.username
      ? String(resp.data.result.username)
      : "";
    cachedBotUsername = username;
    return username;
  } catch {
    return "";
  }
}

function buildProductStartParam(productId) {
  return `product__${String(productId)}`;
}

function buildMiniAppLink(botUsername, startParam) {
  const safeUsername = String(botUsername || "").replace(/^@/, "").trim();
  if (!safeUsername) return null;
  return `https://t.me/${safeUsername}?startapp=${encodeURIComponent(String(startParam || ""))}`;
}

function buildProfileFieldsFromTelegramUser(user) {
  if (!user || typeof user !== "object") return { username: "", nickname: "" };
  const username = user?.username ? String(user.username).trim() : "";
  const first = user?.first_name ? String(user.first_name).trim() : "";
  const last = user?.last_name ? String(user.last_name).trim() : "";
  const nickname = `${first} ${last}`.trim();
  return { username, nickname };
}

function getInitDataFromRequest(req) {
  const header = req?.headers?.["x-telegram-init-data"];
  if (typeof header === "string" && header.trim()) return header;
  return "";
}

function telegramAuthFromRequest(req, options = {}) {
  const botToken = process.env.BOT_TOKEN;
  const initData = getInitDataFromRequest(req);
  const maxAgeSeconds = Number(options.maxAgeSeconds || process.env.TG_INITDATA_MAX_AGE_SECONDS || 300);
  
  const auth = validateTelegramInitData(initData, botToken, { maxAgeSeconds });

  if (!auth.ok) {
    return {
      ok: false,
      status: 401,
      error: auth.error || "initData невалиден",
    };
  }

  const user = auth.user || null;
  const telegramId = user?.id ? String(user.id) : "";
  if (!telegramId) {
    return {
      ok: false,
      status: 400,
      error: "Некорректные данные пользователя Telegram",
    };
  }

  return { ok: true, telegramId, user, initData };
}

module.exports = {
  getBotUsername,
  buildProductStartParam,
  buildMiniAppLink,
  buildProfileFieldsFromTelegramUser,
  getInitDataFromRequest,
  telegramAuthFromRequest,
  validateTelegramInitData,
  parseInitData,
};
