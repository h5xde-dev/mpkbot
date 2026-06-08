# mpkbot

Telegram-бот для рассылки расписания преподавателей МПК. Работает через **webhook** и рассчитан на бесплатный деплой на **Vercel**.

## Возможности

- Привязка Telegram-аккаунта к ФИО преподавателя (один раз)
- Показ расписания по кнопке и командам
- Ежедневная рассылка через Vercel Cron
- Постоянное хранение пользователей в Neon Postgres (или локально в `secret/users.json`)

## Быстрый старт (локально)

```bash
npm install
cp .env.example .env
# заполните TELEGRAM_BOT
npm run start:local
```

Для локальной разработки с webhook понадобится публичный URL (например, через `ngrok`):

```bash
PUBLIC_URL=https://xxxx.ngrok-free.app npm run setup-webhook
```

## Деплой на Vercel

### 1. Импортируйте репозиторий

```bash
npx vercel
```

Или подключите GitHub-репозиторий в [vercel.com](https://vercel.com).

В настройках проекта Vercel (если деплой падает):
- **Framework Preset** → `Other`
- **Output Directory** → `public`
- **Build Command** → оставьте пустым или `npm run typecheck` (уже в `vercel.json`)

### 2. Добавьте Storage → Neon Postgres

В проекте Vercel: **Storage → Neon → Create Database → Connect to mpkbot**.  
Переменные `DATABASE_URL` / `POSTGRES_URL` подставятся автоматически.

Без Postgres бот будет работать только локально — на Vercel файловая система не сохраняет данные между запросами.  
Таблицы `users` и `teachers_cache` создаются автоматически при первом запросе.

### 3. Задайте переменные окружения

| Переменная | Обязательно | Описание |
|---|---|---|
| `TELEGRAM_BOT` | да | Токен бота от @BotFather |
| `DATABASE_URL` | да (на Vercel) | Строка подключения Neon Postgres |
| `WEBHOOK_SECRET` | рекомендуется | Секрет для проверки webhook |
| `SETUP_SECRET` | рекомендуется | Защита эндпоинта `/api/setup` |
| `CRON_SECRET` | рекомендуется | Защита `/api/cron` |

### 4. Зарегистрируйте webhook (обязательно!)

Без этого шага бот **не будет получать сообщения**.

После первого деплоя откройте в браузере:

```text
https://<your-app>.vercel.app/api/setup?secret=<SETUP_SECRET>
```

Должен вернуться JSON: `"ok": true, "description": "Webhook was set"`.

Или из терминала:

```bash
npm run setup-webhook:prod
```

Проверка:

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
# поле "url" должно быть https://<your-app>.vercel.app/api/webhook
```

### 5. Проверьте бота

Отправьте `/start` в Telegram. При первом входе введите ФИО (например, `Иванов А.В.`).

## API-эндпоинты

| Путь | Назначение |
|---|---|
| `GET /` | Health-check |
| `POST /api/webhook` | Приём обновлений от Telegram |
| `GET /api/setup` | Регистрация webhook в Telegram |
| `GET /api/cron` | Ежедневная рассылка (Vercel Cron, 05:00 UTC) |

## Команды бота

- `/start` — регистрация или возврат с уже привязанным ФИО
- `/logout` — сброс привязки ФИО

## Структура проекта

```text
api/           — serverless-функции Vercel
src/bot/       — обработчики Telegram
src/services/  — API расписания и Telegram
src/storage/   — хранилище пользователей (Postgres / файл)
```
