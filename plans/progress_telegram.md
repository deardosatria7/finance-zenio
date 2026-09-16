# Progress: Bot Telegram

Catatan per 2026-09-16. Rencana lengkap ada di `plan_telegram.md`; file ini mencatat apa yang
sudah jalan, kondisi saat ini, dan langkah berikutnya.

## Sudah selesai

| Tahap | Isi | Commit |
|-------|-----|--------|
| 1. Persiapan | Bot `@ZenioFinanceBot` dibuat (satu bot untuk dev dan prod), env Telegram + AI di `.env` lokal, gateway LLM dites | - |
| 2. Service layer | Logika tulis di `lib/finances.ts` (terima `userId`, cek kepemilikan di `WHERE`, `tanggal` opsional); server action jadi pembungkus + `Schema.parse()` | `a95717d` |
| 3. Schema | Tabel `telegram_link`, migrasi `0004`, **sudah dijalankan ke DB produksi**, disinkron + di-push ke pintarpy (`6cb6668`) | `f9fb89d` |
| 4. Linking | `lib/telegram/link.ts` (kode sekali pakai di Redis, `GETDEL`), `lib/actions/telegram.ts`, halaman `/dashboard/telegram` + menu sidebar, `lib/telegram/bot.ts` (`/start <kode>`, `/putus`), route `app/api/telegram/route.ts` (secret wajib, `onTimeout: "return"`), `scripts/set-telegram-webhook.ts` | `37c6cfb` |
| 5. Webhook dasar | `/saldo`, `/riwayat` (10 terakhir), dedupe `update_id` (`tg_update:*`, TTL 1 jam), rate limit 10 pesan/menit per chat (`getTelegramRateLimiter`), menu command via `setMyCommands` | `0d89de4` |
| 6. LLM + aksi tambah | `lib/llm.ts` (fallback antar model + timeout 15 detik), `lib/telegram/intent.ts` (system prompt + validasi zod), `lib/telegram/waktu.ts` (helper WIB), `add*` mengembalikan id, `getRiwayat` bisa difilter, handler `message:text` + tombol Urungkan | `66a92d7` |

Tahap 1-5 sudah dites manual lewat tunnel, kecuali rate limit Telegram (belum sempat).
Tahap 6 baru dites lewat `npx tsx scripts/try-intent.ts` (8/8 pesan contoh terurai benar);
alurnya di chat Telegram belum dicoba.

## Kondisi saat ini (penting sebelum lanjut)

- **Webhook bot mengarah ke tunnel lokal sekali pakai** (URL trycloudflare berubah tiap kali
  tunnel dijalankan ulang). Kalau tunnel sudah mati, pesan ke bot ditahan Telegram sampai 24 jam.
  Untuk lanjut develop: `cloudflared tunnel --url http://localhost:3001`, lalu
  `npx tsx scripts/set-telegram-webhook.ts <url-tunnel-baru>`.
  Terakhir diarahkan ke `https://workforce-abstracts-interests-expenditures.trycloudflare.com`
  (16 Sep, sudah dites: POST tanpa secret balas 401, `pending: 0`).
- **Model gratis paling depan selalu gagal.** Di tes 16 Sep, `gemma-4-31b-it:free` 8/8 balas tanpa
  content, jadi yang benar-benar dipakai `nemotron-3-super:free` (1,5-5 detik). Fallback jalan,
  tapi tiap pesan bayar satu request sia-sia dulu.
- **Produksi belum di-deploy.** `https://keuangan.zenio.id/api/telegram` masih 404. Jangan jalankan
  `set-telegram-webhook.ts prod` sebelum deploy dan env produksi terisi.
- Akun yang terhubung ke bot saat ini belum punya transaksi (saldo Rp 0).
- `master` finance-zenio sudah sinkron dengan `origin/master` (terakhir: `2b6bad8`).

## Belum selesai

### Tahap 6: sisa yang belum dikerjakan

Kodenya sudah jalan, yang belum: **tes manual di chat Telegram** — catat pengeluaran, cek tanggal
di balasan benar menurut WIB, tekan Urungkan, lalu pastikan transaksinya hilang dari dashboard.
Termasuk rate limit (11 pesan dalam 1 menit) yang sejak tahap 5 belum sempat dites.

Catatan implementasi (beda dari rencana awal):

- Helper tanggal WIB dipisah ke `lib/telegram/waktu.ts` (`hariIniWIB`, `tanggalKeDate`,
  `formatTanggalWIB`, `awalHariWIB`, `setelahHariWIB`), dipakai prompt dan balasan bot.
- `/riwayat` dan intent `riwayat` memakai `formatTanggalWIB`, bukan `formatDate` dari
  `lib/utils.ts` (yang masih ikut zona waktu server).
- Intent `edit`/`hapus` sudah dikenali parser, tapi handler-nya masih membalas "belum tersedia"
  sambil menyarankan tombol Urungkan atau dashboard (menunggu tahap 7).
- `scripts/try-intent.ts` untuk mengetes system prompt tanpa lewat Telegram.

### Tahap 7: edit dan hapus lewat chat

Garis besarnya ada di `plan_telegram.md` bagian "Edit dan hapus selalu lewat konfirmasi":
cari kandidat yang cocok `kataKunci` (+ `tanggal` kalau ada), konfirmasi dengan tombol, verifikasi
ulang kepemilikan di callback. Hasil diskusi 16 Sep yang memperjelas detailnya:

**Niat konfirmasi disimpan di Redis, bukan di callback data.** Callback data Telegram cuma 64 byte
— cukup untuk `del:pengeluaran:123`, tidak cukup untuk edit yang membawa
`{nama, nominal, kategori, tanggal}`. Pakai pola yang sama dengan kode linking:
`tg_pending:<token>` berisi `{ chatId, jenis, id, perubahan, sebelum }`, TTL 10 menit, callback
data cukup `ok:<token>`. Diambil dengan `GETDEL` supaya token sekali pakai — tombol yang ditekan
dua kali dapat "konfirmasi kedaluwarsa", bukan edit dobel. Token diikat ke `chatId` dan dicek ulang
saat callback (di luar pengecekan `userId` di `WHERE` service).

**Edit hampir selalu parsial** ("ternyata 60rb" tidak menyebut nama dan kategori), sedangkan
`editPemasukan`/`editPengeluaran` yang ada menimpa semua kolom. Tambah fungsi service baru yang
`.set()`-nya hanya berisi field yang terisi (`patchPemasukan`/`patchPengeluaran`), bukan
baca-lalu-merge di bot: satu query, tidak ada jendela baca-tulis. Baris lama tetap dibaca, tapi
untuk ditampilkan di konfirmasi saja.

**Pencarian kandidat**: `ilike('%kataKunci%')` pada `nama_*`, difilter `userId`, dipersempit
`tanggal` kalau disebut, urut terbaru, ambil 5. `jenis` null berarti cari di dua tabel.
Cabangnya:

- 0 kandidat → sebutkan rentang yang dicari, biar jelas kenapa nihil
- 1 kandidat → tampilkan sebelum -> sesudah, tombol `[Ya] [Batal]`
- 2-5 kandidat → daftar bernomor, satu tombol per baris, callback `pilih:<token>:<idx>`
  (satu entri Redis berisi daftar kandidatnya, index-nya di callback data)

Keputusan lain:

- **Batasi pencarian ke 30 hari terakhir.** Tanpa batas, "hapus kopi" bisa menyodorkan transaksi
  tiga bulan lalu cuma karena kata kuncinya cocok. Kalau tidak ketemu, user bisa perjelas tanggal.
- **Tawarkan `[Urungkan]` setelah edit berhasil**, bukan cuma setelah tambah. Nilai lamanya sudah
  ada di Redis untuk konfirmasi, tinggal dipakai mengembalikan.
- **Hapus selalu lewat konfirmasi**, walau kandidatnya cuma satu dan cocok sempurna. Beda dengan
  tambah yang langsung disimpan: tambah reversibel lewat Urungkan, hapus tidak.

Belum diputuskan:

- **Tombol `[Edit] [Hapus]` di `/riwayat`.** Hapus gampang (ID sudah diketahui). Edit lewat tombol
  berarti bot harus bertanya "mau diubah jadi apa?" lalu menunggu jawaban berikutnya — itu state
  percakapan, hal baru yang belum ada di bot ini. Usulan: pasang `[Hapus]` saja dulu, edit tetap
  lewat kalimat.
- **Kata kunci kosong atau terlalu umum** ("hapus yang tadi"). Diperlakukan sebagai "kandidat =
  transaksi paling terakhir", atau bot balik bertanya? Condong ke yang pertama: ungkapannya wajar
  dan tetap ada konfirmasi sebelum jalan.

### Tahap 8: deploy

1. Isi env produksi: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`
   (sama dengan lokal), `AI_ZENIO_GATEWAY`, `AI_ZENIO_API_KEY`, opsional `AI_MODELS`.
2. Deploy (`docker compose up -d --build`), cek `POST https://keuangan.zenio.id/api/telegram`
   tanpa secret membalas 401.
3. `npx tsx scripts/set-telegram-webhook.ts prod`, lalu `... info`.

### Beres-beres

- Tambahkan env Telegram dan AI ke `.env.example` (tanpa nilai).
- Update `CLAUDE.md`: bot Telegram (`lib/telegram/`, route webhook, script webhook, satu bot
  untuk dev/prod), tabel `telegram_link`, domain produksi `keuangan.zenio.id`.
- `@BotFather` → `/setjoingroups` → Disable (`getMe` masih `can_join_groups: true`).
- Pertanyaan terbuka di plan: cadangan command biasa kalau LLM down.
