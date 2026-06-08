import { callbackShowSchedule } from '../config.js';
import {
  buildScheduleMessage,
  fetchTeachers,
  matchTeacherName,
} from '../services/schedule.js';
import { TelegramClient } from '../services/telegram.js';
import { getUserStore } from '../storage/user-store.js';
import type { TelegramCallbackQuery, TelegramMessage, TelegramUpdate } from '../types.js';
import { isLinked, sleep } from '../utils.js';

export class BotHandlers {
  constructor(private readonly telegram: TelegramClient) {}

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.onCallbackQuery(update.callback_query);
      return;
    }

    if (!update.message?.text) return;

    const text = update.message.text.trim();
    if (text.startsWith('/start')) {
      await this.onStart(update.message);
      return;
    }

    if (text.startsWith('/logout')) {
      await this.onLogout(update.message);
      return;
    }

    if (text.startsWith('/')) return;

    await this.onTextMessage(update.message);
  }

  async broadcastDailySchedules(): Promise<number> {
    const users = await getUserStore().getLinkedUsers();
    let sent = 0;

    for (const user of users) {
      if (!user.teacher) continue;
      await this.sendSchedule(user.chatId, user.teacher);
      sent += 1;
      await sleep(300);
    }

    return sent;
  }

  private async onStart(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const username =
      message.chat.username ?? message.chat.first_name ?? 'пользователь';
    const user = await getUserStore().ensureUser(chatId, username);

    if (isLinked(user)) {
      await this.telegram.sendMessage(
        chatId,
        `С возвращением, ${user.teacher}!\nРасписание уже привязано к вашему аккаунту.`,
        this.telegram.getScheduleKeyboard(),
      );
      await this.sendSchedule(chatId, user.teacher!);
      return;
    }

    await this.telegram.sendMessage(
      chatId,
      `Привет, ${username}!\nНапишите ваше имя из преподавательской базы, например: Иванов А.В.`,
    );
  }

  private async onLogout(message: TelegramMessage): Promise<void> {
    const chatId = String(message.chat.id);
    const user = await getUserStore().get(chatId);

    if (!isLinked(user)) {
      await this.telegram.sendMessage(
        chatId,
        'У вас ещё не привязано расписание. Используйте /start и отправьте ФИО.',
      );
      return;
    }

    await getUserStore().unlinkTeacher(chatId);
    await this.telegram.sendMessage(
      chatId,
      `Привязка к ${user!.teacher} снята.\nОтправьте ФИО из преподавательской базы, чтобы привязать расписание снова.`,
    );
  }

  private async onTextMessage(message: TelegramMessage): Promise<void> {
    const text = message.text?.trim();
    if (!text) return;

    const chatId = String(message.chat.id);
    const user = await getUserStore().get(chatId);

    if (!user) {
      await this.telegram.sendMessage(chatId, 'Сначала отправьте команду /start.');
      return;
    }

    if (isLinked(user)) {
      await this.telegram.sendMessage(
        chatId,
        `Расписание уже привязано к ${user.teacher}.\nНажмите кнопку ниже или используйте /logout для смены преподавателя.`,
        this.telegram.getScheduleKeyboard(),
      );
      return;
    }

    try {
      const teachers = await fetchTeachers();
      const matchedTeacher = matchTeacherName(text, teachers);

      if (!matchedTeacher) {
        await this.telegram.sendMessage(
          chatId,
          `Преподаватель "${text}" не найден.\n`
            + 'Попробуйте фамилию с инициалами (Иванов А.В.) или фамилию с именем (Туманова Татьяна).',
        );
        return;
      }

      const linkedUser = await getUserStore().linkTeacher(
        chatId,
        matchedTeacher,
        message.chat.username ?? message.chat.first_name,
      );

      await this.telegram.sendMessage(
        chatId,
        `Готово! Расписание привязано к ${linkedUser.teacher}.\nПри следующем входе авторизация не потребуется.`,
        this.telegram.getScheduleKeyboard(),
      );
    } catch (error) {
      await this.telegram.sendMessage(
        chatId,
        'Не удалось проверить ФИО. Попробуйте ещё раз через минуту.',
      );
      console.error(`Ошибка привязки пользователя ${chatId}:`, error);
    }
  }

  private async onCallbackQuery(callbackQuery: TelegramCallbackQuery): Promise<void> {
    const chatId = String(callbackQuery.message?.chat.id ?? callbackQuery.from.id);
    const data = callbackQuery.data;

    await this.telegram.answerCallback(callbackQuery.id);

    if (data !== callbackShowSchedule) {
      await this.telegram.sendMessage(chatId, 'Неизвестная команда');
      return;
    }

    const user = await getUserStore().get(chatId);
    if (!isLinked(user)) {
      await this.telegram.sendMessage(
        chatId,
        'Сначала привяжите ФИО через /start.',
      );
      return;
    }

    await this.sendSchedule(chatId, user!.teacher!);
  }

  private async sendSchedule(chatId: string, teacher: string): Promise<void> {
    try {
      const schedule = await buildScheduleMessage(teacher);
      if (!schedule) {
        await this.telegram.sendMessage(
          chatId,
          `Расписание для ${teacher} не найдено.`,
        );
        return;
      }

      await this.telegram.sendMessage(
        chatId,
        schedule,
        this.telegram.getScheduleKeyboard(),
      );
    } catch (error) {
      await this.telegram.sendMessage(
        chatId,
        'Не удалось загрузить расписание. Попробуйте позже.',
      );
      console.error(`Ошибка расписания для ${chatId} (${teacher}):`, error);
    }
  }
}
