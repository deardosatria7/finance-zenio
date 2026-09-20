import { getRedis } from "../redis";
import { hariIniWIB } from "./waktu";

// State percakapan yang berumur pendek. WhatsApp tidak punya tombol, jadi konfirmasi dilakukan
// lewat balasan teks dan konteksnya disimpan di sini.

const UNDO_TTL = 300;
const PILIH_TTL = 300;
const KUOTA_DEFAULT = 100;

export type Jenis = "pemasukan" | "pengeluaran";

/** Transaksi yang baru dicatat, target perintah "batal" */
export type Terakhir = { jenis: Jenis; id: number };

export type Kandidat = {
  jenis: Jenis;
  id: number;
  nama: string;
  nominal: number;
  kategori: string;
  /** ISO string; Date tidak selamat melewati JSON */
  createdAt: string;
};

/** Daftar kandidat yang sedang menunggu user memilih nomornya */
export type Pilihan = {
  aksi: "hapus" | "edit";
  kandidat: Kandidat[];
  perubahan?: {
    nama?: string;
    nominal?: number;
    kategori?: string;
    tanggal?: string;
  };
};

/**
 * false kalau pesan ini sudah pernah diproses. GOWA mengirim ulang update yang tidak dibalas
 * 200, dan tanpa ini transaksi bisa tercatat dua kali.
 */
export async function pesanBaru(messageId: string) {
  const hasil = await getRedis().set(
    `wa_msg:${messageId}`,
    "1",
    "EX",
    3600,
    "NX",
  );
  return hasil !== null;
}

/**
 * true kalau nomor ini boleh diberi tahu bahwa akunnya belum terhubung. Dibatasi sekali per hari
 * supaya membalas orang asing tidak jadi biaya, dan nomor bot tidak terus terlihat aktif.
 */
export async function bolehBalasBelumTerhubung(jid: string) {
  const hasil = await getRedis().set(
    `wa_unlinked:${jid}`,
    "1",
    "EX",
    86400,
    "NX",
  );
  return hasil !== null;
}

export async function simpanTerakhir(jid: string, terakhir: Terakhir) {
  await getRedis().set(
    `wa_last:${jid}`,
    JSON.stringify(terakhir),
    "EX",
    UNDO_TTL,
  );
}

/** Ambil sekaligus hapus: satu transaksi hanya bisa diurungkan sekali */
export async function ambilTerakhir(jid: string): Promise<Terakhir | null> {
  const raw = await getRedis().getdel(`wa_last:${jid}`);
  return raw ? (JSON.parse(raw) as Terakhir) : null;
}

export async function simpanPilihan(jid: string, pilihan: Pilihan) {
  await getRedis().set(
    `wa_pilih:${jid}`,
    JSON.stringify(pilihan),
    "EX",
    PILIH_TTL,
  );
}

export async function ambilPilihan(jid: string): Promise<Pilihan | null> {
  const raw = await getRedis().get(`wa_pilih:${jid}`);
  return raw ? (JSON.parse(raw) as Pilihan) : null;
}

export async function hapusPilihan(jid: string) {
  await getRedis().del(`wa_pilih:${jid}`);
}

/**
 * Pakai satu jatah panggilan LLM hari ini; false kalau kuotanya sudah habis.
 * Dihitung per akun, bukan per nomor, supaya tidak bisa diakali dengan ganti nomor.
 */
export async function pakaiKuotaLlm(userId: string) {
  const batas = Number(process.env.WA_LLM_QUOTA_HARIAN) || KUOTA_DEFAULT;
  const key = `wa_llm:${userId}:${hariIniWIB()}`;

  const pakai = await getRedis().incr(key);
  if (pakai === 1) {
    // Key baru: kedaluwarsa 2 hari, cukup untuk menutup selisih WIB dengan jam server
    await getRedis().expire(key, 172800);
  }

  return pakai <= batas;
}
