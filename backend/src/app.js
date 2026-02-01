const path = require("path");
const { promises: fs } = require("fs");

// Set the correct path for .env file
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const express = require("express");
const cors = require("cors");

// Import Routes
const apiRoutes = require("./routes/api");
const profileRoutes = require("./routes/profile");
const orderRoutes = require("./routes/order");
const { apiLimiter, heavyLimiter } = require("./middleware/rateLimiter");

const { getProductById } = require("./controllers/productController");
const { asyncRoute, extractAxiosStatus, extractAxiosMessage } = require("./utils/apiHelpers");

const app = express();

// Cache Dir setup
const CACHE_DIR = path.join(__dirname, "..", ".cache");
async function ensureCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (err) {
        console.warn("Failed to create cache directory:", err.message);
    }
}
ensureCacheDir();

// Middleware
const corsAllowList = String(
    process.env.CORS_ALLOW_ORIGINS || process.env.ALLOWED_ORIGINS || ""
)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            if (!origin) return callback(null, true);
            if (corsAllowList.length === 0) return callback(null, true);
            const ok = corsAllowList.includes(origin);
            return callback(ok ? null : new Error("Not allowed by CORS"), ok);
        },
    })
);
app.use(express.json());

// Routes Mounting with versioning support
const apiPrefixes = ["/api", "/api/:version/:shop", "/:version/:shop"];

// Rate limiting for heavy endpoints
app.use("/api/catalog-filters", heavyLimiter);
app.use("/api/external-products", apiLimiter);

// Catalog & Products
app.use([...apiPrefixes, ""], apiRoutes);

// Profile
app.use(["/api/profile", "/api/:version/:shop/profile", "/profile", "/:version/:shop/profile"], profileRoutes);

// Orders
app.use(["/api/orders", "/api/:version/:shop/orders", "/orders", "/:version/:shop/orders"], orderRoutes);

// Compatibility aliases (root level)
app.get("/products/:id", asyncRoute(getProductById));

// Health check
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
    try {
        const status = extractAxiosStatus(err);
        const message = extractAxiosMessage(err);

        console.error("Unhandled API error", {
            path: req?.path,
            method: req?.method,
            upstreamStatus: status,
            message,
        });

        if (!res.headersSent) {
            if (status === 401 || status === 403) {
                return res
                    .status(502)
                    .json({ error: "Upstream authorization failed", message });
            }
            if (status && status >= 400 && status < 600) {
                return res.status(502).json({
                    error: "Upstream request failed",
                    message,
                    upstreamStatus: status,
                });
            }
            return res.status(500).json({ error: "Internal server error", message });
        }
    } catch (e) {
        // fallthrough
    }

    return next(err);
});

module.exports = app;
