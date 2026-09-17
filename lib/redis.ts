import Redis from "ioredis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is not defined");
    }
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
    });
    // Tanpa listener, ioredis hanya mencetak "Unhandled error event" tanpa konteks
    _redis.on("error", (error) => {
      console.error("Redis error:", error.message);
    });
  }
  return _redis;
}
