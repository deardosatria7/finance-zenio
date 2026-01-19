// lib/rate-limiter.ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "./redis";

export const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rate_limit",
  points: 5, // jumlah request
  duration: 10, // per 10 detik
});
