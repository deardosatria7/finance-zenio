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

Cari kandidat terbaru yang cocok `kataKunci` (+ `tanggal` kalau ada), konfirmasi dengan tombol
`[Ya] [Batal]` atau daftar pilihan, verifikasi ulang kepemilikan di callback. Detail di plan.

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
