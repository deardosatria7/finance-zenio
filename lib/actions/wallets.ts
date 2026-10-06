"use server";

import { z } from "zod";
import {
  EditWalletSchema,
  TransferFormSchema,
  WalletFormSchema,
} from "../types";
import { getUserSessionSSR } from "../session";
import { addTransfer, deleteTransfer } from "../transfers";
import {
  addWallet,
  arsipkanWallet,
  deleteWallet,
  editWallet,
  pulihkanWallet,
  setWalletDefault,
  WalletError,
} from "../wallets";

// Pola sama dengan ./finances.ts. Bedanya, WalletError dikembalikan sebagai nilai, bukan dilempar:
// di production Next.js menyembunyikan pesan error dari server action, padahal pesan seperti
// "Nama wallet sudah dipakai" perlu sampai ke user.

const IdSchema = z.number().int();

type HasilAksi = { error?: string };

async function jalankan(
  aksi: (userId: string) => Promise<unknown>,
): Promise<HasilAksi> {
  const session = await getUserSessionSSR();

  try {
    await aksi(session.user.id);
    return {};
  } catch (error) {
    if (error instanceof WalletError) return { error: error.message };
    throw error;
  }
}

export async function AddWallet(data: z.infer<typeof WalletFormSchema>) {
  return jalankan((userId) => addWallet(userId, WalletFormSchema.parse(data)));
}

export async function EditWallet(data: z.infer<typeof EditWalletSchema>) {
  return jalankan((userId) => editWallet(userId, EditWalletSchema.parse(data)));
}

export async function SetWalletDefault(wallet_id: number) {
  return jalankan((userId) =>
    setWalletDefault(userId, IdSchema.parse(wallet_id)),
  );
}

export async function ArsipkanWallet(wallet_id: number) {
  return jalankan((userId) =>
    arsipkanWallet(userId, IdSchema.parse(wallet_id)),
  );
}

export async function PulihkanWallet(wallet_id: number) {
  return jalankan((userId) =>
    pulihkanWallet(userId, IdSchema.parse(wallet_id)),
  );
}

export async function DeleteWallet(wallet_id: number) {
  return jalankan((userId) => deleteWallet(userId, IdSchema.parse(wallet_id)));
}

export async function AddTransfer(data: z.infer<typeof TransferFormSchema>) {
  return jalankan((userId) =>
    addTransfer(userId, TransferFormSchema.parse(data)),
  );
}

export async function DeleteTransfer(transfer_id: number) {
  return jalankan((userId) =>
    deleteTransfer(userId, IdSchema.parse(transfer_id)),
  );
}
