"use server";

import { getUserSessionSSR } from "../session";
import { createLinkCode, unlinkUser } from "../telegram/link";

/** Deep link untuk menghubungkan akun ke bot; berlaku 10 menit */
export async function CreateTelegramLink() {
  const session = await getUserSessionSSR();

  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!username) {
    throw new Error("TELEGRAM_BOT_USERNAME is not defined");
  }

  const code = await createLinkCode(session.user.id);
  return `https://t.me/${username}?start=${code}`;
}

export async function UnlinkTelegram() {
  const session = await getUserSessionSSR();
  await unlinkUser(session.user.id);
}
