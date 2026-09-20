// Klien REST go-whatsapp-web-multidevice (GOWA). Satu-satunya jalan keluar bot ke WhatsApp.

const TIMEOUT_MS = 10_000;

/** Dibaca saat dipakai, bukan saat modul dimuat, supaya `next build` jalan tanpa env WhatsApp */
function konfigurasi() {
  const url = process.env.WA_API_URL;
  const auth = process.env.WA_API_AUTH;
  if (!url || !auth) {
    throw new Error("WA_API_URL dan WA_API_AUTH wajib diisi");
  }

  return {
    url: url.replace(/\/+$/, ""),
    basic: Buffer.from(auth).toString("base64"),
  };
}

async function panggil(path: string, body: Record<string, unknown>) {
  const { url, basic } = konfigurasi();

  const response = await fetch(`${url}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`GOWA ${path} balas ${response.status}`);
  }
}

/**
 * Kirim balasan ke satu chat. Kegagalan di-log, tidak dilempar: pemanggil tidak punya cara lain
 * menghubungi user, dan melempar di sini malah membatalkan sisa handler.
 */
export async function kirimPesan(jid: string, teks: string) {
  try {
    await panggil("/send/message", { phone: jid, message: teks });
  } catch (error) {
    // Isi pesan tidak ikut di-log
    console.error("Gagal kirim WhatsApp:", error);
  }
}

/** Indikator "sedang mengetik" selama parsing LLM berjalan */
export async function setTyping(jid: string, aktif: boolean) {
  try {
    await panggil("/send/chat-presence", {
      phone: jid,
      action: aktif ? "start" : "stop",
    });
  } catch {
    // Kosmetik saja, gagal pun tidak masalah
  }
}
