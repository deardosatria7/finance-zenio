import { Bot } from "grammy";
import { getUserIdByChat, linkChatWithCode, unlinkChat } from "./link";

const BELUM_TERHUBUNG =
  "Chat ini belum terhubung ke akun finance-zenio. Buka menu Telegram di dashboard, lalu tekan Hubungkan Telegram.";

// Dibuat saat pertama dipakai (seperti lib/redis.ts), supaya next build jalan tanpa TELEGRAM_BOT_TOKEN
let _bot: Bot | null = null;

export function getBot(): Bot {
  if (!_bot) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error("TELEGRAM_BOT_TOKEN is not defined");
    }
    _bot = createBot(token);
  }
  return _bot;
}

function createBot(token: string) {
  const bot = new Bot(token);

  // Error dari handler ditangkap di sini dan route tetap membalas 200. Kalau dilempar ke route,
  // Telegram menganggap gagal dan terus mengirim ulang update yang sama.
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      console.error("Telegram bot error:", error);
      await ctx
        .reply("Maaf, terjadi kesalahan. Coba lagi nanti.")
        .catch(() => {});
    }
  });

  // Hanya chat pribadi; pesan dari grup dan channel diabaikan
  const pm = bot.chatType("private");

  pm.command("start", async (ctx) => {
    const code = ctx.match;
    const chatId = String(ctx.chat.id);

    if (!code) {
      const userId = await getUserIdByChat(chatId);
      await ctx.reply(userId ? "Akun kamu sudah terhubung." : BELUM_TERHUBUNG);
      return;
    }

    const userId = await linkChatWithCode(code, chatId);
    await ctx.reply(
      userId
        ? "Akun berhasil terhubung! Sekarang kamu bisa mencatat keuangan lewat chat ini."
        : "Link tidak valid atau sudah kedaluwarsa. Buat link baru dari dashboard.",
    );
  });

  pm.command("putus", async (ctx) => {
    const removed = await unlinkChat(String(ctx.chat.id));
    await ctx.reply(
      removed
        ? "Akun berhasil diputus dari chat ini."
        : "Chat ini memang belum terhubung ke akun mana pun.",
    );
  });

  // Sementara: parser LLM untuk mencatat transaksi menyusul di tahap 6 plan
  pm.on("message", async (ctx) => {
    const userId = await getUserIdByChat(String(ctx.chat.id));
    await ctx.reply(
      userId ? "Fitur mencatat lewat chat sedang disiapkan." : BELUM_TERHUBUNG,
    );
  });

  return bot;
}
