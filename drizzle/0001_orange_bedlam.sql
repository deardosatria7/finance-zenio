CREATE TABLE "pemasukan" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"nama_pemasukan" text NOT NULL,
	"nominal" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pengeluaran" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"nama_pengeluaran" text NOT NULL,
	"nominal" numeric(15, 2) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pemasukan" ADD CONSTRAINT "pemasukan_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pengeluaran" ADD CONSTRAINT "pengeluaran_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;