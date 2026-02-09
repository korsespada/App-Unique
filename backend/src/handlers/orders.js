/**
 * Order handling logic
 */
const axios = require("axios");
const cacheManager = require("../cacheManager");
const {
  createOrder,
  getOrdersByTelegramId,
} = require("../pocketbaseClient");
const {
  telegramAuthFromRequest,
  parseInitData,
  validateTelegramInitData,
} = require("../utils/telegram");
const { escapeHtml, splitTelegramMessage } = require("../utils/helpers");

async function handleGetOrders(req, res) {
  const auth = telegramAuthFromRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const orders = await getOrdersByTelegramId(auth.telegramId);

  // Format for frontend
  const formatted = orders.map(o => ({
    id: o.id,
    created: o.created,
    status: o.status || "new",
    total_price: o.total_price || 0,
    items: o.items || [],
    order_number: o.order_number || o.id.slice(0, 8).toUpperCase(),
  }));

  return res.json({ ok: true, orders: formatted });
}

async function handleOrderSubmission(req, res) {
  const botToken = process.env.BOT_TOKEN;
  const managerChatId = process.env.MANAGER_CHAT_ID;

  if (!botToken || !managerChatId) {
    return res.status(500).json({ error: "Бот не сконфигурирован" });
  }

  const { initData, items, comment } = req.body;
  const safeCommentRaw = typeof comment === "string" ? comment.trim() : "";
  const safeComment = safeCommentRaw.slice(0, 1000);

  // Anti-replay protection - based on user + cart content hash
  // This prevents double-click submissions but allows multiple different orders
  let telegramUserIdForReplay = "";
  try {
    const parsed = parseInitData(initData);
    telegramUserIdForReplay = String(parsed.user?.id || "").trim();
  } catch {
    telegramUserIdForReplay = "";
  }

  // Create a unique order fingerprint from cart items
  const orderFingerprint = items
    .map((it) => `${it.id}:${it.quantity}`)
    .sort()
    .join("|");

  const replayKey = telegramUserIdForReplay && orderFingerprint
    ? `order:${telegramUserIdForReplay}:${orderFingerprint}`
    : "";

  if (replayKey) {
    if (cacheManager.get("antiReplay", replayKey)) {
      return res.status(409).json({
        error: "Повторная отправка заказа. Обновите приложение и попробуйте снова.",
      });
    }
  }

  const maxAgeSeconds = Number(
    process.env.TG_ORDER_INITDATA_MAX_AGE_SECONDS ||
    process.env.TG_INITDATA_MAX_AGE_SECONDS ||
    300
  );

  const auth = validateTelegramInitData(initData, botToken, { maxAgeSeconds });
  if (!auth.ok) {
    console.warn("initData validation failed", {
      error: auth.error,
      debug: auth.debug,
      initDataLen: String(initData ?? "").length,
      hasHashParam: String(initData ?? "").includes("hash="),
      hasSignatureParam: String(initData ?? "").includes("signature="),
    });
    return res.status(401).json({ error: auth.error || "initData невалиден" });
  }

  // Mark order as submitted (anti-replay)
  if (replayKey) {
    cacheManager.set("antiReplay", replayKey, true);
  }

  const user = auth.user || null;
  const telegramUserId = user?.id ? String(user.id) : "";
  const username = user?.username ? String(user.username) : "";
  const firstname = user?.first_name ? String(user.first_name) : "";
  const lastname = user?.last_name ? String(user.last_name) : "";

  if (!telegramUserId) {
    return res.status(400).json({ error: "Некорректные данные пользователя Telegram" });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Некорректные данные заказа" });
  }

  const normalizedItems = items
    .map((it) => {
      const id = String(it?.id ?? "").trim().slice(0, 80);
      const title = String(it?.title ?? "").trim().slice(0, 120);
      const quantity = Math.min(99, Math.max(1, Number(it?.quantity) || 1));
      const hasPrice = it?.hasPrice === false ? false : true;
      const price = hasPrice ? Number(it?.price) : NaN;

      return { id, title, quantity, hasPrice, price: hasPrice ? price : null };
    })
    .filter((it) => it.id && it.title);

  if (normalizedItems.length === 0) {
    return res.status(400).json({ error: "Некорректные данные заказа" });
  }

  const total = normalizedItems.reduce((sum, it) => {
    const qty = Number(it?.quantity) || 1;
    const hasPrice = it?.hasPrice !== false;
    const price = Number(it?.price);
    if (!hasPrice || !Number.isFinite(price) || price <= 0) return sum;
    return sum + price * qty;
  }, 0);

  const safeFirst = escapeHtml((firstname || "").trim());
  const safeLast = escapeHtml((lastname || "").trim());
  const safeUsername = escapeHtml((username || "").trim());
  const safeTelegramId = escapeHtml(String(telegramUserId));

  // --- SAVE TO POCKETBASE ---
  let orderRecord = null;
  try {
    orderRecord = await createOrder({
      telegram_id: telegramUserId,
      items: normalizedItems,
      total_price: total,
      status: "new",
      comment: safeComment,
      user_data: {
        username: safeUsername,
        first_name: safeFirst,
        last_name: safeLast,
      },
      order_number: Date.now().toString().slice(-8), // Simple random ref
    });
  } catch (err) {
    console.error("Failed to save order to PocketBase", err);
    // We continue anyway to send Telegram notification, but warn manager?
  }

  const orderText = [
    "🆕 Новый заказ из Telegram Mini App",
    "",
    `#${orderRecord?.order_number || "ORDER"}`,
    "",
    `👤 Клиент: ${`${safeFirst} ${safeLast}`.trim()}`.trim(),
    safeUsername ? `@${safeUsername}` : "username: отсутствует",
    `Telegram ID: <code>${safeTelegramId}</code>`,
    safeComment ? `Комментарий: ${escapeHtml(safeComment)}` : "",
    "",
    "🛒 Товары:",
  ]
    .filter(Boolean)
    .concat(
      normalizedItems.map((it, idx) => {
        const qty = Number(it?.quantity) || 1;
        const hasPrice = it?.hasPrice !== false;
        const price = Number(it?.price);
        const titleText = escapeHtml(String(it?.title || "").trim() || "Без названия");
        const id = escapeHtml(String(it?.id || "").trim() || "-");

        if (!hasPrice || !Number.isFinite(price) || price <= 0) {
          return `${idx + 1}. ${titleText} (id: <code>${id}</code>) — ${qty} шт — Цена по запросу`;
        }

        const lineTotal = price * qty;
        return `${idx + 1}. ${titleText} (id: <code>${id}</code>) — ${qty} шт × ${price} ₽ = ${lineTotal} ₽`;
      })
    )
    .concat([
      "",
      total > 0 ? `💰 Итого: ${escapeHtml(String(total))} ₽` : "💰 Итого: Цена по запросу",
      "",
      "Доп. данные (адрес, телефон) пока не заполняются в мини-приложении.",
    ])
    .join("\n");

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const messages = splitTelegramMessage(orderText, 3500);
  for (let i = 0; i < messages.length; i += 1) {
    const part = messages[i];
    await axios.post(url, {
      chat_id: managerChatId,
      text: part,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  console.log("Заказ отправлен менеджеру", {
    telegramUserId,
    itemsCount: normalizedItems.length,
    orderId: orderRecord?.id
  });

  return res.json({ ok: true, orderId: orderRecord?.id || Date.now().toString() });
}

module.exports = { handleOrderSubmission, handleGetOrders };
