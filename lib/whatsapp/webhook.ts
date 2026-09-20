import { createHmac, timingSafeEqual } from "node:crypto";

// Verifikasi dan pembacaan payload webhook GOWA. Tidak ada akses DB di sini.

export type PesanMasuk = {
  /** ID pesan WhatsApp, dipakai untuk membuang update duplikat */
  id: string;
  teks: string;
  /** Identitas pengirim; bisa JID nomor telepon atau LID */
  jid: string;
  /** LID pengirim kalau disertakan */
  lid: string | null;
  /** Chat tujuan balasan */
  balasKe: string;
};

/**
 * Cocokkan X-Hub-Signature-256 dengan HMAC dari raw body.
 *
 * GOWA tetap menandatangani walau secret di sisinya dibiarkan kosong (pakai default "secret"),
 * jadi verifikasi ini selalu aktif. HMAC dihitung dari byte asli request, bukan hasil
 * JSON.stringify ulang.
 */
export function verifikasiTandaTangan(raw: string, header: string | null) {
  const secret = process.env.WA_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("WA_WEBHOOK_SECRET belum diset di environment runtime.");
  }
  if (!header) return false;

  const diharapkan =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");

  const a = Buffer.from(header);
  const b = Buffer.from(diharapkan);

  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chat yang bukan percakapan pribadi */
function chatMassal(chatId: string) {
  return (
    chatId.endsWith("@g.us") ||
    chatId.endsWith("@broadcast") ||
    chatId.endsWith("@newsletter")
  );
}

/**
 * Pesan teks pribadi dari payload, atau null kalau tidak perlu diproses: event selain "message",
 * pesan kiriman bot sendiri (tanpa filter ini bot membalas dirinya terus-menerus), chat grup,
 * atau pesan tanpa teks.
 */
export function bacaPesan(raw: string): PesanMasuk | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }

  const { event, payload } = (body ?? {}) as {
    event?: unknown;
    payload?: Record<string, unknown>;
  };

  if (event !== "message" || !payload) return null;
  if (payload.is_from_me === true) return null;

  const balasKe = payload.chat_id;
  const id = payload.id;
  if (typeof balasKe !== "string" || typeof id !== "string") return null;
  if (chatMassal(balasKe)) return null;

  const teks = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!teks) return null;

  const from = typeof payload.from === "string" ? payload.from : balasKe;
  const fromLid =
    typeof payload.from_lid === "string" ? payload.from_lid : null;

  return { id, teks, jid: from, lid: fromLid, balasKe };
}
