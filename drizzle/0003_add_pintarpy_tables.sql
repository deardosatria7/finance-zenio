CREATE TYPE "public"."course_status" AS ENUM('locked', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "blog_post" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"img_link" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"times_opened" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "blog_post_title_unique" UNIQUE("title"),
	CONSTRAINT "blog_post_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "course" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"duration" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "course_title_unique" UNIQUE("title")
);
--> statement-breakpoint
CREATE TABLE "user_course_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"course_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"status" "course_status" DEFAULT 'locked' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_course_progress" ADD CONSTRAINT "user_course_progress_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_course_progress_user_id_course_id_uq" ON "user_course_progress" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "user_course_progress_user_id_idx" ON "user_course_progress" USING btree ("user_id");