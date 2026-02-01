# YeezyUnique — Telegram Mini App

E-commerce приложение для Telegram с полноценным фронтендом (React + Vite) и бэкендом (Express + PocketBase).

## 🚀 Быстрый старт

### Требования
- Node.js >= 14.0.0
- PocketBase instance (см. `docs/DATABASE.md`)
- Telegram Bot Token (см. `docs/TELEGRAM.md`)

### 1. Установка зависимостей

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Настройка окружения

Создай `.env` файл в папке `backend/`:

```env
# backend/.env
BOT_TOKEN=your_telegram_bot_token
MANAGER_CHAT_ID=your_manager_chat_id
PB_URL=https://your-pocketbase.example.com
PB_TOKEN=your_pocketbase_token
```

Для фронтенда создай `.env` в папке `frontend/`:

```env
# frontend/.env
VITE_API_URL=http://localhost:3000
```

### 3. Запуск в режиме разработки

```bash
# Терминал 1 — Backend (порт 3000)
cd backend
npm run dev

# Терминал 2 — Frontend (порт 5173)
cd frontend
npm run dev
```

Откройте `http://localhost:5173` в браузере.

### 4. Продакшн сборка

```bash
cd frontend
npm run build
```

Файлы появятся в `frontend/dist/`.

## 📂 Структура проекта

| Папка | Описание |
|-------|----------|
| `backend/` | Express API сервер |
| `frontend/` | React SPA (Vite) |
| `tools/` | Утилиты и скрипты |

## 📄 Документация

- [`Project-Overview.md`](./docs/Project-Overview.md) — Архитектура и детали реализации
- [`GEMINI.md`](./docs/GEMINI.md) — Инструкции для AI-ассистента
- [`DATABASE.md`](./docs/DATABASE.md) — Схема базы данных PocketBase
- [`TELEGRAM.md`](./docs/TELEGRAM.md) — Настройка Telegram бота и Mini App
- [`SECURITY.md`](./docs/SECURITY.md) — Безопасность и ротация токенов
- [`TODO.md`](./docs/TODO.md) — Список задач

## 🛠️ Технологии

**Frontend:** React 18, TypeScript, Vite, TanStack Query, Ant Design, Lucide Icons  
**Backend:** Node.js, Express, NodeCache  
**Database:** PocketBase  
**Deploy:** Vercel (Serverless + ISR)

## 📜 Лицензия

Private — All rights reserved.
