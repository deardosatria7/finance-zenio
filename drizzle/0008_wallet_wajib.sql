-- Backfill manual: baris yang masuk tanpa wallet sejak migrasi 0007 dipindah ke wallet default
UPDATE "pemasukan" t SET "wallet_id" = w."id"
FROM "wallet" w WHERE w."user_id" = t."user_id" AND w."is_default"
AND t."wallet_id" IS NULL;--> statement-breakpoint
UPDATE "pengeluaran" t SET "wallet_id" = w."id"
FROM "wallet" w WHERE w."user_id" = t."user_id" AND w."is_default"
AND t."wallet_id" IS NULL;--> statement-breakpoint
ALTER TABLE "pemasukan" ALTER COLUMN "wallet_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pengeluaran" ALTER COLUMN "wallet_id" SET NOT NULL;