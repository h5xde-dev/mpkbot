import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BotHandlers } from '../src/bot/handlers.js';
import { getBotToken, getWebhookSecret } from '../src/env.js';
import { TelegramClient } from '../src/services/telegram.js';
import type { TelegramUpdate } from '../src/types.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const secret = getWebhookSecret();
  if (secret && request.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  const update = request.body as TelegramUpdate;
  if (!update?.update_id) {
    return response.status(400).json({ error: 'Invalid update' });
  }

  response.status(200).json({ ok: true });

  try {
    const telegram = new TelegramClient(getBotToken());
    const handlers = new BotHandlers(telegram);
    await handlers.handleUpdate(update);
  } catch (error) {
    console.error('Ошибка обработки update:', error);
  }
}
