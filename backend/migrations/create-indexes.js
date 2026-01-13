const PocketBase = require("pocketbase/cjs");
const path = require("path");
const fs = require("fs");

const pbUrl = process.env.PB_URL;
const pbAdminEmail = process.env.PB_ADMIN_EMAIL;
const pbAdminPassword = process.env.PB_ADMIN_PASSWORD;

if (!pbUrl || !pbAdminEmail || !pbAdminPassword) {
  console.error("Missing required environment variables:");
  console.error("  PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD");
  console.error("\nSet them in .env or export before running this script.");
  process.exit(1);
}

async function createIndexes() {
  const pb = new PocketBase(pbUrl);

  try {
    await pb.admins.authWithPassword(pbAdminEmail, pbAdminPassword);
    console.log("Authenticated as admin");

    // Оптимальный набор индексов (без избыточных)
    const sqlStatements = [
      // Brands & Categories
      "CREATE INDEX IF NOT EXISTS idx_brands_name ON brands(name);",
      "CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);",
      
      // Profiles (UNIQUE)
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_telegramid ON profiles(telegramid);",
      
      // Products - составные индексы (покрывают простые)
      "CREATE INDEX IF NOT EXISTS idx_products_status_updated ON products(status, updated);",
      "CREATE INDEX IF NOT EXISTS idx_products_status_name ON products(status, name);",
      "CREATE INDEX IF NOT EXISTS idx_products_brand_status_updated ON products(brand, status, updated);",
      "CREATE INDEX IF NOT EXISTS idx_products_category_status_updated ON products(category, status, updated);",
    ];

    for (const sql of sqlStatements) {
      try {
        await pb.send("/api/collections/_executeSQL", {
          method: "POST",
          body: { sql },
        });
        console.log("✓", sql);
      } catch (err) {
        console.error("✗", sql, err.message);
      }
    }

    console.log("Indexes created successfully!");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

createIndexes();
