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

export function matchTeacherName(
  input: string,
  teachers: string[],
): string | null {
  const normalizedInput = normalizeTeacherName(input);
  if (!normalizedInput) return null;

  for (const teacher of teachers) {
    if (normalizeTeacherName(teacher) === normalizedInput) {
      return teacher;
    }
  }

  const parts = input.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const surname = parts[0].toLowerCase();
  const bySurname = teachers.filter((teacher) => {
    const teacherSurname = teacher.trim().split(/\s+/)[0]?.toLowerCase();
    return teacherSurname === surname;
  });

  if (bySurname.length === 1) {
    return bySurname[0];
  }

  if (parts.length >= 2) {
    const firstName = parts[1].toLowerCase();
    const nameInitial = firstName[0];

    const byInitial = bySurname.filter((teacher) => {
      const rest = teacher.trim().split(/\s+/).slice(1).join(' ');
      const normalizedRest = normalizeTeacherName(rest);

      if (normalizedRest.startsWith(nameInitial)) return true;
      if (normalizedRest.includes(firstName)) return true;

      return false;
    });

    if (byInitial.length === 1) {
      return byInitial[0];
    }
  }

  return null;
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
