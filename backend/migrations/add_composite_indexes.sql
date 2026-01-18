-- Critical composite indexes for filtering products by brand AND category
-- These indexes will prevent timeout when filtering by multiple criteria

-- Composite index for status + brand + category (most specific)
CREATE INDEX IF NOT EXISTS `idx_products_status_brand_category` 
ON `products` (`status`, `brand`, `category`);

-- Composite index for status + brand (for brand-only filters)
CREATE INDEX IF NOT EXISTS `idx_products_status_brand` 
ON `products` (`status`, `brand`);

-- Composite index for status + category (for category-only filters)
CREATE INDEX IF NOT EXISTS `idx_products_status_category` 
ON `products` (`status`, `category`);

-- Note: These indexes will dramatically speed up queries like:
-- status = "active" && brand = "xxx" && category = "yyy"
-- Without these indexes, PocketBase does a full table scan which causes timeouts
