import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  httpTimeoutMs,
  scheduleUrl,
  sendMaxRetries,
  sendRetryDelayMs,
  teachersCacheFile,
  teachersCacheTtlMs,
} from '../config.js';
import { getRedis, useRedisStorage } from '../redis.js';
import {
  capitalizeDay,
  formatRuWeekday,
  normalizeTeacherName,
  sleep,
} from '../utils.js';

const KV_TEACHERS_KEY = 'mpkbot:teachers';
const KV_TEACHERS_AT_KEY = 'mpkbot:teachers:cached_at';

async function readTeachersCache(): Promise<string[] | null> {
  if (useRedisStorage()) {
    const cachedAt = await getRedis().get<number>(KV_TEACHERS_AT_KEY);
    if (!cachedAt) return null;

    if (Date.now() - cachedAt > teachersCacheTtlMs) return null;
    return (await getRedis().get<string[]>(KV_TEACHERS_KEY)) ?? null;
  }

  if (!existsSync(teachersCacheFile)) return null;

  const fileStat = await stat(teachersCacheFile);
  if (Date.now() - fileStat.mtimeMs > teachersCacheTtlMs) return null;

  const raw = await readFile(teachersCacheFile, 'utf8');
  return JSON.parse(raw) as string[];
}

async function writeTeachersCache(teachers: string[]): Promise<void> {
  if (useRedisStorage()) {
    await getRedis().set(KV_TEACHERS_KEY, teachers);
    await getRedis().set(KV_TEACHERS_AT_KEY, Date.now());
    return;
  }

  await mkdir(path.dirname(teachersCacheFile), { recursive: true });
  await writeFile(teachersCacheFile, JSON.stringify(teachers));
}

async function postSchedule(body: Record<string, string>): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < sendMaxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), httpTimeoutMs);

      const response = await fetch(scheduleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) return response;

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < sendMaxRetries - 1) {
      await sleep(sendRetryDelayMs);
    }
  }

  throw new Error(`Не удалось загрузить расписание: ${String(lastError)}`);
}

export async function fetchTeachers(forceRefresh = false): Promise<string[]> {
  if (!forceRefresh) {
    const cached = await readTeachersCache();
    if (cached) return cached;
  }

  const response = await postSchedule({ type: '1' });
  const data = (await response.json()) as { rs: string[] };
  await writeTeachersCache(data.rs);
  return data.rs;
}

export async function fetchSchedule(
  teacherName: string,
): Promise<Record<string, unknown>> {
  const response = await postSchedule({ type: '2', teacher: teacherName });
  return (await response.json()) as Record<string, unknown>;
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

  return null;
}

function formatSchedule(
  jsonData: Record<string, unknown>,
  teacherName: string,
): string {
  const lines: string[] = [];

  for (const [day, lessons] of Object.entries(jsonData)) {
    lines.push(`<u><b>${day}</b></u>:`);
    if (!lessons || typeof lessons !== 'object') continue;

    for (const [timeKey, lessonList] of Object.entries(
      lessons as Record<string, unknown>,
    )) {
      if (!Array.isArray(lessonList)) continue;

      for (const lesson of lessonList) {
        if (!lesson || typeof lesson !== 'object') continue;
        const item = lesson as Record<string, string>;
        const time = String(timeKey).split('\n').join('-');
        const title = String(item.lesson ?? '')
          .replaceAll('\n', ' ')
          .replaceAll(teacherName, '')
          .trim();

        lines.push(
          `-- (<b>${time})</b> Группа ${item.group}: "${title}" в кабинете ${item.class}`,
        );
      }
    }
  }

  return lines.join('\n');
}

export async function buildScheduleMessage(
  teacherName: string,
): Promise<string | null> {
  const teacherSchedule = await fetchSchedule(teacherName);
  if (!teacherSchedule || Object.keys(teacherSchedule).length === 0) {
    return null;
  }

  const now = new Date();
  const currentDay = formatRuWeekday(now);
  const nextDay = formatRuWeekday(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
  );
  const scheduleByDay = teacherSchedule.rs as Record<string, unknown>;

  let heading = 'Сегодня пар нет';
  let heading2 = 'Завтра пар нет';

  const todayLessons = scheduleByDay[capitalizeDay(currentDay)];
  if (todayLessons && typeof todayLessons === 'object') {
    const entries = Object.entries(todayLessons as Record<string, unknown>);
    if (entries.length > 0) {
      const firstTime = String(entries[0][0]).split('\n')[0];
      const lastTime = String(entries.at(-1)?.[0]).split('\n').at(-1);
      heading = `<b>${capitalizeDay(currentDay)}: ${firstTime} c ${lastTime}</b> \n`;
    }
  }

  const tomorrowLessons = scheduleByDay[capitalizeDay(nextDay)];
  if (tomorrowLessons && typeof tomorrowLessons === 'object') {
    const entries = Object.entries(tomorrowLessons as Record<string, unknown>);
    if (entries.length > 0) {
      const firstTime = String(entries[0][0]).split('\n')[0];
      const lastTime = String(entries.at(-1)?.[0]).split('\n').at(-1);
      heading2 = `<b>${capitalizeDay(nextDay)}: ${firstTime} c ${lastTime}</b> \n`;
    }
  }

  const formattedSchedule = formatSchedule(scheduleByDay, teacherName);
  return `${heading}${heading2}\n\n${formattedSchedule}`;
}
