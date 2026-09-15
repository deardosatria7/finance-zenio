import { Bot, type Context } from "grammy";
import { getRiwayat, getSaldo } from "../finances";
import { formatDate, formatRupiah } from "../utils";
import { getUserIdByChat, linkChatWithCode, unlinkChat } from "./link";
import { getTelegramRateLimiter } from "../rate-limiter";
import { getRedis } from "../redis";

const BELUM_TERHUBUNG =
  "Chat ini belum terhubung ke akun finance-zenio. Buka menu Telegram di dashboard, lalu tekan Hubungkan Telegram.";

/** userId pemilik chat ini; kalau belum terhubung, balas instruksi dan kembalikan null */
async function userIdOrReply(ctx: Context) {
  const userId = ctx.chat ? await getUserIdByChat(String(ctx.chat.id)) : null;
  if (!userId) {
    await ctx.reply(BELUM_TERHUBUNG);
  }
  return userId;
}

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

  // Telegram mengirim ulang update kalau balasan lambat atau gagal. update_id yang sudah pernah
  // diproses dilewati supaya transaksi tidak tercatat dua kali.
  bot.use(async (ctx, next) => {
    const isNew = await getRedis().set(
      `tg_update:${ctx.update.update_id}`,
      "1",
      "EX",
      3600,
      "NX",
    );
    if (isNew) {
      await next();
    }
  });

  // Hanya chat pribadi; pesan dari grup dan channel diabaikan
  const pm = bot.chatType("private");

  pm.use(async (ctx, next) => {
    try {
      await getTelegramRateLimiter().consume(String(ctx.chat.id));
    } catch {
      await ctx.reply("Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.");
      return;
    }
    await next();
  });

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

  pm.command("saldo", async (ctx) => {
    const userId = await userIdOrReply(ctx);
    if (!userId) return;

    const { totalPemasukan, totalPengeluaran, saldo } = await getSaldo(userId);
    await ctx.reply(
      [
        `Saldo: ${formatRupiah(saldo)}`,
        `Total pemasukan: ${formatRupiah(totalPemasukan)}`,
        `Total pengeluaran: ${formatRupiah(totalPengeluaran)}`,
      ].join("\n"),
    );
  });

  pm.command("riwayat", async (ctx) => {
    const userId = await userIdOrReply(ctx);
    if (!userId) return;

    const riwayat = await getRiwayat(userId, 10);
    if (riwayat.length === 0) {
      await ctx.reply("Belum ada transaksi.");
      return;
    }

    const baris = riwayat.map(
      (t) =>
        `${formatDate(t.createdAt)} · ${t.nama} (${t.kategori})\n` +
        `${t.jenis === "pemasukan" ? "+" : "-"}${formatRupiah(t.nominal)}`,
    );
    await ctx.reply(
      `${riwayat.length} transaksi terakhir:\n\n${baris.join("\n\n")}`,
    );
  });

  // Sementara: parser LLM untuk mencatat transaksi menyusul di tahap 6 plan
  pm.on("message", async (ctx) => {
    const userId = await getUserIdByChat(String(ctx.chat.id));
    await ctx.reply(
      userId
        ? "Fitur mencatat lewat chat sedang disiapkan. Sementara ini coba /saldo atau /riwayat."
        : BELUM_TERHUBUNG,
    );
  });

  return bot;
}
