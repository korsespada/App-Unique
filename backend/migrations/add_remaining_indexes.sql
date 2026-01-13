-- Индексы для оптимизации PocketBase
-- Выполни в PocketBase Admin UI или через CLI

-- Индексы для связываемых коллекций (составные)
CREATE INDEX IF NOT EXISTS idx_brands_name_id ON brands(name, id);
CREATE INDEX IF NOT EXISTS idx_categories_name_id ON categories(name, id);

-- Индексы для внешних ключей в products
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- НОВЫЕ: Индексы для часто используемых полей
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_telegramid ON profiles(telegramid);

-- Составные индексы для фильтрации по статусу + relation
CREATE INDEX IF NOT EXISTS idx_products_status_brand ON products(status, brand);
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);
CREATE INDEX IF NOT EXISTS idx_products_status_updated ON products(status, updated DESC);

-- Проверка индексов
-- SELECT name FROM sqlite_master WHERE type='index' AND tbl_name IN ('products', 'brands', 'categories', 'profiles');
