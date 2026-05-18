ALTER TABLE "pemasukan" ADD COLUMN "kategori" text NOT NULL DEFAULT 'Lainnya';--> statement-breakpoint
ALTER TABLE "pengeluaran" ADD COLUMN "kategori" text NOT NULL DEFAULT 'Lainnya';
