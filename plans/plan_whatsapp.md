# Plan: Ganti bot Telegram jadi bot WhatsApp

Menggantikan `plan_telegram.md`. Bot Telegram dibongkar, diganti WhatsApp lewat
[go-whatsapp-web-multidevice](https://github.com/aldinokemal/go-whatsapp-web-multidevice) (GOWA)
yang sudah berjalan di `https://gowa.zenio.id`.

Fitur yang ditargetkan sama persis dengan bot Telegram: tambah/edit/hapus transaksi dengan
bahasa bebas, cek saldo, lihat riwayat.

## Yang dipakai ulang tanpa perubahan

`lib/finances.ts`, `lib/llm.ts`, `lib/telegram/intent.ts`, `lib/telegram/waktu.ts`. Semuanya
tidak tahu-menahu soal Telegram; yang terakhir dua cukup dipindah folder.

Yang dibuang: `grammy`, `lib/telegram/bot.ts`, `app/api/telegram/route.ts`,
`scripts/set-telegram-webhook.ts`.

## Alur besar

```
WhatsApp ──> GOWA ──POST──> /api/whatsapp
                             ├─ verifikasi HMAC X-Hub-Signature-256
                             ├─ saring event ("message" saja), is_from_me, chat grup
                             ├─ buang duplikat (payload.id di Redis)
                             ├─ JID ──> chat_link ──> userId  (belum terhubung? lihat bab Akses)
                             ├─ rate limit per JID
                             ├─ jalur tanpa LLM: HUBUNGKAN, /saldo, /riwayat, batal, angka
                             ├─ kuota LLM harian per user
                             └─ pesan ──> LLM ──> intent (zod) ──> lib/finances.ts ──> balas
```

Balasan dikirim balik lewat `POST ${WA_API_URL}/send/message`.

## Bentuk payload webhook (diverifikasi 2026-09-20)

```json
{
  "device_id": "6288975523817@s.whatsapp.net",
  "event": "message",
  "session_id": "c1b90cb4-c852-407b-be50-6661939fe079",
  "payload": {
    "body": "Halo, testing masuk",
    "chat_id": "6281216680537@s.whatsapp.net",
    "chat_lid": "244319415980056@lid",
    "from": "6281216680537@s.whatsapp.net",
    "from_lid": "244319415980056@lid",
    "from_name": "deardosatria_",
    "id": "AC5B2AFFCD9383EDA8267C97C47D77E1",
    "is_from_me": false,
    "sender_display_name": "Me Satria",
    "timestamp": "2026-09-20T10:44:03Z"
  }
}
```

Catatan penting:

- Teks ada di `payload.body`, bukan `payload.message.text`.
- `payload.id` dipakai untuk dedupe, menggantikan `update_id` Telegram.
- `is_from_me: true` **wajib** diabaikan. Balasan bot sendiri juga memicu webhook; tanpa filter
  ini bot bisa membalas dirinya sendiri tanpa henti.
- Chat grup punya `chat_id` berakhiran `@g.us`. Hanya proses `@s.whatsapp.net` — padanan
  `bot.chatType("private")` di grammy.
- GOWA mengirim event lain juga (`message.ack`, `presence`, dll). Selain `event === "message"`
  dibalas 200 lalu diabaikan.
- Header `X-Hub-Signature-256` **tetap dikirim walau kolom Secret di GOWA kosong** (server pakai
  default `"secret"`). Secret wajib diisi nilai acak sebelum produksi.

## Identitas user: JID dan LID

WhatsApp punya dua identitas per orang: nomor telepon (`628...@s.whatsapp.net`) dan LID
(`2443...@lid`, identitas anonim untuk user yang menyembunyikan nomornya). Di payload di atas
keduanya terisi, tapi untuk sebagian user `from` bisa datang sebagai `@lid` saja.

Kalau link disimpan hanya berdasarkan nomor, user seperti itu akan selamanya dianggap belum
terhubung. Karena itu tabel menyimpan keduanya dan pencarian memakai `OR`.

## Schema

`telegram_link` diganti `chat_link` (tabel lama di-drop, data tidak bisa dimigrasikan karena
JID bukan chat ID Telegram; semua user harus hubungkan ulang).

```ts
// TABLE CHAT_LINK: satu akun satu nomor WhatsApp, satu nomor satu akun
export const chatLink = pgTable("chat_link", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique()
    .references(() => user.id, { onDelete: "cascade" }),
  // JID nomor telepon, mis. "628123456789@s.whatsapp.net"
  chatId: text("chat_id").notNull().unique(),
  // LID, identitas anonim WhatsApp. Sebagian user hanya dikenali lewat ini.
  chatLid: text("chat_lid").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

`getUserIdByChat(jid, lid)` mencari `chatId = jid OR chatLid = lid`. Saat linking, keduanya
disimpan dari payload. Kalau saat lookup ketemu lewat satu kolom sementara kolom satunya masih
kosong, isi yang kosong (backfill diam-diam).

Schema dibagi dengan pintarpy: setelah `drizzle-kit generate`, sinkron `db/schema.ts` dan folder
`drizzle/` ke `../pintarpy` (lihat CLAUDE.md).

## Linking

Tidak ada deep link `?start=<kode>` seperti Telegram, tapi `wa.me` punya padanan yang sama
enaknya: teks sudah terisi, user tinggal menekan kirim.

1. Dashboard `/dashboard/whatsapp`, tombol "Hubungkan WhatsApp". Server action membuat kode acak
   (`randomBytes(8).toString("hex")`, huruf/angka saja supaya aman di URL), simpan di Redis
   `wa_link:<kode>` = userId, TTL 10 menit.
2. Tampilkan tombol ke `https://wa.me/${WA_BOT_NUMBER}?text=HUBUNGKAN%20<kode>`.
3. Bot menerima pesan `HUBUNGKAN <kode>` (case-insensitive), `GETDEL` kodenya dari Redis
   supaya sekali pakai, hapus link lama milik userId/JID itu, lalu insert.
4. Putus: tombol di dashboard, atau kirim `PUTUS` ke bot.

Kode dicek sebelum semua pengecekan lain yang butuh link, karena ini satu-satunya pesan sah dari
nomor yang belum terhubung.

## Akses: siapa yang boleh memakai bot

Masalahnya: nomor WhatsApp bersifat publik. Siapa pun yang tahu nomornya bisa mengirim pesan,
dan tiap pesan yang lolos sampai ke LLM menghabiskan token. Pertahanannya berlapis, dari yang
paling murah ke paling mahal — pesan ditolak di lapisan sedini mungkin.

Tidak ada allowlist nomor: siapa pun yang punya akun finance-zenio boleh memakai bot, asal sudah
menghubungkan akunnya dari dashboard.

### Lapisan 1 — gerbang link

Pesan dari JID yang tidak ada di `chat_link` **tidak pernah sampai ke LLM**. Ini pertahanan utamanya.

Tapi membalas "kamu belum terhubung" ke setiap pesan orang asing juga punya biaya: pulsa kirim,
dan nomor bot jadi ketahuan aktif sehingga mengundang spam lanjutan. Jadi balasan itu dikirim
**maksimal sekali per 24 jam per nomor** (`wa_unlinked:<jid>` di Redis, `SET NX EX 86400`).
Pesan berikutnya dari nomor yang sama didiamkan sepenuhnya.

Percobaan `HUBUNGKAN <kode>` yang gagal juga dibatasi (5 kali per jam per JID) supaya kode tidak
bisa ditebak dengan brute force. Kode 16 karakter hex praktis tidak bisa ditebak, tapi batas ini
membuat biayanya nol.

### Lapisan 2 — rate limit per JID

Seperti yang sudah ada untuk Telegram: 10 pesan per 60 detik per JID
(`rate-limiter-flexible`, keyPrefix `rate_limit_wa`). Melindungi dari user sah yang menempel
tombol kirim, bukan dari penyerang.

### Lapisan 3 — jalur tanpa LLM

Pesan yang bentuknya sudah pasti tidak perlu LLM sama sekali: `HUBUNGKAN`, `PUTUS`, `/saldo`,
`/riwayat`, `batal`, dan balasan angka untuk memilih kandidat. Dicek dengan pencocokan biasa
sebelum LLM dipanggil. Ini memotong sebagian besar pemakaian sehari-hari.

Pesan lebih panjang dari 500 karakter dipotong sebelum dikirim ke LLM (sudah ada di `intent.ts`).

### Lapisan 4 — kuota LLM harian per user

Yang benar-benar membatasi biaya token. `wa_llm:<userId>:<YYYY-MM-DD>` di Redis, `INCR` dengan
`EX` sampai akhir hari. Lewat batas (default 100, dari env `WA_LLM_QUOTA_HARIAN`), bot membalas
"Kuota AI harian habis, coba lagi besok. Sementara ini pakai /saldo dan /riwayat."

Kuota dihitung per **akun**, bukan per nomor, supaya tidak bisa diakali dengan ganti nomor.

### Urutan pengecekan di handler

Urutannya menentukan efektivitas, jadi ditulis eksplisit:

1. Verifikasi HMAC — request tanpa tanda tangan sah ditolak `401`, tidak di-parse lebih jauh.
2. `event === "message"`, `is_from_me === false`, `chat_id` bukan `@g.us`.
3. Dedupe `payload.id`.
4. `HUBUNGKAN` / `PUTUS`.
5. Lookup `chat_link`. Tidak ketemu → balas sekali per 24 jam, selesai.
6. Rate limit per JID.
7. Jalur tanpa LLM.
8. Kuota LLM harian.
9. LLM.

### Yang tidak dilindungi lapisan mana pun

Nomor bot bisa dibanjiri pesan oleh siapa saja, dan itu tetap menghabiskan resource di server
GOWA serta bisa memancing tindakan dari Meta. Tidak ada cara mencegahnya dari sisi app selain
memblokir nomornya di WhatsApp. Kalau ini jadi masalah nyata, pilihan berikutnya adalah pindah
ke WhatsApp Business API resmi.

## Pengganti tombol

WhatsApp lewat GOWA tidak punya inline keyboard. Penggantinya balasan teks, dengan state
disimpan di Redis.

**Urungkan transaksi.** Setelah mencatat, bot membalas
`Tercatat: Makan siang -Rp 25.000 (Makanan), Minggu 20 Sep. Balas "batal" untuk urungkan.`
ID transaksinya disimpan di `wa_last:<jid>` = `{jenis, id}`, TTL 5 menit. Pesan `batal`
menghapus transaksi itu lewat service (kepemilikan tetap dicek di `WHERE`, tidak dipercaya dari
Redis).

**Konfirmasi edit/hapus.** Kandidat ditampilkan sebagai daftar bernomor:

```
Mau hapus yang mana?
1. Parkir Rp 5.000, Sabtu 19 Sep
2. Parkir Rp 10.000, Kamis 17 Sep
Balas angkanya, atau "batal".
```

Daftar kandidat disimpan di `wa_pilih:<jid>`, TTL 5 menit. Balasan berupa angka saja dicocokkan
ke daftar itu. Satu kandidat tunggal tetap minta konfirmasi `ya`/`batal`.

Kalau ada state di `wa_pilih`, pesan berikutnya dicek ke situ dulu sebelum masuk ke LLM.

## Klien GOWA (`lib/whatsapp/client.ts`)

Semua env dibaca lazy seperti `lib/redis.ts`, supaya `next build` jalan tanpa env WhatsApp.

- `kirimPesan(jid, teks)` → `POST /send/message`, body `{ phone, message }`.
- `setTyping(jid, aktif)` → `POST /send/chat-presence`, body `{ phone, action: "start"|"stop" }`.
  Dipanggil sebelum LLM, menggantikan `replyWithChatAction("typing")`. Kegagalannya diabaikan.
- Auth: header `Authorization: Basic ${base64(WA_API_AUTH)}`.
- Single-device, jadi header `X-Device-Id` tidak perlu.
- Timeout 10 detik; kegagalan kirim di-log tanpa isi pesan, tidak dilempar ke route.

Terverifikasi lewat curl pada 2026-09-20: `/app/status` dan `/send/message` berjalan dengan
Basic Auth `admin`.

## Route (`app/api/whatsapp/route.ts`)

`export const runtime = "nodejs"` (butuh `pg` dan `ioredis`).

```
const raw = await request.text();          // raw body, HMAC dihitung dari ini
verifikasiTandaTangan(raw, header);        // gagal -> 401
const body = JSON.parse(raw);
```

HMAC: `sha256=` + `createHmac("sha256", WA_WEBHOOK_SECRET).update(raw).digest("hex")`,
dibandingkan dengan `timingSafeEqual`. **Jangan** pakai `request.json()` — HMAC harus dihitung
dari byte asli, bukan hasil re-serialize.

Route selalu membalas `200` untuk request yang tanda tangannya sah, apa pun yang terjadi di
handler. Error diproses jadi balasan chat, bukan status HTTP; kalau route membalas non-200 GOWA
akan mengirim ulang update yang sama.

Pemrosesan LLM bisa belasan detik. Pola yang dipakai: balas `200` **dulu**, proses di belakang
lewat `after()` dari `next/server`, supaya tidak ada risiko timeout di sisi GOWA.

## Env baru

| Nama | Isi |
|------|-----|
| `WA_API_URL` | `https://gowa.zenio.id` |
| `WA_API_AUTH` | `user:pass` dari `APP_BASIC_AUTH` di server GOWA |
| `WA_WEBHOOK_SECRET` | string acak; **harus sama** dengan Secret di dialog webhook GOWA |
| `WA_BOT_NUMBER` | nomor bot tanpa `+`, untuk link `wa.me` |
| `WA_LLM_QUOTA_HARIAN` | opsional, default 100 |

`AI_ZENIO_GATEWAY`, `AI_ZENIO_API_KEY`, `AI_MODELS` tetap seperti sekarang. Env `TELEGRAM_*`
dihapus dari `.env` dan `.env.example`.

Komentar di `.env` ditaruh di baris sendiri, jangan di belakang nilai — sebagian parser tidak
memotongnya dan nilainya jadi ikut terbawa.

## Development lokal

Server GOWA di internet tidak bisa menjangkau `localhost:3001`, jadi butuh tunnel:

```bash
cloudflared tunnel --url http://localhost:3001     # dapat https://xxx.trycloudflare.com
```

Lalu ubah Webhook URL di dashboard GOWA jadi `https://xxx.trycloudflare.com/api/whatsapp`.
Bisa juga lewat API: `PATCH /devices/{device_id}/webhook`, `device_id` ada di `GET /app/status`.

Satu sesi WhatsApp hanya punya satu webhook. Selama diarahkan ke tunnel, produksi tidak menerima
pesan. Selesai development, kembalikan ke domain produksi. Simpan sebagai
`scripts/set-wa-webhook.ts` dengan argumen `dev <url>` atau `prod`.

## Tahapan

1. **Schema**: `telegram_link` → `chat_link` + kolom `chat_lid`, generate migrasi, sinkron ke
   pintarpy.
2. **Klien GOWA**: `lib/whatsapp/client.ts`, verifikasi tanda tangan, tipe payload.
3. **Route dasar**: `/api/whatsapp` dengan seluruh urutan pengecekan bab Akses, `/saldo` dan
   `/riwayat` tanpa LLM. Bukti alur ujung ke ujung lewat tunnel.
4. **Linking**: halaman `/dashboard/whatsapp` + `HUBUNGKAN` + `PUTUS`, hapus halaman Telegram.
5. **LLM + tambah**: pindahkan `intent.ts` dan `waktu.ts`, aksi tambah + `batal`.
6. **Edit dan hapus**: kandidat bernomor + konfirmasi.
7. **Bersih-bersih**: buang `grammy`, folder `lib/telegram/`, route dan script Telegram, env
   `TELEGRAM_*`. Update CLAUDE.md.
8. **Deploy**: isi Secret di GOWA dengan nilai acak, arahkan webhook ke produksi, ganti password
   `APP_BASIC_AUTH` di server GOWA.

## Risiko

GOWA memakai whatsmeow, klien tidak resmi yang login lewat QR seperti WhatsApp Web. Nomornya
bisa diblokir Meta. Untuk bot yang hanya membalas pesan masuk risikonya kecil, tapi kalau kena
blokir semua link putus dan harus scan ulang dengan nomor baru — karena itu `chat_link` dibuat
mudah dibangun ulang (satu klik dari dashboard), bukan sesuatu yang perlu diselamatkan.

## Pertanyaan terbuka

- Perlu perintah teks cadangan (`masuk 50000 gaji`) kalau LLM sedang down?
