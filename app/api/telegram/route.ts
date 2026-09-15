import { getBot } from "@/lib/telegram/bot";
import { webhookCallback } from "grammy";

// pg dan ioredis butuh runtime Node.js, bukan Edge
export const runtime = "nodejs";

let handler: ((request: Request) => Promise<Response>) | null = null;

// Dibuat saat request pertama, bukan saat modul dimuat, supaya `next build` jalan tanpa env Telegram
function getHandler() {
  if (!handler) {
    // Tanpa secretToken, grammy menerima request dari siapa pun yang tahu URL route ini,
    // jadi kegagalannya dibuat nyaring seperti BETTER_AUTH_SECRET di route auth.
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secretToken) {
      throw new Error(
        "TELEGRAM_WEBHOOK_SECRET belum diset di environment runtime.",
      );
    }

    handler = webhookCallback(getBot(), "std/http", {
      secretToken,
      // Balas 200 saat handler lambat; "throw" membuat Telegram mengirim ulang update yang sama
      onTimeout: "return",
    });
  }
  return handler;
}

export async function POST(request: Request) {
  return getHandler()(request);
}
