const PocketBase = require("pocketbase/cjs");
const path = require("path");
const fs = require("fs");

const pbUrl = process.env.PB_URL || "http://144.31.116.66:8090";
const pbAdminEmail = process.env.PB_ADMIN_EMAIL || "admin@example.com";
const pbAdminPassword = process.env.PB_ADMIN_PASSWORD || "password";

async function createIndexes() {
  const pb = new PocketBase(pbUrl);

  try {
    await pb.admins.authWithPassword(pbAdminEmail, pbAdminPassword);
    console.log("Authenticated as admin");

    const sqlStatements = [
      "CREATE INDEX IF NOT EXISTS idx_brands_name_id ON brands(name, id);",
      "CREATE INDEX IF NOT EXISTS idx_categories_name_id ON categories(name, id);",
      "CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);",
      "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);",
      "CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);",
      "CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated);",
      "CREATE INDEX IF NOT EXISTS idx_profiles_telegramid ON profiles(telegramid);",
      "CREATE INDEX IF NOT EXISTS idx_products_status_brand ON products(status, brand);",
      "CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);",
      "CREATE INDEX IF NOT EXISTS idx_products_status_updated ON products(status, updated);",
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
