export function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('Переменная TELEGRAM_BOT не задана');
  }
  return token;
}

export function getWebhookSecret(): string | undefined {
  return process.env.WEBHOOK_SECRET;
}

export function getSetupSecret(): string | undefined {
  return process.env.SETUP_SECRET;
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET;
}

export function getPublicBaseUrl(requestHost?: string): string {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (requestHost) {
    return `https://${requestHost}`;
  }

  throw new Error('Не удалось определить публичный URL для webhook');
}
