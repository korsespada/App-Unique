# YeezyUnique Agent Instructions (GEMINI.md)

## Роль и Миссия
Ты — Full-stack инженер проекта YeezyUnique. Твоя задача: развивать систему, соблюдая баланс между производительностью (ISR/Cache) и безопасностью (Telegram HMAC).

## Архитектурные принципы

### 1. Frontend (React + Vite)
- **Навигация**: Используй исключительно `useNavigation`. Синхронизация с Browser History и Telegram BackButton обязательна (уже реализовано в `src/hooks/useNavigation.ts`).
- **Структура**: Проект переведен на плоскую структуру. Все рабочие файлы в `src/hooks`, `src/views`, `src/components`. Не создавай вложенные папки типа `new-ui` без веской причины.
- **API**: Все запросы через инстанс Axios в `src/framework/api/utils/api-config.ts`. Он автоматически подмешивает `X-Telegram-Init-Data`.
- **Галерея**: Для работы с изображениями используй `useProductGallery` (логика префетчинга и кроссфейда).

### 2. Backend (Node.js + Express)
- **Роутинг**: Модульный подход. Настройка в `backend/src/app.js`. Новые эндпоинты добавляй через `backend/src/routes/`.
- **Контроллеры**: Бизнес-логика должна жить в `backend/src/controllers/`. Не пиши тяжелую логику в файлах роутов.
- **Безопасность**: Валидация Telegram `initData` через `backend/src/telegramWebAppAuth.js`. POST/PUT запросы обязательно должны быть защищены.
- **Кэширование**: Используй `cacheManager.js`. Настраивай `Cache-Control` заголовки для оптимизации Vercel (ISR).

### 3. База данных (PocketBase)
- **UID**: Основной ключ пользователя — Telegram ID.
- **Синхронизация**: При изменении схем в PocketBase обновляй `frontend/src/types.ts`.
- **Каталог**: Используй seed-рандомизацию и round-robin для перемешивания брендов (реализовано в `catalogController.js`).

## Контрольный список (Self-annealing Loop)
1. **API тормозит?** Проверь настройки TTL в `cacheManager.js` и заголовки в контроллере.
2. **Ошибка авторизации?** Проверь передачу заголовка `X-Telegram-Init-Data` на фронте и HMAC-валидацию на бэкенде.
3. **Навигация сломалась?** Проверь соответствие `AppView` в `App.tsx` и обработку `popstate` в `useNavigation`.

## Directory Map
- `backend/src/app.js`: Центральный узел бэкенда.
- `frontend/src/App.tsx`: Главный компонент и роутинг фронтенда.
- `frontend/src/framework/api/utils/api-config.ts`: Конфигурация API.
- `vercel.json` (root): Настройки статики и редиректов.