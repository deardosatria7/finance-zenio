"use server";

import { getUserSessionSSR } from "../session";
import { createLinkCode, unlinkUser } from "../whatsapp/link";

/** Link wa.me dengan pesan HUBUNGKAN yang sudah terisi; kodenya berlaku 10 menit */
export async function CreateWhatsappLink() {
  const session = await getUserSessionSSR();

  const nomor = process.env.WA_BOT_NUMBER;
  if (!nomor) {
    throw new Error("WA_BOT_NUMBER is not defined");
  }

  const code = await createLinkCode(session.user.id);
  return `https://wa.me/${nomor}?text=${encodeURIComponent(`HUBUNGKAN ${code}`)}`;
}

export async function UnlinkWhatsapp() {
  const session = await getUserSessionSSR();
  await unlinkUser(session.user.id);
}
