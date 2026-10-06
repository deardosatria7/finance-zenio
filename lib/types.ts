import { InferSelectModel } from "drizzle-orm";
import { pemasukan, pengeluaran, wallet } from "@/db/schema";
import { z } from "zod";

export type Pemasukan = InferSelectModel<typeof pemasukan>;
export type Pengeluaran = InferSelectModel<typeof pengeluaran>;
export type Wallet = InferSelectModel<typeof wallet>;
/** Data wallet yang dikirim ke pilihan wallet di form transaksi */
export type WalletPilihan = Pick<Wallet, "id" | "nama" | "isDefault">;

export const KATEGORI_PEMASUKAN = [
  "Gaji",
  "Bisnis",
  "Investasi",
  "Freelance",
  "Hadiah",
  "Lainnya",
] as const;

export const KATEGORI_PENGELUARAN = [
  "Makanan & Minuman",
  "Transportasi",
  "Kesehatan",
  "Hiburan",
  "Belanja",
  "Tagihan & Utilitas",
  "Pendidikan",
  "Lainnya",
] as const;

export const MAX_NAMA = 100;
// Kolom numeric(15,2) menampung sampai 13 digit sebelum koma; angka di atasnya bikin error DB
export const MAX_NOMINAL = 1_000_000_000_000;

const NamaSchema = z
  .string()
  .trim()
  .min(1, "Wajib diisi")
  .max(MAX_NAMA, `Maksimal ${MAX_NAMA} karakter`);

const NominalSchema = z
  .number()
  .positive("Tidak boleh nol/negatif!")
  .max(MAX_NOMINAL, "Nominal terlalu besar");

const IdSchema = z.number().int().positive();
const WalletIdSchema = z.number({ error: "Pilih wallet" }).int().positive();

// Tipenya tetap string (kolom DB teks bebas), tapi nilainya harus dari daftar
const kategoriDari = (daftar: readonly string[]) =>
  z.string().refine((k) => daftar.includes(k), "Pilih kategori");

export const PemasukanFormSchema = z.object({
  nama_pemasukan: NamaSchema,
  nominal: NominalSchema,
  kategori: kategoriDari(KATEGORI_PEMASUKAN),
  wallet_id: WalletIdSchema,
});

export const EditPemasukanSchema = PemasukanFormSchema.extend({
  id: IdSchema,
});

export const PengeluaranFormSchema = z.object({
  nama_pengeluaran: NamaSchema,
  nominal: NominalSchema,
  kategori: kategoriDari(KATEGORI_PENGELUARAN),
  wallet_id: WalletIdSchema,
});

export const EditPengeluaranSchema = PengeluaranFormSchema.extend({
  id: IdSchema,
});

export const MAX_NAMA_WALLET = 50;

export const WalletFormSchema = z.object({
  nama: z
    .string()
    .trim()
    .min(1, "Wajib diisi")
    .max(MAX_NAMA_WALLET, `Maksimal ${MAX_NAMA_WALLET} karakter`),
  // Saldo boleh nol, namun tidak boleh negatif
  saldo_awal: z
    .number()
    .min(0, "Tidak boleh negatif")
    .max(MAX_NOMINAL, "Nominal terlalu besar"),
});

export const EditWalletSchema = WalletFormSchema.extend({
  id: IdSchema,
});

export const TransferFormSchema = z
  .object({
    dari_wallet_id: WalletIdSchema,
    ke_wallet_id: WalletIdSchema,
    nominal: NominalSchema,
    catatan: z
      .string()
      .trim()
      .max(MAX_NAMA, `Maksimal ${MAX_NAMA} karakter`)
      .optional(),
  })
  .refine((t) => t.dari_wallet_id !== t.ke_wallet_id, {
    message: "Wallet tujuan harus beda dengan wallet asal",
    path: ["ke_wallet_id"],
  });
