# Plan: Multi-wallet

Satu akun bisa punya beberapa wallet (Cash, BCA, GoPay, ...). Setiap pemasukan dan pengeluaran
tercatat di satu wallet, dan saldo bisa dilihat per wallet maupun total.

Branch: `feat/multi-wallet`.

## Keputusan

- Wallet cukup punya **nama**. Tidak ada kolom tipe (cash/bank/e-wallet).
- **Saldo dihitung, tidak disimpan**: `saldoAwal + SUM(pemasukan) − SUM(pengeluaran)` per wallet.
  Kolom saldo terpisah gampang melenceng setiap ada edit/hapus yang lupa memperbaruinya.
- `saldoAwal` ada supaya rekening yang sudah berisi uang tidak perlu dicatat sebagai pemasukan
  palsu.
- Setiap user punya tepat **satu wallet default**. Dipakai saat wallet tidak dipilih (bot
  WhatsApp, form yang belum diisi).
- Wallet yang sudah punya transaksi **tidak bisa dihapus**, hanya diarsipkan. Wallet kosong boleh
  dihapus.
- **Di luar cakupan tahap ini**: transfer antar-wallet. Nanti dibuat tabel `transfer` sendiri
  supaya transfer tidak menggelembungkan total pemasukan/pengeluaran di laporan.

## Urutan kerja

| # | Bagian | File utama |
|---|--------|------------|
| 1 | Skema DB | `db/schema.ts` |
| 2 | Migrasi + backfill | `drizzle/0007_tambah_wallet.sql` (hasil generate, lalu diedit) |
| 3 | Backup + jalankan migrasi | (perintah, bukan file) |
| 4 | Sinkron ke pintarpy | `../pintarpy/db/schema.ts`, `../pintarpy/drizzle/` |
| 5 | Zod schema | `lib/types.ts` |
| 6 | Service wallet | `lib/wallets.ts` (baru) |
| 7 | Service transaksi | `lib/finances.ts` |
| 8 | Server action | `lib/actions/wallets.ts` (baru), `lib/actions/finances.ts` |
| 9 | Halaman kelola wallet | `app/dashboard/wallet/` (baru), sidebar |
| 10 | Form transaksi | `add-new-*.tsx`, `edit-*.tsx` (dua modul) |
| 11 | Halaman daftar + filter | `pemasukan/page.tsx`, `pengeluaran/page.tsx`, tabel, `components/wallet-filter.tsx` (baru) |
| 12 | Dashboard | `app/dashboard/page.tsx` |
| 13 | Export CSV | `app/api/export/route.ts`, `components/export-button.tsx` |
| 14 | Bot WhatsApp | `lib/whatsapp/intent.ts`, `bot.ts`, `state.ts`, halaman `whatsapp` |
| 15 | Verifikasi | `tsc`, lint, build, uji manual |

### Kenapa migrasinya dua tahap

Development memakai database production, dan aplikasi lama tetap jalan di sana selama fitur ini
dikerjakan. Aplikasi lama tidak mengisi `wallet_id`. Kalau kolom itu langsung `NOT NULL`, setiap
transaksi baru dari dashboard live dan bot WhatsApp akan gagal sampai kode baru di-deploy.

Jadi:

- **Migrasi A** (`0007`, sekarang, langkah 1–3): tabel `wallet`, kolom `wallet_id` **nullable**,
  backfill, FK, index. Aplikasi lama tetap bisa insert (nilainya `NULL`; composite FK melewati
  baris yang salah satu kolomnya `NULL`).
- **Migrasi B** (`0008`, saat deploy): backfill ulang baris `NULL` yang masuk selama development,
  lalu `SET NOT NULL`. Lihat bab "Deploy".

Selama di antara A dan B, tipe `walletId` di TypeScript adalah `number | null`, jadi tampilan
memakai `wallet?.nama ?? "-"`. Kode yang menulis selalu mengisinya.

---

## 1. Skema DB (`db/schema.ts`)

Tabel `wallet` diletakkan **di atas** `pengeluaran`/`pemasukan`, karena kedua tabel itu
merujuknya.

Tambahan import: `unique`, `foreignKey` dari `drizzle-orm/pg-core`, dan `sql` dari `drizzle-orm`.

```ts
// TABLE WALLET: satu user banyak wallet, tepat satu default
export const wallet = pgTable(
  "wallet",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    nama: text("nama").notNull(),
    saldoAwal: numeric("saldo_awal", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    isDefault: boolean("is_default").notNull().default(false),
    // Wallet yang punya transaksi diarsipkan, bukan dihapus
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // Target composite FK dari tabel transaksi
    unique("wallet_id_user_id_uq").on(table.id, table.userId),
    // Nama unik per user tanpa peduli huruf besar/kecil; bot mencari wallet lewat nama
    uniqueIndex("wallet_user_id_nama_uq").on(
      table.userId,
      sql`lower(${table.nama})`,
    ),
    uniqueIndex("wallet_default_per_user_uq")
      .on(table.userId)
      .where(sql`${table.isDefault} = true`),
  ],
);
```

Di `pengeluaran` dan `pemasukan`: tambah kolom dan argumen ketiga `pgTable`. Untuk migrasi A,
kolomnya **tanpa** `.notNull()`; itu ditambahkan saat deploy (migrasi B).

```ts
    walletId: integer("wallet_id"),
  },
  (table) => [
    // (wallet_id, user_id) harus menunjuk wallet milik user yang sama
    foreignKey({
      name: "pengeluaran_wallet_fk",
      columns: [table.walletId, table.userId],
      foreignColumns: [wallet.id, wallet.userId],
    }),
    index("pengeluaran_wallet_id_idx").on(table.walletId),
  ],
```

Kenapa composite FK `(wallet_id, user_id)` dan bukan FK biasa ke `wallet.id`: `walletId` datang
dari form, jadi bisa diisi ID wallet milik orang lain. FK biasa menerima itu. Composite FK
membuat database sendiri menolaknya, jadi tetap aman walau suatu jalur kode lupa mengecek.

Kenapa **tidak** pakai `onDelete: "restrict"`: saat user dihapus, `wallet` dan transaksi sama-sama
ikut terhapus (cascade). `RESTRICT` dicek seketika dan bisa menggagalkan cascade itu, sedangkan
default `NO ACTION` dicek di akhir statement, setelah transaksinya juga sudah terhapus. Efeknya
untuk penghapusan wallet biasa tetap sama: ditolak kalau masih ada transaksi.

Relations, tambahkan:

- `userRelations`: `wallets: many(wallet)`.
- `walletRelations` baru: `user: one(user, ...)`, `pemasukan: many(pemasukan)`,
  `pengeluaran: many(pengeluaran)`.
- `pemasukanRelations` dan `pengeluaranRelations`: `wallet: one(wallet, { fields: [x.walletId],
  references: [wallet.id] })`. Ini yang memungkinkan `db.query.pemasukan.findMany({ with:
  { wallet: true } })`.

## 2. Migrasi A + backfill

1. `npm install` (belum terpasang di mesin ini).
2. `npx drizzle-kit generate --name tambah_wallet`
3. **Tambahkan backfill** ke SQL hasil generate, setelah `ADD COLUMN` dan sebelum FK/index.
   Pisahkan setiap statement dengan `--> statement-breakpoint`.

```sql
CREATE TABLE "wallet" (...);                                -- hasil generate
ALTER TABLE "pengeluaran" ADD COLUMN "wallet_id" integer;   -- hasil generate
ALTER TABLE "pemasukan" ADD COLUMN "wallet_id" integer;     -- hasil generate

-- Tambahan manual: wallet "Utama" untuk setiap user, lalu semua transaksi lama masuk ke sana
INSERT INTO "wallet" ("user_id", "nama", "is_default")
SELECT "id", 'Utama', true FROM "user";
UPDATE "pengeluaran" t SET "wallet_id" = w."id"
FROM "wallet" w WHERE w."user_id" = t."user_id" AND w."is_default";
UPDATE "pemasukan" t SET "wallet_id" = w."id"
FROM "wallet" w WHERE w."user_id" = t."user_id" AND w."is_default";

-- Sisanya (FK, index) hasil generate
```

Snapshot dan `_journal.json` tetap dari drizzle-kit, jadi ini tidak melanggar aturan "jangan
tulis migrasi manual". Backfill hanya mengubah data, bukan struktur, jadi snapshot tetap cocok.

Cek di SQL hasil generate:

- Index `wallet_user_id_nama_uq` berisi `lower("nama")`.
- Index default ber-`WHERE ... = true`. Kalau drizzle-kit menulis kolomnya dengan nama tabel
  (`"wallet"."is_default"`), itu masih valid di Postgres.
- Tidak ada perubahan pada tabel pintarpy (`course`, `user_course_progress`, `blog_post`).

User yang mendaftar **setelah** migrasi (termasuk lewat pintarpy) belum punya wallet. Itu
ditangani `pastikanWalletDefault()` di langkah 6.

## 3. Backup + jalankan migrasi

Database ini production. `pg_dump` dan docker belum ada di mesin ini, jadi pilih salah satu:

- Backup dari panel server database (kalau host-nya Coolify: Backups → Backup now), atau
- Pasang client yang versinya sama dengan server (PostgreSQL 18):
  `sudo apt install postgresql-client-18`, lalu
  `pg_dump "$DATABASE_URL" -Fc -f backup-sebelum-wallet.dump`.

Opsional tapi disarankan: **uji kering** (dry run). Jalankan isi file migrasi di dalam
`BEGIN; ... ROLLBACK;`, lalu cek jumlah baris yang `wallet_id`-nya masih kosong. Database tidak
berubah karena semuanya dibatalkan di akhir.

Lalu: `npx drizzle-kit migrate`.

Cek setelahnya:

```sql
SELECT count(*) FROM pemasukan WHERE wallet_id IS NULL;   -- 0 tepat setelah migrasi
SELECT count(*) FROM pengeluaran WHERE wallet_id IS NULL; -- 0 tepat setelah migrasi
SELECT count(*) FROM wallet;                              -- = jumlah user
```

Setelah ini, transaksi dari aplikasi live akan masuk dengan `wallet_id = NULL` sampai deploy.
Itu memang diharapkan, dan dibereskan migrasi B.

## 4. Sinkron ke pintarpy

```bash
cp db/schema.ts ../pintarpy/db/schema.ts
rm -rf ../pintarpy/drizzle && cp -r drizzle ../pintarpy/drizzle
cmp db/schema.ts ../pintarpy/db/schema.ts && diff -rq drizzle ../pintarpy/drizzle
```

pintarpy tidak memakai tabel wallet, jadi kodenya tidak perlu diubah. Commit di repo pintarpy
juga.

---

## 5. Zod schema (`lib/types.ts`)

- Tipe `Wallet = InferSelectModel<typeof wallet>`.
- `MAX_NAMA_WALLET = 50`.
- `WalletFormSchema`: `nama` (trim, 1–50), `saldo_awal` (number, `>= 0`, `<= MAX_NOMINAL`).
- `EditWalletSchema = WalletFormSchema.extend({ id: IdSchema })`.
- `PemasukanFormSchema` dan `PengeluaranFormSchema`: tambah `wallet_id: IdSchema`. Schema `Edit*`
  ikut otomatis lewat `.extend`, jadi edit transaksi juga bisa memindahkannya ke wallet lain.

## 6. Service wallet (`lib/wallets.ts`, baru)

Sama seperti `lib/finances.ts`: menerima `userId`, tidak pernah membaca session, dan semua query
difilter `userId`.

| Fungsi | Isi |
|--------|-----|
| `pastikanWalletDefault(userId)` | Ambil wallet default; kalau belum ada, buat "Utama" dengan `onConflictDoNothing()` lalu ambil ulang. Dua request bersamaan tidak menghasilkan dua default karena ada partial unique index. |
| `getWallets(userId, { termasukArsip })` | Daftar wallet, default dulu, lalu urut nama. Memanggil `pastikanWalletDefault` dulu. |
| `getSaldoPerWallet(userId)` | Satu query: wallet `LEFT JOIN` subquery `SUM` per `wallet_id` dari kedua tabel. Kembalikan `{ id, nama, isDefault, archivedAt, saldo }[]`. |
| `cekWalletAktif(userId, walletId)` | Lempar error "Wallet tidak ditemukan" kalau bukan milik user atau sudah diarsipkan. Dipakai sebelum insert/update transaksi supaya pesan error-nya ramah, bukan error FK. |
| `cariWalletByNama(userId, nama)` | Cocokkan `lower(nama)`, hanya wallet aktif. Untuk bot. |
| `addWallet`, `editWallet` | Nama bentrok (error Postgres `23505`) diubah jadi "Nama wallet sudah dipakai". |
| `setWalletDefault(userId, id)` | Dalam `db.transaction`: semua wallet user `isDefault = false`, lalu yang dipilih `true`. Urutannya penting karena partial unique index. Wallet arsip tidak boleh jadi default. |
| `arsipkanWallet`, `pulihkanWallet` | Wallet default tidak boleh diarsipkan. |
| `deleteWallet(userId, id)` | Tolak kalau default. FK menolak kalau masih ada transaksi (error `23503`), ubah jadi "Wallet masih punya transaksi, arsipkan saja". |

## 7. Service transaksi (`lib/finances.ts`)

- `addPemasukan`/`addPengeluaran`: `await cekWalletAktif(userId, data.wallet_id)` sebelum insert,
  lalu isi `walletId`.
- `editPemasukan`/`editPengeluaran`: sama, dan `.set({ ..., walletId: data.wallet_id })`.
  Catatan: wallet arsip ditolak saat edit, jadi transaksi lama di wallet arsip harus dipindah ke
  wallet aktif kalau mau diedit. Kalau ini mengganggu, longgarkan: izinkan wallet arsip **asal
  sama dengan wallet transaksi itu sekarang**.
- `updateTransaksi` (bot): tambah `walletId?: number` di `PerubahanTransaksi`.
- `getSaldo(userId, walletId?)`: tambahkan `SUM(saldo_awal)` dari wallet, dan filter wallet kalau
  diberikan.
- `Transaksi`: tambah `walletNama: string`. `getRiwayat` dan `cariTransaksi` di-`innerJoin`
  ke `wallet` untuk mengambil namanya, dan `RiwayatFilter` dapat `walletId?: number`.

## 8. Server action

- `lib/actions/wallets.ts` (baru): `AddWallet`, `EditWallet`, `SetWalletDefault`,
  `ArsipkanWallet`, `PulihkanWallet`, `DeleteWallet`. Polanya sama dengan `lib/actions/finances.ts`:
  session, `Schema.parse()`, panggil service.
- `lib/actions/finances.ts`: tidak berubah strukturnya. `wallet_id` ikut tervalidasi karena
  sudah ada di schema.

## 9. Halaman kelola wallet

- `app/dashboard/wallet/page.tsx`: `getUserSessionSSR()` (layout tidak menjaga apa pun), lalu
  `getSaldoPerWallet`. Tampilkan kartu per wallet: nama, badge "Default", saldo, menu aksi.
  Wallet arsip di bagian terpisah di bawah.
- `components/`: `add-wallet.tsx` (dialog form: nama, saldo awal), `edit-wallet.tsx`,
  `wallet-actions.tsx` (dropdown: jadikan default, arsipkan/pulihkan, hapus pakai
  `AlertDialog`). Polanya meniru form pemasukan: react-hook-form + zod, toast, `router.refresh()`.
- `components/ui/app-sidebar.tsx`: item "Wallet" (ikon `Wallet` dari lucide) di bawah Dashboard.

## 10. Form transaksi (dua modul)

- `ButtonAddNewPemasukan`/`ButtonAddNewPengeluaran` dan form edit menerima prop
  `wallets: { id: number; nama: string; isDefault: boolean }[]`. Halaman server yang memakainya
  (halaman daftar dan dashboard) mengambil `getWallets(userId)` lalu meneruskannya.
- Field baru "Wallet" berupa `Select`, di atas field kategori. `SelectItem` butuh value string,
  jadi pakai `String(w.id)` dan `Number(v)` di `onValueChange`.
- Default value form tambah: wallet yang sedang difilter di URL (kalau ada), selain itu wallet
  default. Form edit: `walletId` transaksinya.
- `pemasukan-table.tsx` meneruskan `wallets` ke tombol edit.

## 11. Halaman daftar + filter wallet

- `components/wallet-filter.tsx` (baru): `Select` "Semua wallet" + daftar wallet, mengubah
  `?wallet=<id>` dengan pola yang sama seperti `month-filter.tsx` (hapus `page` saat berubah).
- `pemasukan/page.tsx` dan `pengeluaran/page.tsx`:
  - Baca `params.wallet`, ubah jadi angka; abaikan kalau bukan angka valid.
  - Tambahkan `eq(x.walletId, walletId)` ke `baseWhere` **dan** ke query total all-time dan
    bulan ini, supaya angka di kartu cocok dengan filter.
  - `findMany` pakai `with: { wallet: true }`.
  - Teruskan `walletId` ke `ExportButton`.
- Tabel: kolom "Wallet" setelah "Kategori". Tipe prop data berubah jadi
  `Pemasukan & { wallet: Wallet }`.

## 12. Dashboard (`app/dashboard/page.tsx`)

- Kartu "Saldo" memakai `getSaldo(userId)` (sudah termasuk saldo awal), bukan hitungan manual
  yang sekarang.
- Baris baru di bawah kartu ringkasan: kartu kecil per wallet aktif (nama + saldo), tautan ke
  `/dashboard/wallet`.
- Teruskan `wallets` ke `ButtonAddNew*` versi kecil.
- Grafik dan kategori tetap gabungan semua wallet.

## 13. Export CSV

- `route.ts`: parameter opsional `wallet`. Kalau ada, tambahkan `eq(x.walletId, ...)` ke where
  (sudah difilter `userId`, jadi wallet milik orang lain otomatis kosong). Join ke `wallet`,
  tambah kolom "Wallet" setelah "Kategori", lewat `selCsv`.
- `export-button.tsx`: prop `walletId?: number`.

## 14. Bot WhatsApp

Tujuannya: user bisa menyebut wallet dalam chat ("makan siang 25rb pakai gopay"), dan kalau tidak
disebut, transaksi masuk ke wallet default.

### Intent (`lib/whatsapp/intent.ts`)

- `parseIntent(pesan, namaWallet: string[])`. Daftar nama wallet aktif user dimasukkan ke system
  prompt, supaya LLM memakai nama yang ada.
- Field baru `wallet: Opsional(z.string().min(1))` pada aksi `tambah`, `riwayat`, `saldo`, dan di
  `perubahan` aksi `edit` (untuk "pindahkan kopi tadi ke BCA").
- Aturan prompt tambahan:
  - "Isi `wallet` hanya kalau user menyebut sumber dana. Pakai salah satu nama dari daftar
    wallet. null kalau tidak disebut."
  - Contoh: `"kopi 20rb pakai gopay"` → `wallet: "GoPay"`, `"saldo bca"` →
    `{"aksi":"saldo","wallet":"BCA"}`.
- LLM tetap tidak dipercaya: nama dari LLM selalu dicocokkan ulang ke DB lewat
  `cariWalletByNama`. LLM tidak pernah melihat ID wallet.

### Bot (`lib/whatsapp/bot.ts`)

- Sebelum `parseIntent`, ambil `getWallets(userId)` untuk daftar namanya. Ini sekaligus membuat
  wallet default untuk user baru.
- Helper `walletDariIntent(userId, nama | undefined)`:
  - Tidak disebut → wallet default.
  - Disebut dan cocok → wallet itu.
  - Disebut tapi tidak cocok → **jangan simpan**. Balas "Wallet "X" tidak ada. Wallet kamu: Cash,
    BCA, GoPay." Menyimpan diam-diam ke wallet default lebih berbahaya karena saldo jadi salah
    tanpa disadari.
- `simpanTambah`: isi `wallet_id`, balasan menyebut wallet:
  `Tercatat: Kopi -Rp20.000 (Makanan & Minuman) · GoPay, 6 Okt 2026`.
- `balasSaldo`: tanpa wallet → total plus rincian per wallet aktif dari `getSaldoPerWallet`.
  Dengan wallet → saldo wallet itu saja.
- `balasRiwayat`: teruskan `walletId` ke filter. `ringkas()` menampilkan nama wallet.
- `jalankanPilihan` (edit): kalau `perubahan.wallet` ada, cocokkan dulu, lalu isi
  `perubahan.walletId`.
- `BANTUAN`: tambahkan contoh "kopi 20rb pakai gopay" dan "saldo bca".
- Perintah tanpa LLM `/saldo` tetap total + rincian per wallet.

### State (`lib/whatsapp/state.ts`)

- `Kandidat`: tambah `walletNama?: string`. **Opsional**, karena data `Pilihan` yang sudah
  tersimpan di Redis sebelum deploy tidak punya field itu (TTL 5 menit, jadi cepat hilang).
- `Pilihan.perubahan`: tambah `wallet?: string`.
- `Terakhir` (target "batal") tidak berubah; hapus transaksi tidak peduli wallet.

### Halaman `app/dashboard/whatsapp/page.tsx`

- Tambahkan "kopi 20rb pakai gopay" ke `CONTOH_PESAN`.

---

## 15. Verifikasi

Otomatis:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Manual (`npm run dev`, buka `http://localhost:3001`). Ingat: ini menulis ke data production,
jadi pakai nominal kecil dan hapus lagi setelahnya.

1. `/dashboard/wallet`: wallet "Utama" ada, ber-badge Default, saldonya sama dengan saldo
   dashboard sebelum migrasi.
2. Buat wallet "Tes" dengan saldo awal 10.000. Saldo total di dashboard naik 10.000.
3. Tambah pengeluaran 1.000 ke "Tes". Saldo "Tes" jadi 9.000; filter `?wallet=` di halaman
   pengeluaran hanya menampilkan transaksi itu; export CSV berisi kolom Wallet.
4. Edit transaksi itu, pindahkan ke "Utama". Saldo kedua wallet berubah.
5. Hapus wallet "Tes" yang masih ada transaksinya → ditolak. Arsipkan → hilang dari dropdown form.
6. Jadikan wallet lain default, cek hanya satu badge Default.
7. Keamanan: panggil action `AddNewPengeluaran` dengan `wallet_id` milik user lain (atau ID
   ngawur) → ditolak "Wallet tidak ditemukan".
8. WhatsApp: "kopi 1rb pakai tes" masuk ke "Tes"; "kopi 1rb" masuk ke default;
   "kopi 1rb pakai ovo" (tidak ada) ditolak dengan daftar wallet; "saldo" menampilkan rincian
   per wallet; "batal" tetap jalan.

## Deploy (termasuk migrasi B)

1. Deploy kode baru dulu: merge `feat/multi-wallet`, `docker compose up -d --build`. Kode baru
   selalu mengisi `wallet_id`, jadi sejak titik ini tidak ada lagi baris `NULL` baru.
2. Di `db/schema.ts`, tambahkan `.notNull()` ke `walletId` di kedua tabel, lalu
   `npx drizzle-kit generate --name wallet_wajib`.
3. Edit SQL hasilnya: sebelum `SET NOT NULL`, tambahkan `UPDATE` yang sama seperti backfill di
   migrasi A, dengan syarat tambahan `AND t."wallet_id" IS NULL`. Tidak perlu `INSERT` wallet,
   karena `pastikanWalletDefault` sudah membuat default untuk user baru.
4. Backup, lalu `npx drizzle-kit migrate`. Cek lagi jumlah `wallet_id IS NULL` = 0.
5. Commit, deploy ulang supaya tipe TypeScript `walletId` jadi `number` (bersihkan `?? "-"` yang
   tidak perlu lagi kalau mau).
6. Sinkronkan `db/schema.ts` dan `drizzle/` ke pintarpy, commit, deploy ulang pintarpy.
