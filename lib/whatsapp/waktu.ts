// Semua tanggal yang dilihat user (prompt LLM dan balasan bot) memakai WIB, sementara server
// dan DB berjalan di UTC. Helper di sini yang menjembatani keduanya.

const WIB = "Asia/Jakarta";

/** Tanggal hari ini di WIB sebagai "YYYY-MM-DD" */
export function hariIniWIB() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Mis. "Selasa, 2026-09-15" untuk system prompt */
export function hariIniLengkapWIB() {
  const namaHari = new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    weekday: "long",
  }).format(new Date());

  return `${namaHari}, ${hariIniWIB()}`;
}

/**
 * "YYYY-MM-DD" (WIB) jadi Date untuk disimpan; undefined kalau tanggalnya hari ini
 * (biar pakai now() dari DB). Jam 12:00 WIB (= 05:00 UTC) supaya tanggalnya tetap sama
 * dibaca sebagai WIB maupun UTC.
 */
export function tanggalKeDate(ymd: string | null | undefined) {
  if (!ymd || ymd === hariIniWIB()) return undefined;
  return new Date(`${ymd}T12:00:00+07:00`);
}

/** Mis. "Senin, 14 Sep" — dipakai di balasan bot supaya salah tafsir tanggal langsung terlihat */
export function formatTanggalWIB(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date(date));
}

/** Awal hari (00:00 WIB) dari "YYYY-MM-DD" */
export function awalHariWIB(ymd: string) {
  return new Date(`${ymd}T00:00:00+07:00`);
}

/** Batas atas eksklusif untuk rentang riwayat: 00:00 WIB hari berikutnya */
export function setelahHariWIB(ymd: string) {
  const batas = awalHariWIB(ymd);
  batas.setUTCDate(batas.getUTCDate() + 1);
  return batas;
}
