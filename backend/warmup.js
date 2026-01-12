const axios = require("axios");

const WARMUP_URL = process.env.WARMUP_URL || "https://your-app.vercel.app";

async function warmup() {
  console.log("Warming up serverless functions...");

  try {
    await Promise.all([
      axios.get(`${WARMUP_URL}/api/external-products?page=1&perPage=1`, {
        timeout: 10000,
      }),
      axios.get(`${WARMUP_URL}/api/catalog-filters`, { timeout: 10000 }),
      axios.get(`${WARMUP_URL}/health`, { timeout: 5000 }),
    ]);
    console.log("Warmup completed successfully");
  } catch (err) {
    console.error("Warmup failed:", err.message);
    process.exit(1);
  }
}

warmup();
