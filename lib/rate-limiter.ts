// lib/rate-limiter.ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import { getRedis } from "./redis";

export function getRateLimiter() {
  return new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rate_limit",
    points: 5, // jumlah request
    duration: 10, // per 10 detik
  });
}

/** Batas pesan per chat Telegram; tiap pesan nanti bisa memicu panggilan LLM */
export function getTelegramRateLimiter() {
  return new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rate_limit_tg",
    points: 10, // jumlah pesan
    duration: 60, // per 60 detik
  });
}
