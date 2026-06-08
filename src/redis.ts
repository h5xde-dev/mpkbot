import { Redis } from '@upstash/redis';

let client: Redis | null = null;

export function useRedisStorage(): boolean {
  return Boolean(getRedisUrl() && getRedisToken());
}

export function getRedis(): Redis {
  if (!client) {
    const url = getRedisUrl();
    const token = getRedisToken();

    if (!url || !token) {
      throw new Error('Redis не настроен');
    }

    client = new Redis({ url, token });
  }

  return client;
}

function getRedisUrl(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.KV_REST_API_URL
  );
}

function getRedisToken(): string | undefined {
  return (
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.KV_REST_API_TOKEN
  );
}
