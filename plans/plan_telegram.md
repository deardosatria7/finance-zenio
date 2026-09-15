# Plan: Bot Telegram finance-zenio

## Tujuan

User bisa mencatat dan mengelola keuangan lewat chat Telegram dengan bahasa bebas:

- Tambah pemasukan/pengeluaran: "makan siang 25rb", "gajian 8 juta", "kemarin beli bensin 50rb"
- Edit: "yang makan siang tadi ternyata 30rb"
- Hapus: "hapus parkir tadi"
- Cek saldo: "saldo aku berapa?"
- Lihat riwayat: "pengeluaran minggu ini apa aja?"

Bot dipakai banyak user. Setiap chat Telegram harus terhubung ke satu akun finance-zenio.

## Alur besar

```
Telegram ──POST──> /api/telegram (webhook)
                    ├─ cek header X-Telegram-Bot-Api-Secret-Token
                    ├─ buang update duplikat (update_id di Redis)
                    ├─ chatId ──> telegram_link ──> userId   (belum terhubung? minta /start)
                    ├─ rate limit per chat
                    ├─ pesan ──> LLM ──> JSON intent ──> validasi zod
                    └─ intent ──> service (lib/finances.ts, pakai userId) ──> balas chat
```

LLM hanya menerjemahkan pesan menjadi intent. Semua akses DB tetap lewat service yang selalu
difilter `userId`, jadi isi pesan (termasuk prompt injection) tidak bisa menyentuh data user lain.

## Keputusan desain

### 1. Menghubungkan akun (linking)

Tabel baru di bagian FINANCE-ZENIO pada `db/schema.ts`:

```ts
export const telegramLink = pgTable("telegram_link", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- `chatId` disimpan sebagai text karena ID Telegram bisa melebihi batas integer 32-bit.
- Satu akun satu chat, satu chat satu akun (dua-duanya unique).
- Kode linking disimpan di Redis, bukan tabel: `tg_link:<kode>` = userId, kedaluwarsa 10 menit.

Alur:

1. Di dashboard, user klik "Hubungkan Telegram". Server action membuat kode acak, simpan di Redis,
   lalu tampilkan link `https://t.me/<TELEGRAM_BOT_USERNAME>?start=<kode>`.
2. User membuka link, Telegram mengirim `/start <kode>` ke bot.
3. Route mencari kode di Redis, menyimpan pasangan userId + chatId, lalu menghapus kodenya.
4. Putus hubungan: tombol di dashboard, atau perintah `/putus` di bot.

Konsekuensi: perubahan schema bersama. Wajib `drizzle-kit generate`, lalu sinkron
`db/schema.ts` dan folder `drizzle/` ke `../pintarpy` (lihat CLAUDE.md).

### 2. Service layer yang tidak bergantung session

Server action sekarang mengambil user dari cookie session; bot tidak punya cookie. Logika inti
dipindah ke `lib/finances.ts` (tanpa `"use server"`), menerima `userId` sebagai parameter:

- `addPemasukan(userId, data)`, `editPemasukan(userId, data)`, `deletePemasukan(userId, id)`;
  `data` punya `tanggal?: Date` opsional yang mengisi `createdAt` (kosong = waktu sekarang)
- versi pengeluaran yang sama
- `getSaldo(userId)`: total pemasukan, total pengeluaran, saldo (pakai `sum()` di SQL)
- `getRiwayat(userId, { jenis?, dari?, sampai?, limit })`
- `findByNama(userId, jenis, kataKunci)`: untuk "hapus parkir tadi"

`lib/actions/finances.ts` menjadi pembungkus tipis: baca session, panggil service. Cek
kepemilikan dan rate limiter tetap di satu tempat.

### 3. LLM

- Endpoint OpenAI-compatible: `POST ${AI_ZENIO_GATEWAY}/chat/completions`, header
  `Authorization: Bearer ${AI_ZENIO_API_KEY}`. Pakai `fetch` biasa, tidak perlu SDK.
- Model dicoba berurutan dari env `AI_MODELS` (dipisah koma). Default:
  1. `openrouter/google/gemma-4-31b-it:free`
  2. `openrouter/nvidia/nemotron-3-super-120b-a12b:free`
  3. `openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`
  4. `cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast` (cadangan terakhir yang stabil)
- Jangan andalkan `response_format`/tool calling (belum tentu didukung model gratis). Minta JSON
  lewat system prompt, ambil objek JSON **pertama** dari jawaban, validasi dengan zod. Semua model
  gagal atau hasil tidak valid = balas "Maaf, aku belum paham. Contoh: `makan siang 25rb`".
- System prompt berisi: tanggal hari ini (WIB), daftar `KATEGORI_PEMASUKAN` dan
  `KATEGORI_PENGELUARAN`, aturan konversi nominal ("25rb" = 25000, "1,5jt" = 1500000), dan
  contoh input-output untuk **setiap** aksi, termasuk edit ("yang bensin tadi ternyata 60rb").
- Timeout per model (mis. 15 detik), lalu pindah ke model berikutnya.

Hasil tes gateway (2026-09-15, 4 pesan contoh per model):

| Model | Hasil |
|-------|-------|
| gemma-4-31b-it:free | 4/4 ditolak `429` (rate limit upstream bersama) |
| nemotron-3-super:free | 2/4 ok, sisanya `Service temporarily overloaded`; 1–6 detik |
| nemotron-3-nano-omni-reasoning:free | 3/4 ok, 1 `ResourceExhausted`; 2–4 detik, token reasoning banyak |
| cf llama-3.3-70b | 4/4 ok, 1–10 detik |
| cf mistral-small-3.1-24b | 4/4 ok, tapi sekali mengembalikan dua objek JSON |

Pelajaran dari tes:

- **Error bisa datang dengan HTTP 200.** Gateway mengembalikan `{"error": ...}` diikuti
  `data: [DONE]` dengan status 200. Anggap gagal kalau tidak ada `choices[0].message.content`,
  bukan hanya kalau status bukan 2xx.
- Kalau JSON-nya keluar, bentuknya sudah benar (nominal "8,5jt" jadi 8500000, kategori cocok).
- Tanpa contoh aksi edit di prompt, "yang bensin tadi ternyata 60rb" dibaca sebagai tambah atau
  hapus. Contoh edit di system prompt wajib ada.

Bentuk intent (zod discriminated union di `lib/telegram/intent.ts`):

```ts
// Semua tanggal berformat "YYYY-MM-DD" (WIB), null = tidak disebut
type Intent =
  | { aksi: "tambah"; jenis: "pemasukan" | "pengeluaran"; nama: string; nominal: number;
      kategori: string; tanggal: string | null }
  | { aksi: "edit"; jenis: "pemasukan" | "pengeluaran" | null; kataKunci: string; tanggal: string | null;
      perubahan: { nama?: string; nominal?: number; kategori?: string; tanggal?: string } }
  | { aksi: "hapus"; jenis: "pemasukan" | "pengeluaran" | null; kataKunci: string; tanggal: string | null }
  | { aksi: "saldo" }
  | { aksi: "riwayat"; jenis: "pemasukan" | "pengeluaran" | null; dari: string | null; sampai: string | null }
  | { aksi: "tidak_dikenal" };
```

- `nominal` wajib > 0 (zod schema yang ada masih mengizinkan 0).
- `kategori` di luar daftar diganti `"Lainnya"`.
- `tanggal` di intent edit/hapus mempersempit pencarian ("hapus parkir kemarin");
  `perubahan.tanggal` memindahkan transaksi ke tanggal lain.

### Tanggal dari kata-kata user

User boleh menyebut "kemarin", "tadi pagi", "Senin kemarin", "tanggal 3", "minggu ini", dll.

- LLM yang menerjemahkan kata-kata itu menjadi `YYYY-MM-DD`. System prompt memuat tanggal
  hari ini **dan nama harinya** dalam WIB (mis. "Selasa, 2026-09-15"), plus contoh: "kemarin",
  "Senin kemarin", "tanggal 3" (= bulan berjalan, atau bulan lalu kalau tanggal 3 belum lewat),
  "minggu ini" untuk riwayat.
- Server memvalidasi hasilnya dengan zod: format benar, tidak di masa depan, dan tidak lebih dari
  1 tahun ke belakang. Di luar itu, bot bertanya ulang, bukan menebak.
- Tanggal selain hari ini disimpan pukul 12:00 WIB, bukan 00:00. Kolom `created_at` adalah
  `timestamp` tanpa zona waktu dan filter bulan memakai zona waktu server, jadi jam tengah hari
  menjaga transaksi tetap di tanggal yang sama walau server berjalan di UTC.
- Balasan bot selalu menyebut tanggalnya ("Tercatat: Bensin Rp 50.000, Senin 14 Sep"), supaya
  salah tafsir langsung terlihat dan bisa diurungkan.
- Form tambah/edit di dashboard belum punya input tanggal. Menambahkannya di luar cakupan plan
  ini, tapi service sudah siap karena `tanggal` opsional.

### 4. Edit dan hapus selalu lewat konfirmasi

LLM tidak tahu ID transaksi, jadi:

1. Service mencari transaksi terbaru milik user yang cocok dengan `kataKunci`.
2. Bot membalas ringkasan + tombol inline `[Ya] [Batal]` (satu kandidat) atau daftar pilihan
   (beberapa kandidat).
3. Tombol mengirim `callback_query` dengan data mis. `del:pengeluaran:123`. Route
   memverifikasi ulang kepemilikan lewat service sebelum menjalankan.

Tambah langsung disimpan, lalu balasan menampilkan hasilnya plus tombol `[Urungkan]`.

`riwayat` menampilkan tiap transaksi dengan tombol `[Edit] [Hapus]`.

### 5. Keamanan dan keandalan

- Daftarkan webhook dengan `secret_token`; route menolak request tanpa header yang cocok.
- Hanya proses chat private (abaikan grup/channel).
- Rate limit per chat untuk pemanggilan LLM (key `tg_<chatId>`), terpisah dari limiter form.
- Telegram mengirim ulang update kalau respons lambat/gagal. Simpan `update_id` di Redis
  (`SET NX EX 3600`) supaya transaksi tidak tercatat dua kali.
- Batas waktu webhook: panggilan LLM bisa lambat. Naikkan timeout handler grammY dan pastikan
  route tetap membalas 200 walau LLM gagal (pesan error dikirim ke chat, bukan lewat status HTTP).
- Jangan log isi pesan beserta token/secret.

### 6. Library

`grammy` untuk bot (tipe TypeScript, inline keyboard, `webhookCallback(bot, "std/http")` untuk
route Next.js). Route harus `export const runtime = "nodejs"` karena memakai `pg` dan `ioredis`.

## Env baru

| Nama | Isi |
|------|-----|
| `TELEGRAM_BOT_TOKEN` | token dari @BotFather |
| `TELEGRAM_BOT_USERNAME` | username bot tanpa `@`, untuk deep link |
| `TELEGRAM_WEBHOOK_SECRET` | string acak, dikirim Telegram di header; nilainya sama di `.env` lokal dan produksi |
| `AI_ZENIO_GATEWAY` | `https://ai.zenio.id/v1` |
| `AI_ZENIO_API_KEY` | API key gateway |
| `AI_MODELS` | opsional, daftar model dipisah koma; default lihat bagian LLM |

Tambahkan juga ke `.env.example` (tanpa nilai).

## Development lokal

Dev dan produksi memakai **satu bot yang sama**. Ini aman selama pemakainya masih sedikit dan
`.env` lokal memakai DB produksi (akun yang terhubung sama di kedua lingkungan).

Konsekuensinya: satu bot hanya punya satu webhook. Selama webhook diarahkan ke tunnel lokal, bot
produksi tidak menerima pesan, dan semua pesan (termasuk dari user lain) diproses laptop. Selesai
development, arahkan webhook kembali ke produksi.

```bash
cloudflared tunnel --url http://localhost:3001      # dapat URL https://xxx.trycloudflare.com
curl "https://api.telegram.org/bot$TOKEN/setWebhook" \
  -d url=https://xxx.trycloudflare.com/api/telegram \
  -d secret_token=$SECRET \
  -d 'allowed_updates=["message","callback_query"]'
```

Simpan sebagai script `scripts/set-telegram-webhook.ts` dengan argumen `dev <url-tunnel>` atau
`prod`, supaya berpindah arah webhook cukup satu perintah.

Buat bot dev terpisah kalau bot sudah dipakai user lain, atau kalau dev pindah ke DB lokal.

## Tahapan

1. **Persiapan**: buat satu bot di @BotFather, isi env, tes gateway LLM dengan satu request
   manual (pastikan model menjawab JSON dengan benar).
2. **Service layer**: pindahkan logika ke `lib/finances.ts`, server action jadi pembungkus.
   Dashboard harus tetap jalan persis sama.
3. **Schema**: tabel `telegram_link`, generate migrasi, sinkron ke pintarpy.
4. **Linking**: tombol di dashboard + `/start <kode>` + `/putus`.
5. **Webhook dasar**: route, verifikasi secret, dedupe, rate limit, `/saldo` dan `/riwayat` tanpa
   LLM. Bukti alur ujung ke ujung.
6. **LLM + tambah**: `lib/llm.ts`, parser intent, aksi tambah + tombol urungkan.
7. **Edit dan hapus**: pencarian kandidat + tombol konfirmasi.
8. **Deploy**: env produksi, `setWebhook` ke domain produksi, update CLAUDE.md.

## Pertanyaan terbuka

- Tombol "Hubungkan Telegram" ditaruh di mana: dashboard utama atau halaman pengaturan baru?
- Perlu mode bot perintah biasa (`/masuk 50000 Gaji`) sebagai cadangan kalau LLM sedang down?
