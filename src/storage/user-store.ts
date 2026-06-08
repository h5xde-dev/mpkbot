import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { usersFile } from '../config.js';
import { getRedis, useRedisStorage } from '../redis.js';
import type { UserRecord } from '../types.js';
import { isLinked } from '../utils.js';

const KV_USERS_KEY = 'mpkbot:users';

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


class FileUserStore implements UserStore {
  private cache: UsersMap = {};
  private loaded = false;

  private async load(): Promise<void> {
    if (this.loaded) return;

    await mkdir(path.dirname(usersFile), { recursive: true });

    if (!existsSync(usersFile)) {
      this.cache = {};
      this.loaded = true;
      return;
    }

    const raw = await readFile(usersFile, 'utf8');
    this.cache = JSON.parse(raw) as UsersMap;
    this.loaded = true;
  }

  private async save(): Promise<void> {
    await writeFile(usersFile, JSON.stringify(this.cache, null, 2));
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

class RedisUserStore implements UserStore {
  private async readAll(): Promise<UsersMap> {
    return (await getRedis().get<UsersMap>(KV_USERS_KEY)) ?? {};
  }

  private async writeAll(users: UsersMap): Promise<void> {
    await getRedis().set(KV_USERS_KEY, users);
  }

  async get(chatId: string): Promise<UserRecord | null> {
    const users = await this.readAll();
    const user = users[chatId];
    return user ? toRecord(chatId, user) : null;
  }

  async ensureUser(chatId: string, username?: string): Promise<UserRecord> {
    const users = await this.readAll();
    const existing = users[chatId];

    if (existing) {
      if (username && existing.username !== username) {
        existing.username = username;
        users[chatId] = existing;
        await this.writeAll(users);
      }
      return toRecord(chatId, existing);
    }

    users[chatId] = { username };
    await this.writeAll(users);
    return toRecord(chatId, users[chatId]);
  }

  async linkTeacher(
    chatId: string,
    teacher: string,
    username?: string,
  ): Promise<UserRecord> {
    const users = await this.readAll();
    const existing = users[chatId] ?? {};
    users[chatId] = {
      ...existing,
      username: username ?? existing.username,
      teacher,
      linkedAt: new Date().toISOString(),
    };
    await this.writeAll(users);
    return toRecord(chatId, users[chatId]);
  }

  async unlinkTeacher(chatId: string): Promise<void> {
    const users = await this.readAll();
    const existing = users[chatId];
    if (!existing) return;

    users[chatId] = { username: existing.username };
    await this.writeAll(users);
  }

  async getLinkedUsers(): Promise<UserRecord[]> {
    const users = await this.readAll();
    return Object.entries(users)
      .map(([chatId, user]) => toRecord(chatId, user))
      .filter(isLinked);
  }
}

let store: UserStore | null = null;

export function getUserStore(): UserStore {
  if (!store) {
    store = useRedisStorage() ? new RedisUserStore() : new FileUserStore();
  }
  return store;
}
