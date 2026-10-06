import {
  addPemasukan,
  addPengeluaran,
  cariTransaksi,
  deletePemasukan,
  deletePengeluaran,
  getRiwayat,
  getSaldo,
  updateTransaksi,
  type PerubahanTransaksi,
  type RiwayatFilter,
  type Transaksi,
} from "../finances";
import { LLMUnavailableError } from "../llm";
import {
  getWhatsappLinkRateLimiter,
  getWhatsappRateLimiter,
} from "../rate-limiter";
import { formatRupiah } from "../utils";
import { getSaldoPerWallet, getWallets } from "../wallets";
import { normalkanKategori, parseIntent, type Intent } from "./intent";
import {
  getUserIdByChat,
  linkChatWithCode,
  unlinkChat,
} from "./link";
import { kirimPesan, setTyping } from "./client";
import {
  ambilPilihan,
  ambilTerakhir,
  bolehBalasBelumTerhubung,
  hapusPilihan,
  pakaiKuotaLlm,
  simpanPilihan,
  simpanTerakhir,
  type Jenis,
  type Kandidat,
  type Pilihan,
} from "./state";
import type { PesanMasuk } from "./webhook";
import {
  awalHariWIB,
  formatTanggalWIB,
  setelahHariWIB,
  tanggalKeDate,
} from "./waktu";

// Otak bot. WhatsApp tidak punya tombol, jadi semua konfirmasi berupa balasan teks dan
// konteksnya disimpan di state.ts.

const BELUM_TERHUBUNG =
  "Nomor ini belum terhubung ke akun finance-zenio. Buka menu WhatsApp di dashboard, " +
  "lalu tekan Hubungkan WhatsApp.";

const TIDAK_PAHAM =
  "Maaf, aku belum paham. Contoh: makan siang 25rb, gajian 8,5jt, saldo, atau riwayat.";

const BANTUAN = [
  "Kirim apa saja dengan bahasa biasa:",
  "",
  "• makan siang 25rb",
  "• kemarin bensin 50rb",
  "• gajian 8,5jt",
  "• kopi 20rb pakai gopay",
  "• yang bensin tadi ternyata 60rb",
  "• hapus parkir kemarin",
  "• saldo",
  "• saldo gopay",
  "• riwayat",
  "",
  'Balas "batal" untuk mengurungkan transaksi yang baru dicatat.',
  'Ketik "putus" untuk melepas nomor ini dari akunmu.',
].join("\n");

type WalletUser = Awaited<ReturnType<typeof getWallets>>[number];

function ringkas(t: Transaksi | Kandidat) {
  const tanda = t.jenis === "pemasukan" ? "+" : "-";
  const tanggal = formatTanggalWIB(new Date(t.createdAt));
  const keterangan = t.walletNama ? `${t.kategori}, ${t.walletNama}` : t.kategori;
  return `${t.nama} ${tanda}${formatRupiah(t.nominal)} (${keterangan}), ${tanggal}`;
}

/**
 * Wallet aktif yang disebut di pesan. undefined kalau tidak disebut; null kalau namanya tidak
 * dikenal dan user sudah dibalas daftar wallet-nya. Nama asing ditolak, bukan dialihkan ke
 * default, supaya transaksi tidak diam-diam masuk ke wallet yang salah.
 */
async function walletDariIntent(
  jid: string,
  wallets: WalletUser[],
  nama: string | undefined,
) {
  if (nama === undefined) return undefined;

  const cocok = wallets.find(
    (w) => w.nama.toLowerCase() === nama.trim().toLowerCase(),
  );
  if (!cocok) {
    await kirimPesan(
      jid,
      `Wallet "${nama}" tidak ada. Wallet kamu: ${wallets.map((w) => w.nama).join(", ")}.`,
    );
    return null;
  }

  return cocok;
}

async function balasSaldo(jid: string, userId: string, wallet?: WalletUser) {
  if (wallet) {
    const { totalPemasukan, totalPengeluaran, saldo } = await getSaldo(
      userId,
      wallet.id,
    );
    await kirimPesan(
      jid,
      [
        `Saldo ${wallet.nama}: ${formatRupiah(saldo)}`,
        `Total pemasukan: ${formatRupiah(totalPemasukan)}`,
        `Total pengeluaran: ${formatRupiah(totalPengeluaran)}`,
      ].join("\n"),
    );
    return;
  }

  const [{ totalPemasukan, totalPengeluaran, saldo }, perWallet] =
    await Promise.all([getSaldo(userId), getSaldoPerWallet(userId)]);
  const rincian = perWallet
    .filter((w) => w.archivedAt === null)
    .map((w) => `• ${w.nama}: ${formatRupiah(w.saldo)}`);

  await kirimPesan(
    jid,
    [
      `Saldo: ${formatRupiah(saldo)}`,
      ...rincian,
      "",
      `Total pemasukan: ${formatRupiah(totalPemasukan)}`,
      `Total pengeluaran: ${formatRupiah(totalPengeluaran)}`,
    ].join("\n"),
  );
}

async function balasRiwayat(
  jid: string,
  userId: string,
  filter: RiwayatFilter = {},
) {
  const riwayat = await getRiwayat(userId, 10, filter);
  if (riwayat.length === 0) {
    await kirimPesan(jid, "Belum ada transaksi.");
    return;
  }

  const baris = riwayat.map((t) => `• ${ringkas(t)}`);
  await kirimPesan(
    jid,
    `${riwayat.length} transaksi terakhir:\n\n${baris.join("\n")}`,
  );
}

async function simpanTambah(
  jid: string,
  userId: string,
  intent: Extract<Intent, { aksi: "tambah" }>,
  wallets: WalletUser[],
) {
  const disebut = await walletDariIntent(jid, wallets, intent.wallet);
  if (disebut === null) return;

  // getWallets() selalu memastikan wallet default ada, dan wallet default tidak bisa diarsipkan
  const tujuan = disebut ?? wallets.find((w) => w.isDefault);
  if (!tujuan) throw new Error("Wallet default tidak ditemukan");

  const kategori = normalkanKategori(intent.jenis, intent.kategori);
  const tanggal = tanggalKeDate(intent.tanggal);

  const baris =
    intent.jenis === "pemasukan"
      ? await addPemasukan(userId, {
          nama_pemasukan: intent.nama,
          nominal: intent.nominal,
          kategori,
          wallet_id: tujuan.id,
          tanggal,
        })
      : await addPengeluaran(userId, {
          nama_pengeluaran: intent.nama,
          nominal: intent.nominal,
          kategori,
          wallet_id: tujuan.id,
          tanggal,
        });

  await simpanTerakhir(jid, { jenis: intent.jenis, id: baris.id });

  const tanda = intent.jenis === "pemasukan" ? "+" : "-";
  await kirimPesan(
    jid,
    `Tercatat di ${tujuan.nama}: ${intent.nama} ${tanda}${formatRupiah(intent.nominal)} (${kategori}), ` +
      `${formatTanggalWIB(baris.createdAt)}\n\n` +
      'Balas "batal" kalau salah.',
  );
}

async function hapusTransaksi(userId: string, jenis: Jenis, id: number) {
  if (jenis === "pemasukan") {
    await deletePemasukan(userId, id);
  } else {
    await deletePengeluaran(userId, id);
  }
}

/** Perubahan dari intent edit jadi bentuk yang dimengerti service */
function perubahanDariIntent(
  jenis: Jenis,
  perubahan: Pilihan["perubahan"],
): PerubahanTransaksi {
  return {
    nama: perubahan?.nama,
    nominal: perubahan?.nominal,
    kategori: perubahan?.kategori
      ? normalkanKategori(jenis, perubahan.kategori)
      : undefined,
    tanggal: tanggalKeDate(perubahan?.tanggal),
    walletId: perubahan?.wallet?.id,
  };
}

/** Jalankan aksi yang tertunda pada satu kandidat yang sudah dipilih user */
async function jalankanPilihan(
  jid: string,
  userId: string,
  pilihan: Pilihan,
  kandidat: Kandidat,
) {
  await hapusPilihan(jid);

  try {
    if (pilihan.aksi === "hapus") {
      await hapusTransaksi(userId, kandidat.jenis, kandidat.id);
      await kirimPesan(jid, `Dihapus: ${ringkas(kandidat)}`);
      return;
    }

    const perubahan = perubahanDariIntent(kandidat.jenis, pilihan.perubahan);
    await updateTransaksi(userId, kandidat.jenis, kandidat.id, perubahan);

    const rincian = [
      perubahan.nama && `nama jadi ${perubahan.nama}`,
      perubahan.nominal && `nominal jadi ${formatRupiah(perubahan.nominal)}`,
      perubahan.kategori && `kategori jadi ${perubahan.kategori}`,
      perubahan.tanggal && `tanggal jadi ${formatTanggalWIB(perubahan.tanggal)}`,
      pilihan.perubahan?.wallet &&
        `wallet jadi ${pilihan.perubahan.wallet.nama}`,
    ].filter(Boolean);

    await kirimPesan(jid, `Diubah: ${kandidat.nama} — ${rincian.join(", ")}.`);
  } catch (error) {
    // Biasanya transaksi sudah dihapus; dicatat supaya error DB tidak ikut tersamarkan
    console.warn(`WhatsApp ${pilihan.aksi} ${kandidat.jenis}:${kandidat.id} gagal:`, error);
    await kirimPesan(jid, "Transaksi itu sudah tidak ada.");
  }
}

/** Tawarkan kandidat; satu kandidat minta "ya", beberapa minta nomornya */
async function tawarkanKandidat(
  jid: string,
  aksi: "hapus" | "edit",
  kandidat: Kandidat[],
  perubahan?: Pilihan["perubahan"],
) {
  await simpanPilihan(jid, { aksi, kandidat, perubahan });

  const kata = aksi === "hapus" ? "hapus" : "ubah";

  if (kandidat.length === 1) {
    await kirimPesan(
      jid,
      `Mau ${kata} yang ini?\n\n${ringkas(kandidat[0])}\n\n` +
        'Balas "ya" atau "batal".',
    );
    return;
  }

  const daftar = kandidat.map((k, i) => `${i + 1}. ${ringkas(k)}`).join("\n");
  await kirimPesan(
    jid,
    `Mau ${kata} yang mana?\n\n${daftar}\n\nBalas angkanya, atau "batal".`,
  );
}

async function mulaiEditAtauHapus(
  jid: string,
  userId: string,
  intent: Extract<Intent, { aksi: "edit" | "hapus" }>,
  wallets: WalletUser[],
) {
  // LLM kadang mengembalikan edit tanpa isi perubahan; tanpa ini service dipanggil dengan
  // kumpulan kolom kosong dan melempar
  if (
    intent.aksi === "edit" &&
    Object.values(intent.perubahan).every((v) => v === undefined)
  ) {
    await kirimPesan(jid, "Mau diubah jadi apa? Sebutkan nominal, nama, atau kategorinya.");
    return;
  }

  // Wallet tujuan dicek sekarang, supaya nama yang salah ditolak sebelum user disuruh memilih
  let perubahan: Pilihan["perubahan"];
  if (intent.aksi === "edit") {
    const wallet = await walletDariIntent(jid, wallets, intent.perubahan.wallet);
    if (wallet === null) return;
    perubahan = {
      ...intent.perubahan,
      wallet: wallet && { id: wallet.id, nama: wallet.nama },
    };
  }

  const ditemukan = await cariTransaksi(userId, intent.kataKunci, {
    jenis: intent.jenis,
    dari: intent.tanggal ? awalHariWIB(intent.tanggal) : undefined,
    sampai: intent.tanggal ? setelahHariWIB(intent.tanggal) : undefined,
  });

  if (ditemukan.length === 0) {
    await kirimPesan(
      jid,
      `Tidak ketemu transaksi dengan kata "${intent.kataKunci}".`,
    );
    return;
  }

  const kandidat: Kandidat[] = ditemukan.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  await tawarkanKandidat(jid, intent.aksi, kandidat, perubahan);
}

async function jalankanIntent(
  jid: string,
  userId: string,
  intent: Intent,
  wallets: WalletUser[],
) {
  switch (intent.aksi) {
    case "tambah":
      await simpanTambah(jid, userId, intent, wallets);
      return;
    case "saldo": {
      const wallet = await walletDariIntent(jid, wallets, intent.wallet);
      if (wallet === null) return;
      await balasSaldo(jid, userId, wallet);
      return;
    }
    case "riwayat": {
      const wallet = await walletDariIntent(jid, wallets, intent.wallet);
      if (wallet === null) return;
      await balasRiwayat(jid, userId, {
        jenis: intent.jenis,
        walletId: wallet?.id,
        dari: intent.dari ? awalHariWIB(intent.dari) : undefined,
        sampai: intent.sampai ? setelahHariWIB(intent.sampai) : undefined,
      });
      return;
    }
    case "edit":
    case "hapus":
      await mulaiEditAtauHapus(jid, userId, intent, wallets);
      return;
    case "tidak_dikenal":
      await kirimPesan(jid, TIDAK_PAHAM);
  }
}

/** Kode dari pesan "HUBUNGKAN <kode>"; null kalau bukan pesan linking */
function kodeHubungkan(teks: string) {
  const cocok = /^hubungkan\s+([0-9a-f]{16})$/i.exec(teks);
  return cocok?.[1].toLowerCase() ?? null;
}

async function tanganiHubungkan(pesan: PesanMasuk, kode: string) {
  try {
    await getWhatsappLinkRateLimiter().consume(pesan.jid);
  } catch {
    await kirimPesan(
      pesan.balasKe,
      "Terlalu banyak percobaan. Coba lagi satu jam lagi.",
    );
    return;
  }

  const userId = await linkChatWithCode(kode, pesan.jid, pesan.lid);
  await kirimPesan(
    pesan.balasKe,
    userId
      ? "Akun berhasil terhubung! Sekarang kamu bisa mencatat keuangan lewat chat ini.\n\n" +
          BANTUAN
      : "Link tidak valid atau sudah kedaluwarsa. Buat link baru dari dashboard.",
  );
}

/**
 * Balasan atas daftar kandidat yang sedang menunggu. Mengembalikan false kalau pesannya bukan
 * jawaban atas tawaran itu, supaya diteruskan ke alur biasa.
 */
async function tanganiPilihan(
  jid: string,
  userId: string,
  pilihan: Pilihan,
  teks: string,
) {
  const normal = teks.toLowerCase();

  if (normal === "batal" || normal === "tidak" || normal === "gak") {
    await hapusPilihan(jid);
    await kirimPesan(jid, "Oke, dibatalkan.");
    return true;
  }

  if (pilihan.kandidat.length === 1 && (normal === "ya" || normal === "iya")) {
    await jalankanPilihan(jid, userId, pilihan, pilihan.kandidat[0]);
    return true;
  }

  const nomor = /^\d+$/.test(normal) ? Number(normal) : null;
  if (nomor !== null) {
    const kandidat = pilihan.kandidat[nomor - 1];
    if (!kandidat) {
      await kirimPesan(
        jid,
        `Nomor ${nomor} tidak ada di daftar. Balas angka 1-${pilihan.kandidat.length}, atau "batal".`,
      );
      return true;
    }
    await jalankanPilihan(jid, userId, pilihan, kandidat);
    return true;
  }

  // Pesan lain berarti user berpindah topik; tawaran dibuang tanpa komentar
  await hapusPilihan(jid);
  return false;
}

async function tanganiBatal(jid: string, userId: string) {
  const terakhir = await ambilTerakhir(jid);
  if (!terakhir) {
    await kirimPesan(
      jid,
      "Tidak ada transaksi yang bisa diurungkan. Batas waktunya 5 menit setelah dicatat.",
    );
    return;
  }

  try {
    // Kepemilikan tetap dicek di WHERE service, tidak dipercaya dari Redis
    await hapusTransaksi(userId, terakhir.jenis, terakhir.id);
    await kirimPesan(jid, "Dibatalkan, transaksi dihapus.");
  } catch (error) {
    console.warn(`WhatsApp batal ${terakhir.jenis}:${terakhir.id} gagal:`, error);
    await kirimPesan(jid, "Transaksi itu sudah tidak ada.");
  }
}

/**
 * Satu pesan masuk, dari awal sampai balasan terkirim. Urutan pengecekannya disengaja: yang
 * murah dan yang bisa menolak lebih dulu, panggilan LLM paling akhir.
 */
export async function tanganiPesan(pesan: PesanMasuk) {
  const { teks, balasKe } = pesan;
  const normal = teks.toLowerCase().replace(/^\//, "");

  const kode = kodeHubungkan(teks);
  if (kode) {
    await tanganiHubungkan(pesan, kode);
    return;
  }

  if (normal === "putus") {
    const lepas = await unlinkChat(pesan.jid, pesan.lid);
    await kirimPesan(
      balasKe,
      lepas
        ? "Akun berhasil diputus dari nomor ini."
        : "Nomor ini memang belum terhubung ke akun mana pun.",
    );
    return;
  }

  const userId = await getUserIdByChat(pesan.jid, pesan.lid);
  if (!userId) {
    // Orang asing dibalas sekali sehari saja; sisanya didiamkan
    if (await bolehBalasBelumTerhubung(pesan.jid)) {
      await kirimPesan(balasKe, BELUM_TERHUBUNG);
    }
    return;
  }

  try {
    await getWhatsappRateLimiter().consume(pesan.jid);
  } catch {
    await kirimPesan(balasKe, "Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.");
    return;
  }

  const pilihan = await ambilPilihan(balasKe);
  if (pilihan && (await tanganiPilihan(balasKe, userId, pilihan, teks))) {
    return;
  }

  if (normal === "batal" || normal === "urungkan") {
    await tanganiBatal(balasKe, userId);
    return;
  }

  if (normal === "saldo") {
    await balasSaldo(balasKe, userId);
    return;
  }

  if (normal === "riwayat") {
    await balasRiwayat(balasKe, userId);
    return;
  }

  if (normal === "help" || normal === "bantuan" || normal === "menu") {
    await kirimPesan(balasKe, BANTUAN);
    return;
  }

  if (!(await pakaiKuotaLlm(userId))) {
    await kirimPesan(
      balasKe,
      "Kuota AI harian sudah habis, coba lagi besok. Sementara ini kamu masih bisa pakai " +
        "saldo dan riwayat.",
    );
    return;
  }

  await setTyping(balasKe, true);
  try {
    const wallets = await getWallets(userId);
    const intent = await parseIntent(
      teks,
      wallets.map((w) => w.nama),
    );
    if (!intent) {
      await kirimPesan(balasKe, TIDAK_PAHAM);
      return;
    }
    await jalankanIntent(balasKe, userId, intent, wallets);
  } catch (error) {
    // Gateway LLM gangguan beda dengan pesan yang tidak dipahami: user perlu tahu pesannya
    // belum tercatat, dan bahwa saldo/riwayat tetap bisa dipakai
    if (!(error instanceof LLMUnavailableError)) throw error;

    await kirimPesan(
      balasKe,
      "Layanan AI sedang gangguan, pesanmu belum tercatat. Coba lagi beberapa menit lagi, " +
        "atau pakai saldo dan riwayat yang tidak butuh AI.",
    );
  } finally {
    await setTyping(balasKe, false);
  }
}
