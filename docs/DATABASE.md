# Схема базы данных PocketBase

## Подключение

```
URL: ${PB_URL}
Auth: Service Token (${PB_TOKEN})
```

---

## Коллекции

### `products` — Каталог товаров

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Уникальный ID PocketBase |
| `productId` | string | Внутренний ID товара (артикул) |
| `name` | string | Название товара |
| `brand` | string | ID или имя бренда |
| `category` | string | ID или имя категории |
| `subcategories` | string | Подкатегории |
| `price` | number | Цена |
| `description` | text | Описание |
| `photos` | json (array) | Массив ссылок на VK Bucket |
| `photos_processed` | json (array) | Массив обработанных ссылок на VK Bucket |
| `thumb` | string (url) | Ссылка на превью (VK Bucket) |
| `status` | string | Статус: `active`, `draft`, `archived` |
| `created` | datetime | Дата создания |
| `updated` | datetime | Дата изменения |

**Индексы:**
- `status` + `updated` (сортировка по новизне)
- `status` + `name` (поиск по алфавиту)
- `status` + `brand` + `category` (фильтрация по каталогу)
- `status` + `brand`
- `status` + `category`

---

### `profiles` — Профили пользователей

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID записи |
| `telegramid` | string | Telegram User ID |
| `username` | string | Telegram @username |
| `nickname` | string | Имя пользователя |
| `phone` | string | Номер телефона |
| `adress` | text | Адрес доставки |
| `notes` | text | Заметки/комментарии |
| `created` | datetime | Дата регистрации |
| `updated` | datetime | Дата изменения |

---

### `categories` — Категории

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID категории |
| `name` | string | Название |
| `description` | text | Описание |
| `created` | datetime | Дата создания |
| `updated` | datetime | Дата изменения |

**Индексы:**
- `name`

---

### `brands` — Бренды

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID бренда |
| `name` | string | Название |
| `description` | text | Описание |
| `created` | datetime | Дата создания |
| `updated` | datetime | Дата изменения |

**Индексы:**
- `name`

---

### `subcategories` — Подкатегории

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID подкатегории |
| `name` | string | Название |
| `category` | string | Relation к коллекции categories |
| `created` | datetime | Дата создания |
| `updated` | datetime | Дата изменения |

---

## Примеры запросов

### Получить все товары бренда

```javascript
const products = await pb.collection('products').getList(1, 50, {
  filter: 'brand = "Balenciaga" && status = "active"',
  sort: '-created'
});
```

### Найти или создать профиль

```javascript
const profile = await pb.collection('profiles').getFirstListItem(
  `telegramid = "${telegramId}"`
).catch(() => null);

if (!profile) {
  await pb.collection('profiles').create({
    telegramid: telegramId,
    username: 'user_handle',
    nickname: 'User Name'
  });
}
```

---

## Миграции

При изменении схемы:
1. Обнови эту документацию
2. Синхронизируй типы в `frontend/src/types.ts`
3. Проверь контроллеры в `backend/src/controllers/`

---

## Кэширование (CacheManager)

Для снижения нагрузки на PocketBase используется `backend/src/cacheManager.js`.

| Кэш | TTL (стандарт) | Назначение |
|-----|----------------|------------|
| `products` | 5 мин | Данные продуктов |
| `profiles` | 1 мин | Сведения о пользователях |
| `relations` | 6 часов | Привязки брендов и категорий |
| `antiReplay`| 10 мин | Защита от повторных заказов |
| `pages` | 3 мин | Отдельные страницы каталога |
| `shuffle` | 15 мин | Порядок товаров при перемешивании |
| `pbSnapshot`| 5 мин | Снапшоты данных PocketBase |

### Мониторинг кэша:
- `GET /health` — Статус сервера и статистика попаданий в кэш (hit rate).

