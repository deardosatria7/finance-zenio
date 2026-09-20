// Arahkan webhook GOWA ke tunnel lokal atau ke produksi.
//
//   npx tsx scripts/set-wa-webhook.ts dev https://xxx.trycloudflare.com
//   npx tsx scripts/set-wa-webhook.ts prod
//
// Satu sesi WhatsApp cuma punya satu webhook: selama diarahkan ke tunnel, produksi tidak
// menerima pesan.

import "dotenv/config";

function butuhEnv(nama: string) {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`${nama} belum diisi di .env`);
  return nilai;
}

async function main() {
  const [mode, urlArg] = process.argv.slice(2);

  const base =
    mode === "dev"
      ? urlArg
      : mode === "prod"
        ? process.env.NEXT_PUBLIC_SITE_URL
        : undefined;

  if (!base) {
    throw new Error(
      "Pakai: set-wa-webhook.ts dev <url-tunnel> | set-wa-webhook.ts prod",
    );
  }

  const api = butuhEnv("WA_API_URL").replace(/\/+$/, "");
  const basic = Buffer.from(butuhEnv("WA_API_AUTH")).toString("base64");
  const webhook = `${base.replace(/\/+$/, "")}/api/whatsapp`;

  const status = await fetch(`${api}/app/status`, {
    headers: { Authorization: `Basic ${basic}` },
  }).then((r) => r.json());

  const deviceId = status?.results?.device_id;
  if (!deviceId) {
    throw new Error(`Tidak dapat device_id dari ${api}/app/status`);
  }

  const response = await fetch(`${api}/devices/${deviceId}/webhook`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
    },
    // Nama field mengikuti GET /devices/{id}/webhook; "url"/"secret" ditolak 400
    body: JSON.stringify({
      webhook_url: webhook,
      webhook_secret: butuhEnv("WA_WEBHOOK_SECRET"),
      webhook_events: "message",
    }),
  });

  if (!response.ok) {
    throw new Error(`GOWA balas ${response.status}: ${await response.text()}`);
  }

  console.log(`Webhook diarahkan ke ${webhook}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
