CREATE TABLE "transfer" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	"dari_wallet_id" integer NOT NULL,
	"ke_wallet_id" integer NOT NULL,
	"nominal" numeric(15, 2) NOT NULL,
	"catatan" text,
	CONSTRAINT "transfer_wallet_beda_ck" CHECK ("transfer"."dari_wallet_id" <> "transfer"."ke_wallet_id"),
	CONSTRAINT "transfer_nominal_positif_ck" CHECK ("transfer"."nominal" > 0)
);
--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_dari_wallet_fk" FOREIGN KEY ("dari_wallet_id","user_id") REFERENCES "public"."wallet"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer" ADD CONSTRAINT "transfer_ke_wallet_fk" FOREIGN KEY ("ke_wallet_id","user_id") REFERENCES "public"."wallet"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transfer_user_id_created_at_idx" ON "transfer" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "transfer_dari_wallet_id_idx" ON "transfer" USING btree ("dari_wallet_id");--> statement-breakpoint
CREATE INDEX "transfer_ke_wallet_id_idx" ON "transfer" USING btree ("ke_wallet_id");