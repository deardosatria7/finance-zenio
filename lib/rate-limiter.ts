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
