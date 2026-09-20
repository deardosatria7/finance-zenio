CREATE TABLE "chat_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"chat_lid" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_link_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "chat_link_chat_id_unique" UNIQUE("chat_id"),
	CONSTRAINT "chat_link_chat_lid_unique" UNIQUE("chat_lid")
);
--> statement-breakpoint
ALTER TABLE "chat_link" ADD CONSTRAINT "chat_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;