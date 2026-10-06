import { db } from "@/db";
import { pemasukan, pengeluaran, wallet } from "@/db/schema";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { EditWalletSchema, WalletFormSchema } from "./types";

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

/** Error yang pesannya aman dan memang untuk ditampilkan ke user */
export class WalletError extends Error {}

/** Kode error Postgres; drizzle membungkus error driver di `cause` */
function kodePostgres(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  return (error.cause as { code?: string } | undefined)?.code;
}

/** Bentrok index nama jadi pesan yang ramah; error lain diteruskan apa adanya */
function errorNamaWallet(error: unknown) {
  return kodePostgres(error) === UNIQUE_VIOLATION
    ? new WalletError("Nama wallet sudah dipakai")
    : error;
}

const URUTAN_WALLET = [desc(wallet.isDefault), asc(sql`lower(${wallet.nama})`)];
const cariDefault = (userId: string) =>
  db.query.wallet.findFirst({
    where: and(eq(wallet.userId, userId), eq(wallet.isDefault, true)),
  });

/** Wallet default user; dibuat ("Utama") kalau belum ada */
export async function pastikanWalletDefault(userId: string) {
  const ada = await cariDefault(userId);
  if (ada) return ada;

  // User yang daftar setelah migrasi (termasuk lewat pintarpy) belum punya wallet. Kalau dua
  // request bersamaan, yang kalah ditolak partial unique index lalu ikut membaca hasil yang menang.
  await db
    .insert(wallet)
    .values({ userId, nama: "Utama", isDefault: true })
    .onConflictDoNothing();

  const baru = await cariDefault(userId);
  if (!baru) throw new WalletError("Gagal membuat wallet default");
  return baru;
}

export async function getWallets(
  userId: string,
  { termasukArsip = false } = {},
) {
  await pastikanWalletDefault(userId);

  return db.query.wallet.findMany({
    where: and(
      eq(wallet.userId, userId),
      termasukArsip ? undefined : isNull(wallet.archivedAt),
    ),
    orderBy: URUTAN_WALLET,
    // Hanya kolom yang dibutuhkan UI, karena hasilnya ikut dikirim ke client component
    columns: { id: true, nama: true, isDefault: true, archivedAt: true },
  });
}

/** Semua wallet (termasuk arsip) beserta saldonya: saldo awal + pemasukan − pengeluaran */
export async function getSaldoPerWallet(userId: string) {
  await pastikanWalletDefault(userId);

  const masuk = db
    .select({
      walletId: pemasukan.walletId,
      total: sql<string>`sum(${pemasukan.nominal})`.as("total_masuk"),
    })
    .from(pemasukan)
    .where(eq(pemasukan.userId, userId))
    .groupBy(pemasukan.walletId)
    .as("masuk");

  const keluar = db
    .select({
      walletId: pengeluaran.walletId,
      total: sql<string>`sum(${pengeluaran.nominal})`.as("total_keluar"),
    })
    .from(pengeluaran)
    .where(eq(pengeluaran.userId, userId))
    .groupBy(pengeluaran.walletId)
    .as("keluar");

  const rows = await db
    .select({
      id: wallet.id,
      nama: wallet.nama,
      isDefault: wallet.isDefault,
      archivedAt: wallet.archivedAt,
      saldoAwal: wallet.saldoAwal,
      saldo: sql<string>`${wallet.saldoAwal} + coalesce(${masuk.total}, 0) - coalesce(${keluar.total}, 0)`,
    })
    .from(wallet)
    .leftJoin(masuk, eq(masuk.walletId, wallet.id))
    .leftJoin(keluar, eq(keluar.walletId, wallet.id))
    .where(eq(wallet.userId, userId))
    .orderBy(...URUTAN_WALLET);

  return rows.map((r) => ({
    ...r,
    saldoAwal: Number(r.saldoAwal),
    saldo: Number(r.saldo),
  }));
}

/**
 * Lempar error kalau wallet bukan milik user atau sudah diarsipkan. Dipanggil sebelum menulis
 * transaksi supaya pesannya ramah; composite FK tetap jadi pengaman terakhir.
 */
export async function cekWalletAktif(userId: string, walletId: number) {
  const ada = await db.query.wallet.findFirst({
    columns: { id: true },
    where: and(
      eq(wallet.id, walletId),
      eq(wallet.userId, userId),
      isNull(wallet.archivedAt),
    ),
  });

  if (!ada) throw new WalletError("Wallet tidak ditemukan");
}

export async function addWallet(
  userId: string,
  data: z.infer<typeof WalletFormSchema>,
) {
  // Default dibuat dulu, supaya wallet pertama yang ditambah user tidak merebut nama "Utama"
  await pastikanWalletDefault(userId);

  const [baris] = await db
    .insert(wallet)
    .values({
      userId,
      nama: data.nama,
      saldoAwal: data.saldo_awal.toFixed(2),
    })
    .returning({ id: wallet.id })
    .catch((error) => {
      throw errorNamaWallet(error);
    });

  return baris;
}

export async function editWallet(
  userId: string,
  data: z.infer<typeof EditWalletSchema>,
) {
  const updated = await db
    .update(wallet)
    .set({ nama: data.nama, saldoAwal: data.saldo_awal.toFixed(2) })
    .where(and(eq(wallet.id, data.id), eq(wallet.userId, userId)))
    .returning({ id: wallet.id })
    .catch((error) => {
      throw errorNamaWallet(error);
    });

  if (updated.length === 0) throw new WalletError("Wallet tidak ditemukan");
}

export async function setWalletDefault(userId: string, id: number) {
  await db.transaction(async (tx) => {
    const target = await tx.query.wallet.findFirst({
      columns: { id: true },
      where: and(
        eq(wallet.id, id),
        eq(wallet.userId, userId),
        isNull(wallet.archivedAt),
      ),
    });
    if (!target) throw new WalletError("Wallet tidak ditemukan");

    // Lepas default lama dulu; partial unique index menolak dua default sekaligus
    await tx
      .update(wallet)
      .set({ isDefault: false })
      .where(and(eq(wallet.userId, userId), eq(wallet.isDefault, true)));

    await tx
      .update(wallet)
      .set({ isDefault: true })
      .where(and(eq(wallet.id, id), eq(wallet.userId, userId)));
  });
}

/** Wallet default tidak bisa diarsipkan; pindahkan default ke wallet lain dulu */
export async function arsipkanWallet(userId: string, id: number) {
  const updated = await db
    .update(wallet)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(wallet.id, id),
        eq(wallet.userId, userId),
        eq(wallet.isDefault, false),
      ),
    )
    .returning({ id: wallet.id });

  if (updated.length === 0) {
    throw new WalletError("Wallet tidak ditemukan atau masih jadi default");
  }
}

export async function pulihkanWallet(userId: string, id: number) {
  const updated = await db
    .update(wallet)
    .set({ archivedAt: null })
    .where(and(eq(wallet.id, id), eq(wallet.userId, userId)))
    .returning({ id: wallet.id });

  if (updated.length === 0) throw new WalletError("Wallet tidak ditemukan");
}

/** Hanya wallet tanpa transaksi; yang masih punya transaksi ditolak FK dan harus diarsipkan */
export async function deleteWallet(userId: string, id: number) {
  const deleted = await db
    .delete(wallet)
    .where(
      and(
        eq(wallet.id, id),
        eq(wallet.userId, userId),
        eq(wallet.isDefault, false),
      ),
    )
    .returning({ id: wallet.id })
    .catch((error) => {
      if (kodePostgres(error) === FOREIGN_KEY_VIOLATION) {
        throw new WalletError("Wallet masih punya transaksi, arsipkan saja");
      }
      throw error;
    });

  if (deleted.length === 0) {
    throw new WalletError("Wallet tidak ditemukan atau masih jadi default");
  }
}
