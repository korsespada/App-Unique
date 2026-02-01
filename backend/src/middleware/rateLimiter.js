const rateLimit = require("express-rate-limit");

// Общий лимитер для API (60 req/min на IP)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Слишком много запросов" },
});

// Строгий лимитер для тяжёлых эндпоинтов (10 req/min на IP)
const heavyLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Слишком много запросов к фильтрам" },
});

module.exports = { apiLimiter, heavyLimiter };
