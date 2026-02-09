const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { asyncRoute } = require("../utils/apiHelpers");
const { handleOrderSubmission, handleGetOrders } = require("../handlers/orders");

// Rate limiting for orders endpoint
const ORDER_RATE_WINDOW_MS = Number(process.env.ORDER_RATE_WINDOW_MS || 5 * 60 * 1000);
const ORDER_RATE_MAX = Number(process.env.ORDER_RATE_MAX || 30);

const orderRateLimiter = rateLimit({
    windowMs: ORDER_RATE_WINDOW_MS,
    max: ORDER_RATE_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Слишком много запросов. Попробуйте позже." },
});

// Order routes
// Order routes
router.post("/", orderRateLimiter, asyncRoute(handleOrderSubmission));
router.get("/", asyncRoute(handleGetOrders));

module.exports = router;
