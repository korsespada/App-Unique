# Telegram Mini App YeezyUnique — Обзор проекта

## 1. Общее описание
Проект представляет собой Telegram Mini App с полноценной full-stack архитектурой.
- **Frontend**: Single Page Application на React 18, TypeScript и Vite.
- **Backend**: Node.js Express сервер с модульной архитектурой контроллер-роутер.
- **Деплой**: Оптимизирован для Vercel (serverless) с поддержкой ISR через cache-заголовки.
- **База данных**: PocketBase для управления товарами и профилями пользователей.

## 2. Структура проекта
```
/
├── backend/                  # Node.js Express Backend
│   ├── src/
│   │   ├── app.js            # Фабрика приложения (Express instance)
│   │   ├── index.js          # Точка входа локального сервера + preloader кэша
│   │   ├── pocketbaseClient.js # Слой интеграции с PocketBase
│   │   ├── cacheManager.js   # Централизованный NodeCache (products, relations, profiles)
│   │   ├── controllers/      # Бизнес-логика (CatalogFilters, ProductList)
│   │   ├── routes/           # API роутеры (модульное монтирование)
│   │   ├── handlers/         # Обработчики запросов (Profile, Orders)
│   │   ├── middleware/       # Middleware (rateLimiter)
│   │   ├── utils/            # Утилиты (Telegram auth, API helpers)
│   │   └── telegramWebAppAuth.js # Низкоуровневая HMAC-валидация Telegram
│   ├── api/
│   │   └── index.js          # Точка входа Vercel Serverless (импорт src/app.js)
│   ├── package.json
│   └── vercel.json           # Конфигурация serverless бэкенда
├── frontend/                 # React Vite Frontend
│   ├── src/
│   │   ├── App.tsx           # Главный компонент (state-based навигация)
│   │   ├── components/       # UI компоненты (TopNav, BottomNav, Skeletons)
│   │   ├── hooks/            # Кастомные хуки (Cart, Favorites, Navigation, Gallery)
│   │   ├── views/            # Экраны (Home, ProductDetail, Cart, Favorites)
│   │   ├── utils/            # Вспомогательные функции (analytics, images)
│   │   ├── framework/        # Конфигурация API (Axios interceptors для TG Auth)
│   │   ├── types.ts          # Централизованные TypeScript типы
│   │   └── main.tsx          # Точка входа React с Analytics
│   ├── package.json
│   ├── tsconfig.json         # Алиасы (@framework, @style)
│   └── vite.config.ts
├── vercel.json              # Корневой конфиг Vercel (статика, rewrites, headers)
└── package.json             # Корневой package.json
```

## 3. Детали Frontend
- **Сборщик**: Vite 4
- **Стек**: React 18, TypeScript, Lucide Icons
- **Навигация**: Интеллектуальная state-based навигация (`useNavigation`) с синхронизацией Browser History API и Telegram BackButton.
- **Ключевые возможности**:
  - **Каталог**: Бесконечная прокрутка с детерминированным перемешиванием и round-robin миксованием брендов.
  - **Галерея товара**: Продвинутый prefetch в `useProductGallery` для плавного свайпа и crossfade переходов.
  - **Корзина и Избранное**: Унифицированное локальное состояние с серверной персистенцией в PocketBase.
  - **Синхронизация профиля**: Фоновая синхронизация состояния покупок с PocketBase через Telegram UID.
- **API коммуникация**: Централизована в `framework/api/utils/api-config.ts` с автоматической инъекцией заголовка `X-Telegram-Init-Data`.

## 4. Детали Backend
- **Архитектура**: Модульная система роутеров в `backend/src/app.js` с поддержкой нескольких форматов URL:
  - Стандартный: `/api/products`
  - Версионированный: `/api/:version/:shop/products`
  - Корневые алиасы: `/orders`, `/profile`
- **Эндпоинты**:
  - `GET /health`: Детальный отчёт о здоровье сервера включая статистику кэша.
  - `GET /api/catalog-filters`: Агрегированные уникальные бренды, категории и подкатегории. Подкатегории без активных товаров автоматически скрываются.
  - `GET /api/external-products`: Продвинутый каталог с поддержкой `seed`-рандомизации.
  - `POST /api/orders`: Защищённая отправка заказа с anti-replay защитой и Telegram уведомлением менеджерам. (Использует поле `telegramid` для связки с профилем).
  - `GET /api/orders`: Получение истории заказов авторизованного пользователя.
- **Управление кэшем**: Централизованный `cacheManager` с несколькими namespace и детальной инвалидацией.

## 5. Безопасность и Производительность
- **Валидация Telegram**: Каждый state-modifying запрос валидируется через HMAC-SHA256 в `telegramWebAppAuth.js`.
- **Anti-Replay**: Заказы используют fingerprint-based защиту от повторов с настраиваемым TTL.
- **Rate Limiting**: 
  - `/api/catalog-filters` — 10 req/min (heavyLimiter)
  - `/api/external-products` — 60 req/min (apiLimiter)
  - `/api/orders` — 30 req/5min
- **Connection Pooling**: `keepAlive: true` для переиспользования TCP-соединений.
- **ISR / Headers**: Vercel-оптимизированные `Cache-Control` заголовки для быстрых ответов.
- **DB Indexing (PocketBase)**: 
  - `products`: `idx_status_subcategory` на `(status, subcategory)`
  - `subcategories`: `idx_subcategories_category` на `(category)`

## 6. Переменные окружения (.env)

### backend/.env
- `BOT_TOKEN`: Telegram Bot API токен
- `MANAGER_CHAT_ID`: Chat ID для уведомлений о заказах
- `PB_URL`: Эндпоинт PocketBase
- `PB_TOKEN`: Административный/сервисный токен PocketBase

### frontend/.env
- `VITE_API_URL`: Публичный URL API для фронтенда
