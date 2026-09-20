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

/** Batas pesan per nomor WhatsApp; tiap pesan bisa memicu panggilan LLM */
export function getWhatsappRateLimiter() {
  return new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rate_limit_wa",
    points: 10, // jumlah pesan
    duration: 60, // per 60 detik
  });
}

/** Batas percobaan kode HUBUNGKAN yang gagal, supaya kode tidak bisa ditebak dengan brute force */
export function getWhatsappLinkRateLimiter() {
  return new RateLimiterRedis({
    storeClient: getRedis(),
    keyPrefix: "rate_limit_wa_link",
    points: 5, // jumlah percobaan
    duration: 3600, // per 1 jam
  });
}
