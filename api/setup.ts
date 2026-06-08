import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBotToken, getPublicBaseUrl, getSetupSecret, getWebhookSecret } from '../src/env.js';
import { TelegramClient } from '../src/services/telegram.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET' && request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const setupSecret = getSetupSecret();
  const providedSecret =
    request.headers.authorization?.replace('Bearer ', '') ??
    String(request.query.secret ?? '');

  if (setupSecret && providedSecret !== setupSecret) {
    return response.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const baseUrl = getPublicBaseUrl(request.headers.host);
    const webhookUrl = `${baseUrl}/api/webhook`;
    const telegram = new TelegramClient(getBotToken());
    const result = await telegram.setWebhook(webhookUrl, getWebhookSecret());
    const payload = await result.json();

    return response.status(result.ok ? 200 : 500).json({
      ok: result.ok,
      webhookUrl,
      telegram: payload,
    });
  } catch (error) {
    console.error('Ошибка настройки webhook:', error);
    return response.status(500).json({ error: String(error) });
  }
}
