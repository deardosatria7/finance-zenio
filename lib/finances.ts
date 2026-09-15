import { db } from "@/db";
import { pemasukan, pengeluaran } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getRateLimiter } from "./rate-limiter";
import {
  EditPemasukanSchema,
  EditPengeluaranSchema,
  PemasukanFormSchema,
  PengeluaranFormSchema,
} from "./types";

// Logika inti tanpa session: dipanggil server action (lib/actions/finances.ts) dan bot Telegram.
// Semua query difilter userId, jadi pemanggil wajib memastikan userId milik user yang sah.

/** Tanggal transaksi; kosong = waktu sekarang */
type Tanggal = { tanggal?: Date };

// Rate limiter
async function consumerRateLimit(key: string) {
  try {
    await getRateLimiter().consume(key);
  } catch {
    throw new Error("Terlalu banyak request. Coba lagi nanti.");
  }
}

export async function addPemasukan(
  userId: string,
  data: z.infer<typeof PemasukanFormSchema> & Tanggal,
) {
  await consumerRateLimit(`pemasukan_${userId}`);

  await db.insert(pemasukan).values({
    userId,
    nominal: data.nominal.toFixed(2),
    namaPemasukan: data.nama_pemasukan,
    kategori: data.kategori,
    createdAt: data.tanggal,
  });
}

export async function editPemasukan(
  userId: string,
  data: z.infer<typeof EditPemasukanSchema> & Tanggal,
) {
  const updated = await db
    .update(pemasukan)
    .set({
      nominal: data.nominal.toFixed(2),
      namaPemasukan: data.nama_pemasukan,
      kategori: data.kategori,
      createdAt: data.tanggal,
    })
    .where(and(eq(pemasukan.id, data.id), eq(pemasukan.userId, userId)))
    .returning({ id: pemasukan.id });

  if (updated.length === 0) {
    throw new Error("Pemasukan not found!");
  }
}

export async function deletePemasukan(userId: string, id: number) {
  const deleted = await db
    .delete(pemasukan)
    .where(and(eq(pemasukan.id, id), eq(pemasukan.userId, userId)))
    .returning({ id: pemasukan.id });

  if (deleted.length === 0) {
    throw new Error("Pemasukan not found!");
  }
}

export async function addPengeluaran(
  userId: string,
  data: z.infer<typeof PengeluaranFormSchema> & Tanggal,
) {
  await consumerRateLimit(`pengeluaran_${userId}`);

  await db.insert(pengeluaran).values({
    userId,
    nominal: data.nominal.toFixed(2),
    namaPengeluaran: data.nama_pengeluaran,
    kategori: data.kategori,
    createdAt: data.tanggal,
  });
}

export async function editPengeluaran(
  userId: string,
  data: z.infer<typeof EditPengeluaranSchema> & Tanggal,
) {
  const updated = await db
    .update(pengeluaran)
    .set({
      nominal: data.nominal.toFixed(2),
      namaPengeluaran: data.nama_pengeluaran,
      kategori: data.kategori,
      createdAt: data.tanggal,
    })
    .where(and(eq(pengeluaran.id, data.id), eq(pengeluaran.userId, userId)))
    .returning({ id: pengeluaran.id });

  if (updated.length === 0) {
    throw new Error("Pengeluaran not found!");
  }
}

export async function deletePengeluaran(userId: string, id: number) {
  const deleted = await db
    .delete(pengeluaran)
    .where(and(eq(pengeluaran.id, id), eq(pengeluaran.userId, userId)))
    .returning({ id: pengeluaran.id });

  if (deleted.length === 0) {
    throw new Error("Pengeluaran not found!");
  }
}

export async function getSaldo(userId: string) {
  const [[masuk], [keluar]] = await Promise.all([
    db
      .select({ total: sql<string>`COALESCE(SUM(${pemasukan.nominal}), 0)` })
      .from(pemasukan)
      .where(eq(pemasukan.userId, userId)),
    db
      .select({ total: sql<string>`COALESCE(SUM(${pengeluaran.nominal}), 0)` })
      .from(pengeluaran)
      .where(eq(pengeluaran.userId, userId)),
  ]);

  const totalPemasukan = Number(masuk.total);
  const totalPengeluaran = Number(keluar.total);

  return {
    totalPemasukan,
    totalPengeluaran,
    saldo: totalPemasukan - totalPengeluaran,
  };
}

export type Transaksi = {
  jenis: "pemasukan" | "pengeluaran";
  id: number;
  nama: string;
  nominal: number;
  kategori: string;
  createdAt: Date;
};

/** Transaksi terbaru dari kedua tabel, dari yang paling baru */
export async function getRiwayat(
  userId: string,
  limit = 5,
): Promise<Transaksi[]> {
  // `limit` teratas dari tiap tabel pasti memuat `limit` teratas gabungannya
  const [masuk, keluar] = await Promise.all([
    db
      .select()
      .from(pemasukan)
      .where(eq(pemasukan.userId, userId))
      .orderBy(desc(pemasukan.createdAt))
      .limit(limit),
    db
      .select()
      .from(pengeluaran)
      .where(eq(pengeluaran.userId, userId))
      .orderBy(desc(pengeluaran.createdAt))
      .limit(limit),
  ]);

  return [
    ...masuk.map((p) => ({
      jenis: "pemasukan" as const,
      id: p.id,
      nama: p.namaPemasukan,
      nominal: Number(p.nominal),
      kategori: p.kategori,
      createdAt: p.createdAt,
    })),
    ...keluar.map((p) => ({
      jenis: "pengeluaran" as const,
      id: p.id,
      nama: p.namaPengeluaran,
      nominal: Number(p.nominal),
      kategori: p.kategori,
      createdAt: p.createdAt,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}
