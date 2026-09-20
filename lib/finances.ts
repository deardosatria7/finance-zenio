import { db } from "@/db";
import { pemasukan, pengeluaran } from "@/db/schema";
import { and, desc, eq, gte, ilike, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { getRateLimiter } from "./rate-limiter";
import {
  EditPemasukanSchema,
  EditPengeluaranSchema,
  PemasukanFormSchema,
  PengeluaranFormSchema,
} from "./types";

// Logika inti tanpa session: dipanggil server action (lib/actions/finances.ts) dan bot WhatsApp.
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

  // id dikembalikan supaya pemanggil (bot WhatsApp) bisa menawarkan urungkan
  const [baris] = await db
    .insert(pemasukan)
    .values({
      userId,
      nominal: data.nominal.toFixed(2),
      namaPemasukan: data.nama_pemasukan,
      kategori: data.kategori,
      createdAt: data.tanggal,
    })
    .returning({ id: pemasukan.id, createdAt: pemasukan.createdAt });

  return baris;
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

  const [baris] = await db
    .insert(pengeluaran)
    .values({
      userId,
      nominal: data.nominal.toFixed(2),
      namaPengeluaran: data.nama_pengeluaran,
      kategori: data.kategori,
      createdAt: data.tanggal,
    })
    .returning({ id: pengeluaran.id, createdAt: pengeluaran.createdAt });

  return baris;
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

/** Penyempit opsional riwayat; `dari` inklusif, `sampai` eksklusif */
export type RiwayatFilter = {
  jenis?: "pemasukan" | "pengeluaran";
  dari?: Date;
  sampai?: Date;
};

/** Transaksi terbaru dari kedua tabel, dari yang paling baru */
export async function getRiwayat(
  userId: string,
  limit = 5,
  filter: RiwayatFilter = {},
): Promise<Transaksi[]> {
  const rentang = (
    kolom: typeof pemasukan.createdAt | typeof pengeluaran.createdAt,
  ) =>
    and(
      filter.dari ? gte(kolom, filter.dari) : undefined,
      filter.sampai ? lt(kolom, filter.sampai) : undefined,
    );

  // `limit` teratas dari tiap tabel pasti memuat `limit` teratas gabungannya
  const [masuk, keluar] = await Promise.all([
    filter.jenis === "pengeluaran"
      ? []
      : db
          .select()
          .from(pemasukan)
          .where(
            and(eq(pemasukan.userId, userId), rentang(pemasukan.createdAt)),
          )
          .orderBy(desc(pemasukan.createdAt))
          .limit(limit),
    filter.jenis === "pemasukan"
      ? []
      : db
          .select()
          .from(pengeluaran)
          .where(
            and(eq(pengeluaran.userId, userId), rentang(pengeluaran.createdAt)),
          )
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

/**
 * Transaksi milik user yang namanya memuat `kataKunci`, terbaru dulu. Dipakai bot untuk
 * menyusun daftar kandidat sebelum edit/hapus — LLM tidak pernah tahu ID transaksi.
 */
export async function cariTransaksi(
  userId: string,
  kataKunci: string,
  filter: RiwayatFilter = {},
  limit = 5,
): Promise<Transaksi[]> {
  // % di kata kunci user akan jadi wildcard SQL, jadi di-escape lebih dulu
  const pola = `%${kataKunci.replace(/[\\%_]/g, "\\$&")}%`;

  const [masuk, keluar] = await Promise.all([
    filter.jenis === "pengeluaran"
      ? []
      : db
          .select()
          .from(pemasukan)
          .where(
            and(
              eq(pemasukan.userId, userId),
              ilike(pemasukan.namaPemasukan, pola),
              filter.dari ? gte(pemasukan.createdAt, filter.dari) : undefined,
              filter.sampai ? lt(pemasukan.createdAt, filter.sampai) : undefined,
            ),
          )
          .orderBy(desc(pemasukan.createdAt))
          .limit(limit),
    filter.jenis === "pemasukan"
      ? []
      : db
          .select()
          .from(pengeluaran)
          .where(
            and(
              eq(pengeluaran.userId, userId),
              ilike(pengeluaran.namaPengeluaran, pola),
              filter.dari ? gte(pengeluaran.createdAt, filter.dari) : undefined,
              filter.sampai
                ? lt(pengeluaran.createdAt, filter.sampai)
                : undefined,
            ),
          )
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

/** Perubahan sebagian; field yang tidak disebut dibiarkan apa adanya */
export type PerubahanTransaksi = {
  nama?: string;
  nominal?: number;
  kategori?: string;
  tanggal?: Date;
};

/**
 * Edit sebagian satu transaksi. Beda dengan editPemasukan/editPengeluaran yang menimpa semua
 * kolom dari form dashboard: pesan chat seperti "yang bensin tadi ternyata 60rb" hanya menyebut
 * satu kolom.
 */
export async function updateTransaksi(
  userId: string,
  jenis: "pemasukan" | "pengeluaran",
  id: number,
  perubahan: PerubahanTransaksi,
) {
  const isi = {
    nominal: perubahan.nominal?.toFixed(2),
    kategori: perubahan.kategori,
    createdAt: perubahan.tanggal,
  };

  const updated =
    jenis === "pemasukan"
      ? await db
          .update(pemasukan)
          .set({ ...isi, namaPemasukan: perubahan.nama })
          .where(and(eq(pemasukan.id, id), eq(pemasukan.userId, userId)))
          .returning({ id: pemasukan.id })
      : await db
          .update(pengeluaran)
          .set({ ...isi, namaPengeluaran: perubahan.nama })
          .where(and(eq(pengeluaran.id, id), eq(pengeluaran.userId, userId)))
          .returning({ id: pengeluaran.id });

  if (updated.length === 0) {
    throw new Error("Transaksi not found!");
  }
}
