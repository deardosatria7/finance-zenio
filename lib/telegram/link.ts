import { db } from "@/db";
import { telegramLink } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { getRedis } from "../redis";

// Menghubungkan akun finance-zenio dengan chat Telegram lewat kode sekali pakai di Redis.

const CODE_TTL_SECONDS = 600;

function codeKey(code: string) {
  return `tg_link:${code}`;
}

/** Buat kode untuk deep link t.me/<bot>?start=<kode>; berlaku 10 menit */
export async function createLinkCode(userId: string) {
  // base64url hanya memakai A-Z a-z 0-9 _ -, karakter yang diizinkan parameter /start
  const code = randomBytes(16).toString("base64url");
  await getRedis().set(codeKey(code), userId, "EX", CODE_TTL_SECONDS);
  return code;
}

/** Tukar kode dengan link akun; null kalau kode salah atau kedaluwarsa */
export async function linkChatWithCode(code: string, chatId: string) {
  // GETDEL mengambil sekaligus menghapus, jadi satu kode tidak bisa dipakai dua kali
  const userId = await getRedis().getdel(codeKey(code));
  if (!userId) return null;

  await db.transaction(async (tx) => {
    // Lepas link lama akun ini atau chat ini dulu, supaya unique constraint tidak bentrok
    await tx
      .delete(telegramLink)
      .where(
        or(eq(telegramLink.userId, userId), eq(telegramLink.chatId, chatId)),
      );
    await tx.insert(telegramLink).values({ userId, chatId });
  });

  return userId;
}

export async function getUserIdByChat(chatId: string) {
  const [link] = await db
    .select({ userId: telegramLink.userId })
    .from(telegramLink)
    .where(eq(telegramLink.chatId, chatId))
    .limit(1);

  return link?.userId ?? null;
}

export async function getLinkByUser(userId: string) {
  const [link] = await db
    .select({ createdAt: telegramLink.createdAt })
    .from(telegramLink)
    .where(eq(telegramLink.userId, userId))
    .limit(1);

  return link ?? null;
}

export async function unlinkUser(userId: string) {
  await db.delete(telegramLink).where(eq(telegramLink.userId, userId));
}

/** Dipakai perintah /putus; false kalau chat ini memang belum terhubung */
export async function unlinkChat(chatId: string) {
  const deleted = await db
    .delete(telegramLink)
    .where(eq(telegramLink.chatId, chatId))
    .returning({ id: telegramLink.id });

  return deleted.length > 0;
}
