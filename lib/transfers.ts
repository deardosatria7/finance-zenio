import { db } from "@/db";
import { transfer, wallet } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { getRateLimiter } from "./rate-limiter";
import { TransferFormSchema } from "./types";
import { cekWalletAktif, WalletError } from "./wallets";

// Sama seperti lib/finances.ts: tanpa session, dipanggil server action dan bot WhatsApp.
// Error untuk user dilempar sebagai WalletError supaya pesannya sampai lewat server action.

export async function addTransfer(
  userId: string,
  data: z.infer<typeof TransferFormSchema> & { tanggal?: Date },
) {
  try {
    await getRateLimiter().consume(`transfer_${userId}`);
  } catch {
    throw new WalletError("Terlalu banyak request. Coba lagi nanti.");
  }

  // Bot memanggil tanpa lewat schema form, jadi dicek ulang di sini
  if (data.dari_wallet_id === data.ke_wallet_id) {
    throw new WalletError("Wallet tujuan harus beda dengan wallet asal");
  }
  await cekWalletAktif(userId, data.dari_wallet_id);
  await cekWalletAktif(userId, data.ke_wallet_id);

  const [baris] = await db
    .insert(transfer)
    .values({
      userId,
      dariWalletId: data.dari_wallet_id,
      keWalletId: data.ke_wallet_id,
      nominal: data.nominal.toFixed(2),
      catatan: data.catatan || null,
      createdAt: data.tanggal,
    })
    .returning({ id: transfer.id, createdAt: transfer.createdAt });

  return baris;
}

export async function deleteTransfer(userId: string, id: number) {
  const deleted = await db
    .delete(transfer)
    .where(and(eq(transfer.id, id), eq(transfer.userId, userId)))
    .returning({ id: transfer.id });

  if (deleted.length === 0) throw new WalletError("Transfer tidak ditemukan");
}

const dari = alias(wallet, "dari");
const ke = alias(wallet, "ke");

/** Transfer terbaru beserta nama kedua wallet; `walletId` menyaring yang masuk atau keluar */
export async function getTransfers(
  userId: string,
  { limit = 20, walletId }: { limit?: number; walletId?: number } = {},
) {
  const rows = await db
    .select({
      id: transfer.id,
      createdAt: transfer.createdAt,
      nominal: transfer.nominal,
      catatan: transfer.catatan,
      dariNama: dari.nama,
      keNama: ke.nama,
    })
    .from(transfer)
    .innerJoin(dari, eq(dari.id, transfer.dariWalletId))
    .innerJoin(ke, eq(ke.id, transfer.keWalletId))
    .where(
      and(
        eq(transfer.userId, userId),
        walletId !== undefined
          ? or(
              eq(transfer.dariWalletId, walletId),
              eq(transfer.keWalletId, walletId),
            )
          : undefined,
      ),
    )
    .orderBy(desc(transfer.createdAt), desc(transfer.id))
    .limit(limit);

  return rows.map((r) => ({ ...r, nominal: Number(r.nominal) }));
}
