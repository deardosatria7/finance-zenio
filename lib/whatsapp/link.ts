import { db } from "@/db";
import { chatLink } from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getRedis } from "../redis";

// Menghubungkan akun finance-zenio dengan nomor WhatsApp lewat kode sekali pakai di Redis.

const CODE_TTL_SECONDS = 600;

function codeKey(code: string) {
  return `wa_link:${code}`;
}

/** Identitas pengirim yang mungkin dipakai; WhatsApp bisa mengirim JID nomor, LID, atau keduanya */
function identitas(jid: string, lid: string | null) {
  return lid && lid !== jid ? [jid, lid] : [jid];
}

/** Buat kode untuk link wa.me; berlaku 10 menit */
export async function createLinkCode(userId: string) {
  // Hex saja supaya aman diletakkan di query string wa.me tanpa encoding tambahan
  const code = randomBytes(8).toString("hex");
  await getRedis().set(codeKey(code), userId, "EX", CODE_TTL_SECONDS);
  return code;
}

/** Tukar kode dengan link akun; null kalau kode salah atau kedaluwarsa */
export async function linkChatWithCode(
  code: string,
  jid: string,
  lid: string | null,
) {
  // GETDEL mengambil sekaligus menghapus, jadi satu kode tidak bisa dipakai dua kali
  const userId = await getRedis().getdel(codeKey(code));
  if (!userId) return null;

  const dipakai = identitas(jid, lid);

  await db.transaction(async (tx) => {
    // Lepas link lama akun ini atau nomor ini dulu, supaya unique constraint tidak bentrok
    await tx
      .delete(chatLink)
      .where(
        or(
          eq(chatLink.userId, userId),
          inArray(chatLink.chatId, dipakai),
          inArray(chatLink.chatLid, dipakai),
        ),
      );
    await tx.insert(chatLink).values({ userId, chatId: jid, chatLid: lid });
  });

  return userId;
}

/**
 * Pemilik nomor ini. Kedua kolom dicocokkan dengan kedua identitas karena user yang
 * menyembunyikan nomornya bisa datang sebagai LID saja, dan bisa berubah di kemudian hari.
 */
export async function getUserIdByChat(jid: string, lid: string | null) {
  const dipakai = identitas(jid, lid);

  const [link] = await db
    .select({ userId: chatLink.userId })
    .from(chatLink)
    .where(
      or(inArray(chatLink.chatId, dipakai), inArray(chatLink.chatLid, dipakai)),
    )
    .limit(1);

  return link?.userId ?? null;
}

export async function getLinkByUser(userId: string) {
  const [link] = await db
    .select({ createdAt: chatLink.createdAt, chatId: chatLink.chatId })
    .from(chatLink)
    .where(eq(chatLink.userId, userId))
    .limit(1);

  return link ?? null;
}

export async function unlinkUser(userId: string) {
  await db.delete(chatLink).where(eq(chatLink.userId, userId));
}

/** Dipakai perintah PUTUS; false kalau nomor ini memang belum terhubung */
export async function unlinkChat(jid: string, lid: string | null) {
  const dipakai = identitas(jid, lid);

  const deleted = await db
    .delete(chatLink)
    .where(
      or(inArray(chatLink.chatId, dipakai), inArray(chatLink.chatLid, dipakai)),
    )
    .returning({ id: chatLink.id });

  return deleted.length > 0;
}
