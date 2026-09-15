# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Personal finance tracker (Next.js 15 App Router, React 19, Drizzle + Postgres, better-auth). UI text, domain names, and code comments are in Indonesian: `pemasukan` = income, `pengeluaran` = expense, `nominal` = amount, `kategori` = category.

## Commands

```bash
docker compose up -d db          # shared Postgres (container shared-postgres, localhost:5432, db zenio_pintarpy)
npm run dev                      # http://localhost:3001 (port is fixed in package.json)
npm run build                    # next build --turbopack
npm run lint                     # eslint (next/core-web-vitals + next/typescript)
npx tsc --noEmit                 # typecheck
npx drizzle-kit generate --name <change>   # after editing db/schema.ts
npx drizzle-kit migrate
```

There is no test suite. Copy `.env.example` to `.env`; `REDIS_URL` is needed at runtime for the add actions (rate limiter).

## Shared database with the `pintarpy` repo

This app shares one Postgres database and one better-auth `user`/`session` table set with the sibling repo `../pintarpy`. Rules that must hold:

- `db/schema.ts` must stay byte-identical in both repos. It also contains pintarpy's tables (`course`, `userCourseProgress`, `blogPost`) — don't remove or alter them from here without mirroring the change there.
- This repo is the source of truth for migrations. After generating one, sync: `cp db/schema.ts ../pintarpy/db/schema.ts` and replace `../pintarpy/drizzle` with this `drizzle/` folder.
- `BETTER_AUTH_SECRET` must be identical in both `.env` files, otherwise sessions don't work across apps.
- `better-auth` is pinned exactly to `1.4.6` in both repos; upgrade both at once (≥1.7 adds `account.issuer` and needs a migration).
- `drizzle/0002_add_kategori.sql` was hand-written (no snapshot, out-of-order timestamp in `_journal.json`). Generate new migrations only with `drizzle-kit generate`.

## Architecture

- **No middleware.** Every protected page and route calls `getUserSessionSSR()` (`lib/session.ts`), which redirects to `/auth` when there is no session. `app/dashboard/layout.tsx` does not guard anything, so a new dashboard page must call it itself.
- **Reads** happen directly in async server components with Drizzle (`db` from `@/db`), always filtered by `session.user.id`. Filters (search, month/year, pagination) come from `searchParams`.
- **Writes**: the logic lives in `lib/finances.ts`, which takes `userId` as a parameter and never reads the session (so the planned Telegram bot can reuse it). Edit/delete put `userId` in the `WHERE` and throw when `.returning()` is empty. The server actions in `lib/actions/finances.ts` are thin wrappers: read the session, `Schema.parse()` the input (actions are public endpoints; parsing also strips extra fields like `tanggal`), call the service. Client components (react-hook-form + zod schemas from `lib/types.ts`) call the action, show a `sonner` toast, then `router.refresh()` — there is no `revalidatePath`.
- **Pemasukan and pengeluaran are mirrored modules**: parallel tables, pages (`app/dashboard/{pemasukan,pengeluaran}`), components, actions, and zod schemas. A change to one almost always needs the same change in the other.
- **Money**: `nominal` is `numeric(15,2)`, so Drizzle returns it as a string. Write with `value.toFixed(2)`, read with `Number(...)`, display with `formatRupiah` (accepts string or number) from `lib/utils.ts`.
- **Categories**: allowed values live in `KATEGORI_PEMASUKAN`/`KATEGORI_PENGELUARAN` in `lib/types.ts`; the DB column is free text defaulting to `"Lainnya"`.
- **Rate limiting**: `rate-limiter-flexible` on ioredis (`lib/rate-limiter.ts`), applied only to the add actions. The Redis client in `lib/redis.ts` is lazily created so `next build` works without `REDIS_URL`; keep it lazy.
- **API routes**: `api/auth/[...all]` (better-auth handler) and `api/export` (CSV export of the current user's rows).
- **Auth**: email/password plus Google OAuth (`lib/auth.ts`). The auth route throws if `BETTER_AUTH_SECRET` is empty or equals the Docker build placeholder, because better-auth would otherwise silently fall back to a public default secret.
- **UI**: shadcn/ui (`components/ui`, configured in `components.json`), Tailwind v4, `next-themes`, Recharts in `components/finance-chart.tsx`.

## Deployment

`docker compose up -d` builds the app and starts it with Postgres on the `shared-net` network (pintarpy's compose attaches to it, so this stack starts first). Both ports bind to loopback only (`127.0.0.1:3001`, `127.0.0.1:5432`); public access is through cloudflared on the host. The Dockerfile builds with a placeholder `BETTER_AUTH_SECRET` and a `NEXT_PUBLIC_SITE_URL` build arg (used for `metadataBase`); real secrets come from `.env` at runtime. The runner image includes `drizzle/` and `drizzle.config.ts` so migrations can be run inside the container with `npx drizzle-kit migrate`.
