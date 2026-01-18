# Оптимизация загрузки каталога

## Проблема

Каждое формирование каталога создавало высокую нагрузку на PocketBase из-за:

1. **N+1 проблема с expand** - для каждого продукта делался отдельный запрос к коллекциям brands и categories
2. **Отсутствие композитных индексов** - запросы с фильтрацией по brand + category уходили в таймаут (60+ секунд)
3. **Короткое время кэширования** - фильтры перезагружались каждые 12 часов

## Критическая проблема: Таймауты при фильтрации

Когда пользователь выбирает **категорию И бренд одновременно**, запрос:
```sql
status = "active" && brand = "xxx" && category = "yyy"
```

Без композитного индекса PocketBase делает **полное сканирование таблицы**, что приводит к таймауту.

## Решения

### 1. Убрали expand и используем bulk-запросы

**Было:**
```javascript
// Один запрос с expand для каждого продукта = N+1 запросов
expand: "brand,category"
// PocketBase делал отдельный запрос для каждого brand_id и category_id
```

**Стало:**
```javascript
// 1. Загружаем только ID брендов и категорий (без expand)
fields: "id,brand,category"

// 2. Собираем уникальные ID
const brandIds = new Set();
const categoryIds = new Set();

// 3. Делаем 2 bulk-запроса вместо N+1
Promise.all([
  pb.get("/api/collections/brands/records", {
    filter: 'id="id1" || id="id2" || ...'
  }),
  pb.get("/api/collections/categories/records", {
    filter: 'id="id1" || id="id2" || ...'
  })
])
```

**Результат:** Вместо 1000+ запросов делаем всего 3 запроса (products + brands + categories)

### 2. Добавить композитные индексы (КРИТИЧНО!)

**Без этих индексов запросы с фильтрацией будут уходить в таймаут!**

Откройте PocketBase Admin UI и выполните SQL из `migrations/add_composite_indexes.sql`:

```sql
-- Для фильтрации по статусу + бренду + категории одновременно
CREATE INDEX `idx_products_status_brand_category` 
ON `products` (`status`, `brand`, `category`);

-- Для фильтрации по статусу + бренду
CREATE INDEX `idx_products_status_brand` 
ON `products` (`status`, `brand`);

-- Для фильтрации по статусу + категории
CREATE INDEX `idx_products_status_category` 
ON `products` (`status`, `category`);
```

**Как применить:**
1. Откройте PocketBase Admin: `http://your-vps:8090/_/`
2. Перейдите в **Settings → Database**
3. Скопируйте и выполните SQL выше
4. Нажмите **Execute**

Ваши существующие индексы:
```sql
CREATE INDEX `idx_products_status_updated` ON `products` (`status`,`updated`)
CREATE INDEX `idx_products_status_name` ON `products` (`status`,`name`)
CREATE INDEX `idx_brands_name` ON `brands`(`name`)
CREATE INDEX `idx_categories_name` ON `categories`(`name`)
```

Они полезны, но **не покрывают** запросы с фильтрацией по `brand` и `category` одновременно.

### 3. Увеличили время кэширования

- **Было:** 12 часов
- **Стало:** 24 часа

Фильтры каталога (список брендов и категорий) меняются редко, поэтому можно кэшировать дольше.

## Как применить оптимизации

### 1. Добавьте композитные индексы (ОБЯЗАТЕЛЬНО!)

Откройте PocketBase Admin и выполните SQL из `migrations/add_composite_indexes.sql`.

**Это критично!** Без этих индексов фильтрация по бренду + категории будет уходить в таймаут.

### 2. Перезапустите бэкенд

```bash
cd backend
npm restart
# или
pm2 restart backend
```

### 3. Очистите кэш (опционально)

Кэш обновится автоматически через 24 часа, но можно очистить вручную:

```bash
curl http://your-api/health
```

## Мониторинг

После применения оптимизаций проверьте:

1. **Нагрузку на CPU** - должна снизиться при запросах к каталогу
2. **Время ответа** - `/api/external-products` с фильтрами должен отвечать за 1-3 секунды вместо таймаута
3. **Логи PocketBase** - количество запросов должно уменьшиться

### Проверка индексов

В PocketBase Admin → Settings → Database выполните:

```sql
-- Проверить, что индексы созданы
SELECT name FROM sqlite_master 
WHERE type='index' AND tbl_name='products';
```

Должны быть:
- `idx_products_status_brand_category`
- `idx_products_status_brand`
- `idx_products_status_category`

### Тестирование

Попробуйте выбрать категорию и бренд одновременно в приложении. Запрос должен выполниться за 1-3 секунды вместо таймаута.

## Дополнительные рекомендации

1. **Используйте ISR endpoint** для статической генерации:
   ```
   GET /api/catalog-filters/isr
   ```

2. **Настройте CDN кэширование** для фронтенда

3. **Мониторьте кэш** через endpoint:
   ```
   GET /health
   ```
