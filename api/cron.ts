import type { VercelRequest, VercelResponse } from '@vercel/node';
import { BotHandlers } from '../src/bot/handlers.js';
import { getBotToken, getCronSecret } from '../src/env.js';
import { TelegramClient } from '../src/services/telegram.js';
import { shouldRunDailyBroadcast } from '../src/utils.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const cronSecret = getCronSecret();
  if (cronSecret && request.headers.authorization !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  if (!shouldRunDailyBroadcast()) {
    return response.status(200).json({ ok: true, skipped: true });
  }

  try {
    const telegram = new TelegramClient(getBotToken());
    const handlers = new BotHandlers(telegram);
    const sent = await handlers.broadcastDailySchedules();

    return response.status(200).json({ ok: true, sent });
  } catch (error) {
    console.error('Ошибка ежедневной рассылки:', error);
    return response.status(500).json({ error: 'Broadcast failed' });
  }
}
