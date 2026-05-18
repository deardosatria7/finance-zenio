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

export const PemasukanFormSchema = z.object({
  nama_pemasukan: z.string().min(1, "Wajib diisi"),
  nominal: z.number().min(0, "Tidak boleh nol/negatif!"),
  kategori: z.string().min(1, "Pilih kategori"),
});

export const EditPemasukanSchema = PemasukanFormSchema.extend({
  id: z.number(),
});

export const PengeluaranFormSchema = z.object({
  nama_pengeluaran: z.string().min(1, "Wajib diisi"),
  nominal: z.number().min(0, "Tidak boleh nol/negatif!"),
  kategori: z.string().min(1, "Pilih kategori"),
});

export const EditPengeluaranSchema = PengeluaranFormSchema.extend({
  id: z.number(),
});
