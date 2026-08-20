This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database bersama (pintarpy + finance-zenio)

Kedua project memakai **satu Postgres** dan **satu tabel `user`** (better-auth),
dengan file `db/schema.ts` yang identik di kedua repo.

**Source of truth migration: repo `finance-zenio`.** Migration hanya di-generate di
sana, lalu folder `drizzle/` disalin ke `pintarpy` supaya keduanya sinkron.

### Menjalankan DB lokal

```bash
# Postgres didefinisikan di finance-zenio/docker-compose.yml
cd finance-zenio
docker compose up -d db          # container: shared-postgres, port 5432, db: zenio_pintarpy
```

`DATABASE_URL` (lihat `.env.example`):

- dari host&nbsp;&nbsp;: `postgresql://postgres:postgres@localhost:5432/zenio_pintarpy`
- dari docker: `postgresql://postgres:postgres@shared-postgres:5432/zenio_pintarpy`

### Mengubah skema

```bash
# 1. edit db/schema.ts (WAJIB disalin ke repo satunya juga)
cd finance-zenio
npx drizzle-kit generate --name <nama_perubahan>
npx drizzle-kit migrate

# 2. sinkronkan ke pintarpy
cp db/schema.ts ../pintarpy/db/schema.ts
rm -rf ../pintarpy/drizzle && cp -r drizzle ../pintarpy/drizzle
```

### Aturan yang tidak boleh dilanggar

- **`BETTER_AUTH_SECRET` harus sama persis di kedua `.env`.** Kalau berbeda, sesi
  tidak bisa dipakai lintas app.
- **Versi `better-auth` di-pin eksak (`1.4.6`) di kedua `package.json`.** Keduanya
  membaca tabel auth yang sama, jadi upgrade harus dilakukan serentak di kedua repo
  (versi ≥1.7 menambah kolom `account.issuer` yang butuh migration baru).
- `db/schema.ts` harus byte-identik di kedua repo.

### Menjalankan app

```bash
cd pintarpy      && npm run dev    # http://localhost:3000
cd finance-zenio && npm run dev    # http://localhost:3001
```

Seed materi pintarpy: `cd pintarpy && npm run db:seed`
