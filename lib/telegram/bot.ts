import { Bot, InlineKeyboard, type Context } from "grammy";
import {
  addPemasukan,
  addPengeluaran,
  deletePemasukan,
  deletePengeluaran,
  getRiwayat,
  getSaldo,
  type RiwayatFilter,
} from "../finances";
import { formatRupiah } from "../utils";
import { getUserIdByChat, linkChatWithCode, unlinkChat } from "./link";
import { getTelegramRateLimiter } from "../rate-limiter";
import { getRedis } from "../redis";
import { normalkanKategori, parseIntent, type Intent } from "./intent";
import {
  awalHariWIB,
  formatTanggalWIB,
  setelahHariWIB,
  tanggalKeDate,
} from "./waktu";

const BELUM_TERHUBUNG =
  "Chat ini belum terhubung ke akun finance-zenio. Buka menu Telegram di dashboard, lalu tekan Hubungkan Telegram.";

const TIDAK_PAHAM =
  "Maaf, aku belum paham. Contoh: makan siang 25rb, gajian 8,5jt, saldo, atau riwayat.";

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

async function balasSaldo(ctx: Context, userId: string) {
  const { totalPemasukan, totalPengeluaran, saldo } = await getSaldo(userId);
  await ctx.reply(
    [
      `Saldo: ${formatRupiah(saldo)}`,
      `Total pemasukan: ${formatRupiah(totalPemasukan)}`,
      `Total pengeluaran: ${formatRupiah(totalPengeluaran)}`,
    ].join("\n"),
  );
}

async function balasRiwayat(
  ctx: Context,
  userId: string,
  filter: RiwayatFilter = {},
) {
  const riwayat = await getRiwayat(userId, 10, filter);
  if (riwayat.length === 0) {
    await ctx.reply("Belum ada transaksi.");
    return;
  }

  const baris = riwayat.map(
    (t) =>
      `${formatTanggalWIB(t.createdAt)} · ${t.nama} (${t.kategori})\n` +
      `${t.jenis === "pemasukan" ? "+" : "-"}${formatRupiah(t.nominal)}`,
  );
  await ctx.reply(
    `${riwayat.length} transaksi terakhir:\n\n${baris.join("\n\n")}`,
  );
}

/** Simpan transaksi hasil intent `tambah`, balas ringkasan + tombol urungkan */
async function simpanTambah(
  ctx: Context,
  userId: string,
  intent: Extract<Intent, { aksi: "tambah" }>,
) {
  const kategori = normalkanKategori(intent.jenis, intent.kategori);
  const tanggal = tanggalKeDate(intent.tanggal);

  const baris =
    intent.jenis === "pemasukan"
      ? await addPemasukan(userId, {
          nama_pemasukan: intent.nama,
          nominal: intent.nominal,
          kategori,
          tanggal,
        })
      : await addPengeluaran(userId, {
          nama_pengeluaran: intent.nama,
          nominal: intent.nominal,
          kategori,
          tanggal,
        });

  const tanda = intent.jenis === "pemasukan" ? "+" : "-";
  await ctx.reply(
    `Tercatat: ${intent.nama} ${tanda}${formatRupiah(intent.nominal)} (${kategori}), ` +
      formatTanggalWIB(baris.createdAt),
    {
      reply_markup: new InlineKeyboard().text(
        "Urungkan",
        `undo:${intent.jenis}:${baris.id}`,
      ),
    },
  );
}

async function jalankanIntent(ctx: Context, userId: string, intent: Intent) {
  switch (intent.aksi) {
    case "tambah":
      await simpanTambah(ctx, userId, intent);
      return;
    case "saldo":
      await balasSaldo(ctx, userId);
      return;
    case "riwayat":
      await balasRiwayat(ctx, userId, {
        jenis: intent.jenis,
        dari: intent.dari ? awalHariWIB(intent.dari) : undefined,
        sampai: intent.sampai ? setelahHariWIB(intent.sampai) : undefined,
      });
      return;
    case "edit":
    case "hapus":
      // Menyusul di tahap 7 (butuh pencarian kandidat + konfirmasi tombol)
      await ctx.reply(
        "Edit dan hapus lewat chat belum tersedia. Sementara ini ubah lewat dashboard, " +
          "atau tekan Urungkan kalau transaksinya baru saja dicatat.",
      );
      return;
    case "tidak_dikenal":
      await ctx.reply(TIDAK_PAHAM);
  }
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
    await balasSaldo(ctx, userId);
  });

  pm.command("riwayat", async (ctx) => {
    const userId = await userIdOrReply(ctx);
    if (!userId) return;
    await balasRiwayat(ctx, userId);
  });

  // Tombol Urungkan pada balasan transaksi yang baru dicatat
  pm.callbackQuery(/^undo:(pemasukan|pengeluaran):(\d+)$/, async (ctx) => {
    const userId = await getUserIdByChat(String(ctx.chat.id));
    if (!userId) {
      await ctx.answerCallbackQuery(BELUM_TERHUBUNG);
      return;
    }

    const [, jenis, id] = ctx.match;

    try {
      // Kepemilikan dicek ulang di WHERE service, bukan dipercaya dari callback data
      if (jenis === "pemasukan") {
        await deletePemasukan(userId, Number(id));
      } else {
        await deletePengeluaran(userId, Number(id));
      }
    } catch {
      await ctx.answerCallbackQuery("Transaksi sudah tidak ada.");
      return;
    }

    await ctx.editMessageText("Dibatalkan, transaksi dihapus.");
    await ctx.answerCallbackQuery("Dibatalkan");
  });

  pm.on("message:text", async (ctx) => {
    const userId = await userIdOrReply(ctx);
    if (!userId) return;

    // Parsing LLM bisa beberapa detik; kasih tanda bot sedang mengetik
    await ctx.replyWithChatAction("typing").catch(() => {});

    const intent = await parseIntent(ctx.message.text);
    if (!intent) {
      await ctx.reply(TIDAK_PAHAM);
      return;
    }

    await jalankanIntent(ctx, userId, intent);
  });

  return bot;
}
