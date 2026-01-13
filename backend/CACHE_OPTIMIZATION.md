# Cache Optimization & Database Indexes

## Изменения

### 1. Централизованное управление кэшем

Создан модуль `backend/src/cacheManager.js` для управления всеми кэшами приложения.

#### Преимущества:
- ✅ Единая точка управления кэшами
- ✅ Стратегия инвалидации кэша
- ✅ Мониторинг и статистика
- ✅ Разные TTL для разных типов данных
- ✅ Автоматическая очистка устаревших данных

#### Типы кэшей:

| Кэш | TTL | Назначение |
|-----|-----|------------|
| `products` | 5 мин | Данные продуктов из PocketBase |
| `profiles` | 1 мин | Профили пользователей |
| `relations` | 6 часов | Маппинг ID брендов/категорий |
| `antiReplay` | 10 мин | Защита от повторных заказов |
| `pages` | 3 мин | Пагинированные данные |
| `shuffle` | 15 мин | Порядок перемешивания продуктов |
| `pbSnapshot` | 5 мин | Снапшоты данных PocketBase |

### 2. API для мониторинга кэша

#### GET `/health`
Проверка здоровья сервера + статистика кэша:
```json
{
  "status": "ok",
  "timestamp": "2026-01-13T...",
  "cache": {
    "healthy": true,
    "totalKeys": 42,
    "hitRate": "85.5%",
    "caches": 7
  }
}
```

#### GET `/api/cache/stats`
Детальная статистика кэша:
```json
{
  "hits": 1250,
  "misses": 180,
  "sets": 95,
  "deletes": 12,
  "hitRate": "87.41%",
  "cacheStats": {
    "products": {
      "keys": 15,
      "stats": { "hits": 850, "misses": 50, ... }
    },
    ...
  }
}
```

#### POST `/api/cache/invalidate`
Инвалидация кэша (требует авторизации в продакшене):
```json
{
  "type": "products" | "relations" | "all"
}
```

### 3. Методы инвалидации

```javascript
// Инвалидация всех продуктов
cacheManager.invalidateProducts();

// Инвалидация профиля пользователя
cacheManager.invalidateProfile(telegramId);

// Инвалидация по паттерну
cacheManager.invalidatePattern("products", "external-products:.*");

// Полная очистка
cacheManager.flushAll();
```

### 4. Добавлены индексы БД

Обновлены файлы:
- `backend/migrations/add_remaining_indexes.sql`
- `backend/migrations/create-indexes.js`

#### Оптимальный набор индексов:

```sql
-- Brands & Categories
CREATE INDEX idx_brands_name ON brands(name);
CREATE INDEX idx_categories_name ON categories(name);

-- Profiles (UNIQUE)
CREATE UNIQUE INDEX idx_profiles_telegramid ON profiles(telegramid);

-- Products (составные индексы)
CREATE INDEX idx_products_status_updated ON products(status, updated);
CREATE INDEX idx_products_status_name ON products(status, name);
CREATE INDEX idx_products_brand_status_updated ON products(brand, status, updated);
CREATE INDEX idx_products_category_status_updated ON products(category, status, updated);
```

#### Почему эти индексы оптимальны:

**Составные индексы работают слева направо:**
```sql
-- Индекс: (brand, status, updated)
✅ WHERE brand = 'Nike'                          -- использует
✅ WHERE brand = 'Nike' AND status = 'active'    -- использует
✅ WHERE brand = 'Nike' AND status = 'active' ORDER BY updated -- использует

-- Поэтому НЕ нужны:
❌ (brand)           -- покрывается составным
❌ (brand, status)   -- покрывается составным
```

**Удалены избыточные индексы:**
- `idx_products_id` — уже есть PRIMARY KEY
- `idx_products_brand` — покрывается `brand_status_updated`
- `idx_products_category` — покрывается `category_status_updated`
- `idx_products_status` — покрывается `status_updated`

#### Запуск миграции:

```bash
# Через Node.js скрипт
cd backend/migrations
node create-indexes.js

# Или вручную через PocketBase Admin UI
# Скопируйте SQL из add_remaining_indexes.sql
```

## Использование

### В коде:

```javascript
const cacheManager = require("./cacheManager");

// Получить из кэша
const data = cacheManager.get("products", "key");

// Сохранить в кэш
cacheManager.set("products", "key", data);

// Удалить из кэша
cacheManager.del("products", "key");

// Инвалидировать по паттерну
cacheManager.invalidatePattern("products", "external-products:.*");
```

### Мониторинг:

```bash
# Проверка здоровья
curl http://localhost:3000/health

# Статистика кэша
curl http://localhost:3000/api/cache/stats

# Инвалидация (добавьте auth в продакшене!)
curl -X POST http://localhost:3000/api/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"type": "products"}'
```

## Производительность

### До оптимизации:
- ❌ 7 отдельных NodeCache инстансов
- ❌ Нет стратегии инвалидации
- ❌ Нет мониторинга
- ❌ Медленные запросы без индексов

### После оптимизации:
- ✅ Централизованное управление
- ✅ Автоматическая инвалидация
- ✅ Мониторинг hit rate
- ✅ Быстрые запросы с индексами
- ✅ Снижение нагрузки на PocketBase

## Рекомендации для продакшена

1. **Добавить авторизацию** на `/api/cache/invalidate`
2. **Использовать Redis** вместо in-memory кэша для масштабирования
3. **Настроить алерты** на низкий hit rate (<70%)
4. **Логировать** операции инвалидации
5. **Запустить миграцию индексов** на продакшен БД

## Миграция с Redis (опционально)

Для горизонтального масштабирования замените NodeCache на Redis:

```bash
npm install redis
```

```javascript
// cacheManager.js
const redis = require('redis');
const client = redis.createClient();

// Адаптируйте методы для работы с Redis
```
