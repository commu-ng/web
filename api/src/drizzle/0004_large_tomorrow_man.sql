CREATE TABLE "post_history" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"post_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_warning" text,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_by_profile_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_history_image" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"post_history_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	CONSTRAINT "unique_post_history_image" UNIQUE("post_history_id","image_id")
);
--> statement-breakpoint
ALTER TABLE "post_history" ADD CONSTRAINT "post_history_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_history" ADD CONSTRAINT "post_history_edited_by_profile_id_fkey" FOREIGN KEY ("edited_by_profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_history_image" ADD CONSTRAINT "post_history_image_post_history_id_fkey" FOREIGN KEY ("post_history_id") REFERENCES "public"."post_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_history_image" ADD CONSTRAINT "post_history_image_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_post_history_post_id_edited_at" ON "post_history" USING btree ("post_id","edited_at");