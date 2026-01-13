# 🔒 Безопасность проекта

## ✅ Исправленные уязвимости

### 1. Слабая аутентификация Telegram (ИСПРАВЛЕНО)

#### Было:
```javascript
// ❌ Принимались 4 варианта подписи (downgrade attack)
const candidates = [
  { secret: 'v1', dcs: 'withSignature' },
  { secret: 'v1', dcs: 'withoutSignature' },
  { secret: 'v2', dcs: 'withSignature' },
  { secret: 'v2', dcs: 'withoutSignature' },
];

// ❌ maxAgeSeconds = 86400 (24 часа)
```

#### Стало:
```javascript
// ✅ Только актуальная версия v2 без signature
const secretKey = crypto.createHmac('sha256', botTokenStr)
  .update('WebAppData').digest();
const calculatedHash = crypto.createHmac('sha256', secretKey)
  .update(dataCheckString).digest('hex');

// ✅ maxAgeSeconds = 300 (5 минут)
```

#### Улучшения:
- ✅ Только v2 (актуальная версия Telegram WebApp)
- ✅ Нет fallback на старые версии (защита от downgrade атак)
- ✅ Строгая проверка времени жизни (5 минут вместо 24 часов)
- ✅ Защита от атак с будущим временем (auth_date не может быть > now + 60 сек)
- ✅ Обязательная проверка auth_date (раньше было опционально)
- ✅ Валидация JSON данных пользователя

---

## 🔑 Ротация токенов

### Шаг 1: Создайте новый Telegram Bot

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Следуйте инструкциям
4. Сохраните новый `BOT_TOKEN`

### Шаг 2: Обновите переменные окружения

#### Локально (.env файлы):
```bash
# backend/.env
BOT_TOKEN=новый_токен_здесь
MANAGER_CHAT_ID=ваш_chat_id

# PocketBase
PB_URL=http://ваш_сервер:8090
PB_TOKEN=новый_pb_токен
```

#### На Vercel:
```bash
# Через CLI
vercel env add BOT_TOKEN production
vercel env add MANAGER_CHAT_ID production
vercel env add PB_URL production
vercel env add PB_TOKEN production

# Или через Dashboard:
# https://vercel.com/your-project/settings/environment-variables
```

### Шаг 3: Удалите старые токены из истории Git (если были)

```bash
# Проверьте, есть ли токены в истории
git log --all --full-history --source --pretty=format:"%H %s" -- ".env" "backend/.env"

# Если найдены, используйте git-filter-repo (рекомендуется)
pip install git-filter-repo
git filter-repo --path .env --invert-paths --force
git filter-repo --path backend/.env --invert-paths --force

# Или BFG Repo-Cleaner (альтернатива)
java -jar bfg.jar --delete-files .env
java -jar bfg.jar --replace-text passwords.txt  # список токенов для замены
```

### Шаг 4: Проверьте .gitignore

```bash
# Убедитесь, что .env файлы игнорируются
cat .gitignore | grep -E "\.env"

# Должно быть:
**/.env
**/.env.*
.env
```

### Шаг 5: Ротируйте PocketBase токен

1. Откройте PocketBase Admin UI: `http://your-server:8090/_/`
2. Settings → Admins → Create new admin (или измените пароль)
3. Войдите с новыми credentials
4. Скопируйте новый auth token из Network tab (DevTools)
5. Обновите `PB_TOKEN` в .env

---

## 🛡️ Текущие настройки безопасности

### Telegram Authentication:
```javascript
// backend/src/telegramWebAppAuth.js
maxAgeSeconds: 300  // 5 минут (по умолчанию)
version: 'v2-strict'  // Только актуальная версия
```

### Rate Limiting:
```javascript
// backend/src/index.js
ORDER_RATE_WINDOW_MS: 5 * 60 * 1000  // 5 минут
ORDER_RATE_MAX: 30  // 30 заказов за 5 минут
```

### CORS:
```javascript
// backend/src/index.js
// Требует явной конфигурации CORS_ALLOW_ORIGINS
// Пустой список = ошибка (не разрешает все origins)
```

---

## 📋 Чеклист безопасности

### Обязательно:
- [x] ✅ .env файлы в .gitignore
- [x] ✅ Строгая валидация Telegram initData
- [x] ✅ maxAgeSeconds = 300 (5 минут)
- [x] ✅ Валидация PocketBase ID (защита от SQL injection)
- [x] ✅ Rate limiting на /orders
- [ ] ⚠️ Ротировать все токены (BOT_TOKEN, PB_TOKEN)
- [ ] ⚠️ Настроить CORS_ALLOW_ORIGINS
- [ ] ⚠️ Добавить rate limiting на все эндпоинты

### Рекомендуется:
- [ ] 📝 Добавить авторизацию на /api/cache/invalidate
- [ ] 📝 Настроить HTTPS redirect
- [ ] 📝 Добавить CSRF protection
- [ ] 📝 Настроить Helmet security headers
- [ ] 📝 Добавить логирование подозрительных запросов
- [ ] 📝 Настроить мониторинг (Sentry, DataDog)

---

## 🚨 Что делать при утечке токенов

### Немедленно:
1. **Ротируйте все токены** (см. инструкцию выше)
2. **Проверьте логи** на подозрительную активность
3. **Удалите токены из Git истории** (git-filter-repo)
4. **Force push** в репозиторий (после backup!)
5. **Обновите токены на всех серверах** (Vercel, production)

### В течение 24 часов:
1. Проверьте все заказы за последние 7 дней
2. Проверьте изменения в PocketBase
3. Измените пароли администраторов
4. Настройте алерты на подозрительную активность

---

## 📞 Контакты

При обнаружении уязвимостей:
- Создайте issue в GitHub (для некритичных)
- Напишите напрямую (для критичных)

---

## 📚 Дополнительные ресурсы

- [Telegram WebApp Security](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
