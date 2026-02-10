CREATE TABLE "community_board" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"allow_comments" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_board_post" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"board_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"image_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "community_board_post_reply" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"in_reply_to_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL,
	"root_reply_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "community_board" ADD CONSTRAINT "community_board_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post" ADD CONSTRAINT "community_board_post_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."community_board"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post" ADD CONSTRAINT "community_board_post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post" ADD CONSTRAINT "community_board_post_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post_reply" ADD CONSTRAINT "community_board_post_reply_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."community_board_post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post_reply" ADD CONSTRAINT "community_board_post_reply_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post_reply" ADD CONSTRAINT "community_board_post_reply_in_reply_to_id_fkey" FOREIGN KEY ("in_reply_to_id") REFERENCES "public"."community_board_post_reply"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_board_post_reply" ADD CONSTRAINT "community_board_post_reply_root_reply_id_fkey" FOREIGN KEY ("root_reply_id") REFERENCES "public"."community_board_post_reply"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_community_board_slug" ON "community_board" USING btree ("community_id","slug") WHERE "community_board"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_community_board_community_id" ON "community_board" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "idx_community_board_post_board_id_created" ON "community_board_post" USING btree ("board_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_community_board_post_reply_post_id_created" ON "community_board_post_reply" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_community_board_post_reply_in_reply_to_id" ON "community_board_post_reply" USING btree ("in_reply_to_id");