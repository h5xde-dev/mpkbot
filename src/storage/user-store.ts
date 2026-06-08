import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { usersFile } from '../config.js';
import { ensureSchema, getSql, usePostgresStorage } from '../db.js';
import type { UserRecord } from '../types.js';
import { isLinked } from '../utils.js';

type UsersMap = Record<string, Omit<UserRecord, 'chatId'>>;

interface UserStore {
  get(chatId: string): Promise<UserRecord | null>;
  ensureUser(chatId: string, username?: string): Promise<UserRecord>;
  linkTeacher(
    chatId: string,
    teacher: string,
    username?: string,
  ): Promise<UserRecord>;
  unlinkTeacher(chatId: string): Promise<void>;
  getLinkedUsers(): Promise<UserRecord[]>;
}

function toRecord(chatId: string, data: Omit<UserRecord, 'chatId'>): UserRecord {
  return { chatId, ...data };
}

type UserRow = {
  chat_id: string;
  username: string | null;
  teacher: string | null;
  linked_at: Date | string | null;
};

function rowToRecord(row: UserRow): UserRecord {
  return {
    chatId: row.chat_id,
    username: row.username ?? undefined,
    teacher: row.teacher ?? undefined,
    linkedAt: row.linked_at
      ? new Date(row.linked_at).toISOString()
      : undefined,
  };
}

class PostgresUserStore implements UserStore {
  async get(chatId: string): Promise<UserRecord | null> {
    await ensureSchema();
    const rows = await getSql()`
      SELECT chat_id, username, teacher, linked_at
      FROM users
      WHERE chat_id = ${chatId}
      LIMIT 1
    ` as UserRow[];

    return rows[0] ? rowToRecord(rows[0]) : null;
  }

  async ensureUser(chatId: string, username?: string): Promise<UserRecord> {
    await ensureSchema();
    const existing = await this.get(chatId);

    if (existing) {
      if (username && existing.username !== username) {
        await getSql()`
          UPDATE users
          SET username = ${username}
          WHERE chat_id = ${chatId}
        `;
        return { ...existing, username };
      }
      return existing;
    }

    await getSql()`
      INSERT INTO users (chat_id, username)
      VALUES (${chatId}, ${username ?? null})
    `;

    return { chatId, username };
  }

  async linkTeacher(
    chatId: string,
    teacher: string,
    username?: string,
  ): Promise<UserRecord> {
    await ensureSchema();
    const linkedAt = new Date().toISOString();

    await getSql()`
      INSERT INTO users (chat_id, username, teacher, linked_at)
      VALUES (${chatId}, ${username ?? null}, ${teacher}, ${linkedAt})
      ON CONFLICT (chat_id) DO UPDATE SET
        username = COALESCE(EXCLUDED.username, users.username),
        teacher = EXCLUDED.teacher,
        linked_at = EXCLUDED.linked_at
    `;

    return {
      chatId,
      username,
      teacher,
      linkedAt,
    };
  }

  async unlinkTeacher(chatId: string): Promise<void> {
    await ensureSchema();
    const existing = await this.get(chatId);
    if (!existing) return;

    await getSql()`
      UPDATE users
      SET teacher = NULL, linked_at = NULL
      WHERE chat_id = ${chatId}
    `;
  }

  async getLinkedUsers(): Promise<UserRecord[]> {
    await ensureSchema();
    const rows = await getSql()`
      SELECT chat_id, username, teacher, linked_at
      FROM users
      WHERE teacher IS NOT NULL AND teacher <> ''
    ` as UserRow[];

    return rows.map(rowToRecord).filter(isLinked);
  }
}

class FileUserStore implements UserStore {
  private cache: UsersMap = {};
  private loaded = false;
  private readonly filePath = usersFile;

  private async load(): Promise<void> {
    if (this.loaded) return;

    await mkdir(path.dirname(this.filePath), { recursive: true });

    if (!existsSync(this.filePath)) {
      this.cache = {};
      this.loaded = true;
      return;
    }

    const raw = await readFile(this.filePath, 'utf8');
    this.cache = JSON.parse(raw) as UsersMap;
    this.loaded = true;
  }

  private async save(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.cache, null, 2));
  }

  async get(chatId: string): Promise<UserRecord | null> {
    await this.load();
    const user = this.cache[chatId];
    return user ? toRecord(chatId, user) : null;
  }

  async ensureUser(chatId: string, username?: string): Promise<UserRecord> {
    await this.load();
    const existing = this.cache[chatId];

    if (existing) {
      if (username && existing.username !== username) {
        existing.username = username;
        await this.save();
      }
      return toRecord(chatId, existing);
    }

    this.cache[chatId] = { username };
    await this.save();
    return toRecord(chatId, this.cache[chatId]);
  }

  async linkTeacher(
    chatId: string,
    teacher: string,
    username?: string,
  ): Promise<UserRecord> {
    await this.load();
    const existing = this.cache[chatId] ?? {};
    this.cache[chatId] = {
      ...existing,
      username: username ?? existing.username,
      teacher,
      linkedAt: new Date().toISOString(),
    };
    await this.save();
    return toRecord(chatId, this.cache[chatId]);
  }

  async unlinkTeacher(chatId: string): Promise<void> {
    await this.load();
    const existing = this.cache[chatId];
    if (!existing) return;

    this.cache[chatId] = { username: existing.username };
    await this.save();
  }

  async getLinkedUsers(): Promise<UserRecord[]> {
    await this.load();
    return Object.entries(this.cache)
      .map(([chatId, user]) => toRecord(chatId, user))
      .filter(isLinked);
  }
}

let store: UserStore | null = null;

export function getUserStore(): UserStore {
  if (!store) {
    store = usePostgresStorage() ? new PostgresUserStore() : new FileUserStore();
  }
  return store;
}
