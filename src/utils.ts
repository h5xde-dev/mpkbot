import {
  dailyBroadcastFrequencyDays,
  dailyBroadcastStartDate,
} from './config.js';
import type { UserRecord } from './types.js';

export function capitalizeDay(day: string): string {
  if (!day) return day;
  return day[0].toUpperCase() + day.slice(1).toLowerCase();
}

export function normalizeTeacherName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').replace(/\./g, '').toLowerCase();
}

export function isLinked(user: UserRecord | null | undefined): boolean {
  return Boolean(user?.teacher);
}

export function formatRuWeekday(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(date);
}

export function shouldRunDailyBroadcast(date = new Date()): boolean {
  const start = new Date(dailyBroadcastStartDate);
  start.setHours(0, 0, 0, 0);

  const current = new Date(date);
  current.setHours(0, 0, 0, 0);

  const diffDays = Math.floor(
    (current.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays < 0) return false;
  return diffDays % dailyBroadcastFrequencyDays === 0;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
