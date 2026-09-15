// Pasang atau cek webhook bot Telegram:
//   npx tsx scripts/set-telegram-webhook.ts https://xxx.trycloudflare.com   arahkan ke tunnel lokal
//   npx tsx scripts/set-telegram-webhook.ts prod                            arahkan kembali ke produksi
//   npx tsx scripts/set-telegram-webhook.ts info                            lihat webhook sekarang
// Dev dan produksi memakai bot yang sama: selama diarahkan ke tunnel, bot produksi tidak menerima pesan.
import "dotenv/config";
import { Api } from "grammy";

const PROD_URL = process.env.PRODUCTION_URL ?? "https://keuangan.zenio.id";

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN dan TELEGRAM_WEBHOOK_SECRET wajib diisi di .env",
    );
  }

  const api = new Api(token);
  const arg = process.argv[2];

  if (!arg || arg === "info") {
    const info = await api.getWebhookInfo();
    console.log({
      url: info.url || "(kosong)",
      pending: info.pending_update_count,
      lastError: info.last_error_message ?? null,
    });
    return;
  }

  const baseUrl = new URL(arg === "prod" ? PROD_URL : arg);
  if (baseUrl.protocol !== "https:") {
    throw new Error("Telegram hanya menerima webhook https");
  }
  const url = new URL("/api/telegram", baseUrl).toString();

  await api.setWebhook(url, {
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  });

  // Menu yang muncul saat user mengetik "/" di chat bot
  await api.setMyCommands([
    { command: "saldo", description: "Cek saldo saat ini" },
    { command: "riwayat", description: "10 transaksi terakhir" },
    { command: "putus", description: "Putuskan akun dari chat ini" },
  ]);
  console.log(`Webhook diarahkan ke ${url}, menu command diperbarui`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
