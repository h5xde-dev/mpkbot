import {
  callbackShowSchedule,
  sendMaxRetries,
  sendRetryDelayMs,
} from '../config.js';
import type { InlineKeyboardMarkup } from '../types.js';
import { sleep } from '../utils.js';

const scheduleKeyboard: InlineKeyboardMarkup = {
  inline_keyboard: [
    [{ text: 'Показать расписание', callback_data: callbackShowSchedule }],
  ],
};

export class TelegramClient {
  constructor(private readonly token: string) {}

  getScheduleKeyboard(): InlineKeyboardMarkup {
    return scheduleKeyboard;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    replyMarkup?: InlineKeyboardMarkup,
    parseMode: 'HTML' | 'Markdown' = 'HTML',
  ): Promise<void> {
    let lastError: unknown;

    for (let attempt = 0; attempt < sendMaxRetries; attempt++) {
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${this.token}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: parseMode,
              reply_markup: replyMarkup,
            }),
          },
        );

        if (response.ok) return;

        const body = await response.text();
        lastError = new Error(`Telegram API ${response.status}: ${body}`);
      } catch (error) {
        lastError = error;
      }

      if (attempt < sendMaxRetries - 1) {
        await sleep(sendRetryDelayMs);
      }
    }

    console.error(`Не удалось отправить сообщение в ${chatId}:`, lastError);
  }

  async answerCallback(callbackQueryId: string, text?: string): Promise<void> {
    try {
      await fetch(
        `https://api.telegram.org/bot${this.token}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text,
          }),
        },
      );
    } catch (error) {
      console.error(`Не удалось ответить на callback ${callbackQueryId}:`, error);
    }
  }

  async setWebhook(url: string, secretToken?: string): Promise<Response> {
    return fetch(`https://api.telegram.org/bot${this.token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secretToken,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
      }),
    });
  }

  async deleteWebhook(): Promise<Response> {
    return fetch(`https://api.telegram.org/bot${this.token}/deleteWebhook`, {
      method: 'POST',
    });
  }
}
