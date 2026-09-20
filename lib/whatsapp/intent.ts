import { z } from "zod";
import { chatCompletion } from "../llm";
import { KATEGORI_PEMASUKAN, KATEGORI_PENGELUARAN } from "../types";
import { hariIniLengkapWIB, hariIniWIB } from "./waktu";

// Menerjemahkan pesan bebas jadi intent terstruktur. LLM tidak dipercaya: hasilnya selalu
// divalidasi zod, dan aksinya tetap dijalankan service yang memfilter userId.

/** Pesan lebih panjang dari ini dipotong sebelum dikirim ke LLM */
const MAX_PESAN = 500;

const JenisSchema = z.enum(["pemasukan", "pengeluaran"]);

/** "YYYY-MM-DD" yang masuk akal: tidak di masa depan, maksimal 1 tahun ke belakang */
const TanggalSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((ymd) => {
    const hariIni = hariIniWIB();
    const setahunLalu = new Date(`${hariIni}T00:00:00Z`);
    setahunLalu.setUTCFullYear(setahunLalu.getUTCFullYear() - 1);

    return ymd <= hariIni && ymd >= setahunLalu.toISOString().slice(0, 10);
  }, "tanggal di luar rentang wajar");

// LLM sering mengisi field kosong dengan null, "", atau melewatkannya sama sekali
const Opsional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

const NominalSchema = z.coerce.number().positive();
const KategoriSchema = z.string().min(1);

const IntentSchema = z.discriminatedUnion("aksi", [
  z.object({
    aksi: z.literal("tambah"),
    jenis: JenisSchema,
    nama: z.string().min(1),
    nominal: NominalSchema,
    kategori: Opsional(KategoriSchema),
    tanggal: Opsional(TanggalSchema),
  }),
  z.object({
    aksi: z.literal("edit"),
    jenis: Opsional(JenisSchema),
    kataKunci: z.string().min(1),
    tanggal: Opsional(TanggalSchema),
    perubahan: z.object({
      nama: Opsional(z.string().min(1)),
      nominal: Opsional(NominalSchema),
      kategori: Opsional(KategoriSchema),
      tanggal: Opsional(TanggalSchema),
    }),
  }),
  z.object({
    aksi: z.literal("hapus"),
    jenis: Opsional(JenisSchema),
    kataKunci: z.string().min(1),
    tanggal: Opsional(TanggalSchema),
  }),
  z.object({ aksi: z.literal("saldo") }),
  z.object({
    aksi: z.literal("riwayat"),
    jenis: Opsional(JenisSchema),
    dari: Opsional(TanggalSchema),
    sampai: Opsional(TanggalSchema),
  }),
  z.object({ aksi: z.literal("tidak_dikenal") }),
]);

export type Intent = z.infer<typeof IntentSchema>;

function systemPrompt() {
  return `Kamu mesin pengurai pesan pencatat keuangan pribadi berbahasa Indonesia.
Hari ini: ${hariIniLengkapWIB()} (WIB).

Jawab HANYA satu objek JSON, tanpa penjelasan dan tanpa blok kode.

Bentuk JSON sesuai "aksi":
- {"aksi":"tambah","jenis":"pemasukan|pengeluaran","nama":string,"nominal":number,"kategori":string,"tanggal":"YYYY-MM-DD"|null}
- {"aksi":"edit","jenis":"pemasukan|pengeluaran"|null,"kataKunci":string,"tanggal":"YYYY-MM-DD"|null,"perubahan":{"nama"?:string,"nominal"?:number,"kategori"?:string,"tanggal"?:"YYYY-MM-DD"}}
- {"aksi":"hapus","jenis":"pemasukan|pengeluaran"|null,"kataKunci":string,"tanggal":"YYYY-MM-DD"|null}
- {"aksi":"saldo"}
- {"aksi":"riwayat","jenis":"pemasukan|pengeluaran"|null,"dari":"YYYY-MM-DD"|null,"sampai":"YYYY-MM-DD"|null}
- {"aksi":"tidak_dikenal"}  (kalau pesan tidak ada hubungannya dengan keuangan)

Aturan:
- Nominal jadi angka penuh tanpa pemisah: "25rb"=25000, "25k"=25000, "1,5jt"=1500000, "8,5jt"=8500000.
- Kategori pengeluaran harus salah satu dari: ${KATEGORI_PENGELUARAN.join(", ")}.
- Kategori pemasukan harus salah satu dari: ${KATEGORI_PEMASUKAN.join(", ")}.
- Kalau ragu, pakai "Lainnya".
- "nama" itu ringkasan singkat transaksinya, bukan kalimat utuh.
- Tanggal selalu "YYYY-MM-DD" menurut WIB, null kalau tidak disebut (artinya hari ini).
  "kemarin" = sehari sebelum hari ini. "Senin kemarin" = hari Senin terakhir yang sudah lewat.
  "tanggal 3" = tanggal 3 bulan berjalan kalau sudah lewat, kalau belum berarti bulan lalu.
  Tanggal tidak boleh di masa depan.

Contoh:
"makan siang 25rb" -> {"aksi":"tambah","jenis":"pengeluaran","nama":"Makan siang","nominal":25000,"kategori":"Makanan & Minuman","tanggal":null}
"bensin 50rb kemarin" -> {"aksi":"tambah","jenis":"pengeluaran","nama":"Bensin","nominal":50000,"kategori":"Transportasi","tanggal":"<tanggal kemarin>"}
"gajian 8,5jt" -> {"aksi":"tambah","jenis":"pemasukan","nama":"Gaji","nominal":8500000,"kategori":"Gaji","tanggal":null}
"yang bensin tadi ternyata 60rb" -> {"aksi":"edit","jenis":"pengeluaran","kataKunci":"bensin","tanggal":null,"perubahan":{"nominal":60000}}
"ganti kategori kopi jadi hiburan" -> {"aksi":"edit","jenis":"pengeluaran","kataKunci":"kopi","tanggal":null,"perubahan":{"kategori":"Hiburan"}}
"hapus parkir kemarin" -> {"aksi":"hapus","jenis":"pengeluaran","kataKunci":"parkir","tanggal":"<tanggal kemarin>"}
"sisa duitku berapa" -> {"aksi":"saldo"}
"pengeluaran minggu ini" -> {"aksi":"riwayat","jenis":"pengeluaran","dari":"<senin minggu ini>","sampai":"${hariIniWIB()}"}
"halo apa kabar" -> {"aksi":"tidak_dikenal"}`;
}

/** Objek JSON pertama dalam teks; null kalau tidak ada yang kurung kurawalnya seimbang */
function objekJsonPertama(text: string): string | null {
  // Model reasoning membungkus pikirannya di <think>...</think>, buang dulu supaya kurawal
  // di dalamnya tidak ikut terbaca
  const bersih = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  const mulai = bersih.indexOf("{");
  if (mulai === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = mulai; i < bersih.length; i++) {
    const c = bersih[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }

    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return bersih.slice(mulai, i + 1);
  }

  return null;
}

/** Kategori di luar daftar (atau tidak diisi) jadi "Lainnya" */
export function normalkanKategori(
  jenis: "pemasukan" | "pengeluaran",
  kategori: string | undefined,
) {
  const daftar: readonly string[] =
    jenis === "pemasukan" ? KATEGORI_PEMASUKAN : KATEGORI_PENGELUARAN;

  const cocok = daftar.find(
    (k) => k.toLowerCase() === kategori?.trim().toLowerCase(),
  );

  return cocok ?? "Lainnya";
}

/**
 * Intent dari pesan user; null kalau jawaban LLM tidak lolos validasi (pemanggil membalas
 * contoh pesan). Melempar LLMUnavailableError kalau gateway sedang gangguan.
 */
export async function parseIntent(pesan: string): Promise<Intent | null> {
  const content = await chatCompletion([
    { role: "system", content: systemPrompt() },
    { role: "user", content: pesan.slice(0, MAX_PESAN) },
  ]);

  const json = objekJsonPertama(content);
  if (!json) {
    console.warn("Intent: tidak ada objek JSON di jawaban LLM:", content);
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }

  const hasil = IntentSchema.safeParse(parsed);
  if (!hasil.success) {
    console.warn("Intent tidak valid:", json, hasil.error.issues);
    return null;
  }

  return hasil.data;
}
