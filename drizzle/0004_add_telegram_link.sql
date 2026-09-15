CREATE TABLE "telegram_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_link_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "telegram_link_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
ALTER TABLE "telegram_link" ADD CONSTRAINT "telegram_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;