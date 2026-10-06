CREATE TABLE "wallet" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"nama" text NOT NULL,
	"saldo_awal" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_id_user_id_uq" UNIQUE("id","user_id")
);
--> statement-breakpoint
ALTER TABLE "pemasukan" ADD COLUMN "wallet_id" integer;--> statement-breakpoint
ALTER TABLE "pengeluaran" ADD COLUMN "wallet_id" integer;--> statement-breakpoint
-- Backfill manual: wallet "Utama" untuk setiap user, lalu semua transaksi lama masuk ke sana
INSERT INTO "wallet" ("user_id", "nama", "is_default")
SELECT "id", 'Utama', true FROM "user";--> statement-breakpoint
UPDATE "pengeluaran" t SET "wallet_id" = w."id"
FROM "wallet" w WHERE w."user_id" = t."user_id" AND w."is_default";--> statement-breakpoint
UPDATE "pemasukan" t SET "wallet_id" = w."id"
FROM "wallet" w WHERE w."user_id" = t."user_id" AND w."is_default";--> statement-breakpoint
ALTER TABLE "wallet" ADD CONSTRAINT "wallet_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_user_id_nama_uq" ON "wallet" USING btree ("user_id",lower("nama"));--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_default_per_user_uq" ON "wallet" USING btree ("user_id") WHERE "wallet"."is_default" = true;--> statement-breakpoint
ALTER TABLE "pemasukan" ADD CONSTRAINT "pemasukan_wallet_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."wallet"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengeluaran" ADD CONSTRAINT "pengeluaran_wallet_fk" FOREIGN KEY ("wallet_id","user_id") REFERENCES "public"."wallet"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pemasukan_wallet_id_idx" ON "pemasukan" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "pengeluaran_wallet_id_idx" ON "pengeluaran" USING btree ("wallet_id");