# Database Migrations

## Применение индексов

### Вариант 1: Через Node.js скрипт (рекомендуется)

```bash
cd backend/migrations
node create-indexes.js
```

**Требуется настроить переменные окружения:**
```bash
PB_URL=http://your-pocketbase-url:8090
PB_ADMIN_EMAIL=admin@example.com
PB_ADMIN_PASSWORD=your-admin-password
```

### Вариант 2: Вручную через PocketBase Admin UI

1. Откройте PocketBase Admin UI: `http://your-pocketbase-url:8090/_/`
2. Войдите как администратор
3. Перейдите в Settings → Database
4. Скопируйте и выполните SQL из файла `add_remaining_indexes.sql`

### Проверка индексов

После применения проверьте, что индексы созданы:

```sql
SELECT name, tbl_name 
FROM sqlite_master 
WHERE type='index' 
AND tbl_name IN ('products', 'brands', 'categories', 'profiles')
ORDER BY tbl_name, name;
```

Должны быть созданы:
- ✅ idx_brands_name
- ✅ idx_categories_name
- ✅ idx_profiles_telegramid (UNIQUE)
- ✅ idx_products_status_updated
- ✅ idx_products_status_name
- ✅ idx_products_brand_status_updated
- ✅ idx_products_category_status_updated

## Влияние на производительность

### До индексов:
```sql
-- Запрос без индекса (медленно)
SELECT * FROM products WHERE status = 'active';
-- Full table scan: ~500ms на 10k записей
```

### После индексов:
```sql
-- Запрос с индексом (быстро)
SELECT * FROM products WHERE status = 'active';
-- Index scan: ~5ms на 10k записей
```

**Ускорение: ~100x**

## Откат (если нужно)

```sql
DROP INDEX IF EXISTS idx_brands_name;
DROP INDEX IF EXISTS idx_categories_name;
DROP INDEX IF EXISTS idx_profiles_telegramid;
DROP INDEX IF EXISTS idx_products_status_updated;
DROP INDEX IF EXISTS idx_products_status_name;
DROP INDEX IF EXISTS idx_products_brand_status_updated;
DROP INDEX IF EXISTS idx_products_category_status_updated;
```

## Почему эти индексы оптимальны?

### Составные индексы покрывают простые:
```sql
-- Индекс: (brand, status, updated)
✅ WHERE brand = 'Nike'                          -- использует индекс
✅ WHERE brand = 'Nike' AND status = 'active'    -- использует индекс
✅ WHERE brand = 'Nike' AND status = 'active' ORDER BY updated -- использует индекс

-- Поэтому НЕ нужны отдельные индексы:
❌ (brand)           -- покрывается (brand, status, updated)
❌ (brand, status)   -- покрывается (brand, status, updated)
```

### Избыточные индексы удалены:
- ❌ `idx_products_id` — уже есть PRIMARY KEY
- ❌ `idx_products_brand` — покрывается `idx_products_brand_status_updated`
- ❌ `idx_products_category` — покрывается `idx_products_category_status_updated`
- ❌ `idx_products_status` — покрывается `idx_products_status_updated`
- ❌ `idx_brands_name_id` — достаточно `idx_brands_name`
- ❌ `idx_categories_name_id` — достаточно `idx_categories_name`
