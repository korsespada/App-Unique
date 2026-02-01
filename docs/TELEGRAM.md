# Настройка Telegram Bot и Mini App

## 1. Создание бота

1. Открой [@BotFather](https://t.me/BotFather) в Telegram
2. Отправь `/newbot`
3. Следуй инструкциям, задай имя и username
4. Скопируй **Bot Token** в `.env` как `BOT_TOKEN`

## 2. Настройка Mini App

### Через BotFather

1. Отправь `/mybots` → выбери своего бота
2. **Bot Settings** → **Menu Button** → **Configure menu button**
3. Введи:
   - **URL**: `https://app-unique.vercel.app` (или ngrok URL для теста)
   - **Title**: `Открыть магазин`

### Альтернатива — Web App Button

```
/setmenubutton
```

Затем отправь JSON:
```json
{
  "type": "web_app",
  "text": "Магазин",
  "web_app": {
    "url": "https://app-unique.vercel.app"
  }
}
```

## 3. Локальная разработка с ngrok

Mini App требует HTTPS. Для локального теста используй ngrok:

```bash
# Установка (если нет)
npm install -g ngrok

# Запуск туннеля на порт 5173 (Vite dev server)
ngrok http 5173
```

Скопируй HTTPS URL (напр. `https://abc123.ngrok.io`) и вставь в BotFather.

## 4. Переменные окружения

| Переменная | Описание | Пример |
|------------|----------|--------|
| `BOT_TOKEN` | Токен бота от BotFather | `123456:ABC-DEF...` |
| `MANAGER_CHAT_ID` | Chat ID для уведомлений о заказах | `-1001234567890` |
| `VITE_API_URL` | URL бэкенда | `https://api.example.com` |

### Как узнать MANAGER_CHAT_ID

1. Добавь бота в группу менеджеров
2. Отправь любое сообщение в группу
3. Открой: `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
4. Найди `"chat": { "id": -1001234567890 }` — это твой ID

## 5. Отладка

### Telegram Web App Inspector

В мобильном Telegram:
1. Зайди в **Настройки** → **Расширенные** → **Экспериментальные**
2. Включи **Web App Debug**
3. При открытии Mini App появится кнопка "Inspect"

### Desktop Telegram

Используй Telegram Desktop — там можно открыть DevTools через правый клик → Inspect.

## 6. HMAC Валидация

Каждый запрос от Mini App содержит `initData`. Бэкенд проверяет его подпись:

```
Header: X-Telegram-Init-Data: query_id=...&user=...&hash=...
```

Валидация происходит в `backend/src/telegramWebAppAuth.js` через HMAC-SHA256.

**Важно:** Без валидного `BOT_TOKEN` в `.env` все защищенные эндпоинты вернут 401.

## 7. Чеклист перед деплоем

- [ ] `BOT_TOKEN` установлен в Vercel Environment Variables
- [ ] `MANAGER_CHAT_ID` указывает на правильную группу
- [ ] Menu Button настроен на продакшн URL
- [ ] HTTPS работает (Vercel автоматически)
