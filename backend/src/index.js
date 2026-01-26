// Load environment variables first
require("dotenv").config({ path: ".env" });

const http = require("http");
const app = require("./app");
const { loadProductIdsOnly, listActiveProducts } = require("./pocketbaseClient");
const { shuffleDeterministic, mixByCategoryRoundRobin } = require("./utils/helpers");
const cacheManager = require("./cacheManager");

// Check for required environment variables
const checkEnvVars = () => {
  const envVars = {
    BOT_TOKEN: { required: false, message: "Bot token is missing" },
    PB_URL: { required: false, message: "PB_URL is missing" },
  };

  Object.entries(envVars).forEach(([key, { required, message }]) => {
    if (!process.env[key]) {
      if (required) console.error(`❌ Missing: ${key}`);
      else console.warn(`⚠️  ${message} (${key})`);
    }
  });

  return {
    isBotEnabled: !!process.env.BOT_TOKEN && !!process.env.MANAGER_CHAT_ID,
    isGoogleSheetsEnabled: !!String(process.env.PB_URL || "").trim(),
  };
};

checkEnvVars();

const PORT = process.env.PORT || 3000;

// Helper to find available port
function getAvailablePort(desiredPort) {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(desiredPort, "0.0.0.0");
    server.on("listening", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") getAvailablePort(0).then(resolve);
      else reject(err);
    });
  });
}

async function getCachedActiveProducts() {
  const cacheKey = "pb:active-products";
  // We use the same cache manager as app.js
  const cached = cacheManager.get("products", cacheKey);
  if (cached) return cached;

  try {
    const products = await listActiveProducts();
    cacheManager.set("products", cacheKey, products);
    return products;
  } catch (err) {
    console.warn("PocketBase unavailable for preload");
    return [];
  }
}

async function loadData() {
  console.log("Loading initial data...");
  await getCachedActiveProducts();
  console.log("Initial data loaded");
}

async function startServer() {
  const port = await getAvailablePort(PORT);

  // Preload order cache logic
  console.log("Preloading order cache...");
  try {
    const idRecords = await loadProductIdsOnly(2000, null);
    const shuffled = shuffleDeterministic(idRecords, "");
    const mixed = mixByCategoryRoundRobin(shuffled, "");
    const orderedIds = mixed.map((p) => p.id);

    // We access the global/singleton cacheManager
    // Note: In original code it accessed shuffleOrderCache directly or via cacheManager?
    // In app.js we use cacheManager.get("shuffle", ...)
    // So here we should use cacheManager.set("shuffle", ...)
    cacheManager.set("shuffle", "order:home:default", orderedIds);

    console.log(`Preloaded ${orderedIds.length} identifiers to cache`);
  } catch (err) {
    console.warn("Failed to preload order cache:", err.message);
  }

  const server = http.createServer(app);

  server.listen(port, () => {
    console.log(`\n=== Server is running ===`);
    console.log(`Local:   http://localhost:${port}`);
    console.log(`API:     http://localhost:${port}/api/health`);
    console.log(`Health:  http://localhost:${port}/health\n`);
  });

  server.on("error", (error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}

loadData()
  .then(startServer)
  .catch((err) => {
    console.error("Startup failed:", err);
    startServer();
  });
