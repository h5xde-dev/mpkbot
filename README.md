# mpkbot

Telegram-бот для рассылки расписания преподавателей МПК. Работает через **webhook** и рассчитан на бесплатный деплой на **Vercel**.

## Возможности

- Привязка Telegram-аккаунта к ФИО преподавателя (один раз)
- Показ расписания по кнопке и командам
- Ежедневная рассылка через Vercel Cron
- Постоянное хранение пользователей в Upstash Redis (или локально в `secret/users.json`)

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

### 2. Добавьте Storage → Upstash Redis

В проекте Vercel: **Storage → Marketplace → Upstash Redis → Add Integration**.  
Переменные `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN` подставятся автоматически.

Без Redis бот будет работать только локально — на Vercel файловая система не сохраняет данные между запросами.

### 3. Задайте переменные окружения

| Переменная | Обязательно | Описание |
|---|---|---|
| `TELEGRAM_BOT` | да | Токен бота от @BotFather |
| `WEBHOOK_SECRET` | рекомендуется | Секрет для проверки webhook |
| `SETUP_SECRET` | рекомендуется | Защита эндпоинта `/api/setup` |
| `CRON_SECRET` | рекомендуется | Защита `/api/cron` |

### 4. Зарегистрируйте webhook

После первого деплоя откройте:

```text
https://<your-app>.vercel.app/api/setup?secret=<SETUP_SECRET>
```

Или локально:

```bash
PUBLIC_URL=https://<your-app>.vercel.app npm run setup-webhook
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
src/storage/   — хранилище пользователей (KV / файл)
```
