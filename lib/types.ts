import { InferSelectModel } from "drizzle-orm";
import { pemasukan, pengeluaran } from "@/db/schema";
import { z } from "zod";

export type Pemasukan = InferSelectModel<typeof pemasukan>;
export type Pengeluaran = InferSelectModel<typeof pengeluaran>;

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

// Tipenya tetap string (kolom DB teks bebas), tapi nilainya harus dari daftar
const kategoriDari = (daftar: readonly string[]) =>
  z.string().refine((k) => daftar.includes(k), "Pilih kategori");

export const PemasukanFormSchema = z.object({
  nama_pemasukan: NamaSchema,
  nominal: NominalSchema,
  kategori: kategoriDari(KATEGORI_PEMASUKAN),
});

export const EditPemasukanSchema = PemasukanFormSchema.extend({
  id: IdSchema,
});

export const PengeluaranFormSchema = z.object({
  nama_pengeluaran: NamaSchema,
  nominal: NominalSchema,
  kategori: kategoriDari(KATEGORI_PENGELUARAN),
});

export const EditPengeluaranSchema = PengeluaranFormSchema.extend({
  id: IdSchema,
});
