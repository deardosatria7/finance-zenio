# Progress: Bot Telegram

Catatan per 2026-09-15. Rencana lengkap ada di `plan_telegram.md`; file ini mencatat apa yang
sudah jalan, kondisi saat ini, dan langkah berikutnya.

## Sudah selesai

| Tahap | Isi | Commit |
|-------|-----|--------|
| 1. Persiapan | Bot `@ZenioFinanceBot` dibuat (satu bot untuk dev dan prod), env Telegram + AI di `.env` lokal, gateway LLM dites | - |
| 2. Service layer | Logika tulis di `lib/finances.ts` (terima `userId`, cek kepemilikan di `WHERE`, `tanggal` opsional); server action jadi pembungkus + `Schema.parse()` | `a95717d` |
| 3. Schema | Tabel `telegram_link`, migrasi `0004`, **sudah dijalankan ke DB produksi**, disinkron + di-push ke pintarpy (`6cb6668`) | `f9fb89d` |
| 4. Linking | `lib/telegram/link.ts` (kode sekali pakai di Redis, `GETDEL`), `lib/actions/telegram.ts`, halaman `/dashboard/telegram` + menu sidebar, `lib/telegram/bot.ts` (`/start <kode>`, `/putus`), route `app/api/telegram/route.ts` (secret wajib, `onTimeout: "return"`), `scripts/set-telegram-webhook.ts` | `37c6cfb` |
| 5. Webhook dasar | `/saldo`, `/riwayat` (10 terakhir), dedupe `update_id` (`tg_update:*`, TTL 1 jam), rate limit 10 pesan/menit per chat (`getTelegramRateLimiter`), menu command via `setMyCommands` | `0d89de4` |

Semua sudah dites manual lewat tunnel, kecuali rate limit Telegram (belum sempat).

## Kondisi saat ini (penting sebelum lanjut)

- **Webhook bot masih mengarah ke tunnel lokal** `https://extending-refugees-bernard-roller.trycloudflare.com`.
  Kalau tunnel sudah mati, pesan ke bot ditahan Telegram sampai 24 jam. Untuk lanjut develop:
  `cloudflared tunnel --url http://localhost:3001`, lalu
  `npx tsx scripts/set-telegram-webhook.ts <url-tunnel-baru>`.
- **Produksi belum di-deploy.** `https://keuangan.zenio.id/api/telegram` masih 404. Jangan jalankan
  `set-telegram-webhook.ts prod` sebelum deploy dan env produksi terisi.
- Akun yang terhubung ke bot saat ini belum punya transaksi (saldo Rp 0).
- `master` finance-zenio belum di-push (beberapa commit di depan `origin/master`).

## Belum selesai

### Tahap 6: LLM + aksi tambah (sedang dikerjakan, belum ada kode)

Rencana file:

1. `lib/llm.ts` — `chatCompletion(messages)` ke `${AI_ZENIO_GATEWAY}/chat/completions`, coba
   model berurutan dari `AI_MODELS` (default: gemma-4-31b-it:free, nemotron-3-super:free,
   nemotron-3-nano-omni-reasoning:free, cf llama-3.3-70b), timeout ~15 detik per model.
   Anggap gagal kalau tidak ada `choices[0].message.content` (gateway bisa balas error dengan HTTP
   200 diikuti `data: [DONE]`; buang sufiks itu sebelum `JSON.parse`).
2. `lib/telegram/intent.ts` — system prompt (tanggal hari ini + nama hari dalam WIB, daftar
   kategori, aturan nominal "25rb"/"1,5jt", contoh untuk **setiap** aksi termasuk edit), ambil
   objek JSON pertama dari jawaban, validasi zod v4 (`z.discriminatedUnion("aksi", ...)`),
   `nominal` > 0 (pakai `z.coerce.number()`), kategori di luar daftar jadi `"Lainnya"`,
   tanggal `YYYY-MM-DD` tidak di masa depan dan maks 1 tahun ke belakang. Potong teks user
   (mis. 500 karakter) sebelum dikirim ke LLM.
3. `lib/finances.ts` — `addPemasukan`/`addPengeluaran` perlu `.returning({ id })` dan
   mengembalikan id (untuk tombol urungkan). `getRiwayat` ditambah filter opsional
   `jenis`, `dari`, `sampai`.
4. `lib/telegram/bot.ts` — ganti handler cadangan `pm.on("message")` dengan
   `pm.on("message:text")`: `replyWithChatAction("typing")`, parse intent, lalu:
   - `tambah` → simpan, balas ringkasan + tanggal ("Tercatat: Bensin Rp 50.000, Senin 14 Sep")
     dengan `InlineKeyboard` `[Urungkan]`, callback data `undo:<jenis>:<id>`;
   - `saldo` / `riwayat` → pakai ulang logika command (pecah jadi helper);
   - `edit` / `hapus` → balas "menyusul, sementara pakai dashboard" (tahap 7);
   - `tidak_dikenal` / gagal parse → contoh pesan.
   Tambah `pm.callbackQuery(/^undo:(pemasukan|pengeluaran):(\d+)$/)` → hapus via service
   (kepemilikan dicek di `WHERE`), edit pesan jadi "Dibatalkan", `answerCallbackQuery`.
5. Tes manual lewat tunnel, termasuk rate limit (11 pesan dalam 1 menit).

Temuan soal tanggal (sudah dicek, belum diterapkan):

- Zona waktu DB `Etc/UTC`; default `now()` menyimpan waktu UTC. Drizzle menulis `Date` dengan
  `toISOString()` dan membaca kolom `timestamp` tanpa zona sebagai UTC, jadi round-trip konsisten.
- Tanggal selain hari ini disimpan `new Date(\`${ymd}T12:00:00+07:00\`)` (= 05:00 UTC), supaya
  tetap di tanggal yang sama di WIB maupun UTC. Tanggal hari ini: kirim `undefined` (pakai `now()`).
- `formatDate` di `lib/utils.ts` memakai zona waktu server (UTC di Docker), jadi transaksi
  23:00 WIB tampil sebagai hari sebelumnya. Di balasan bot pakai formatter dengan
  `timeZone: "Asia/Jakarta"`.

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
