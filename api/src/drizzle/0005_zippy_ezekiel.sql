CREATE TYPE "public"."board_community_type" AS ENUM('twitter', 'oeee_cafe', 'band', 'mastodon', 'commung', 'discord');--> statement-breakpoint
CREATE TABLE "board" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "board_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "board_hashtag" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_hashtag_tag_key" UNIQUE("tag")
);
--> statement-breakpoint
CREATE TABLE "board_post" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"board_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"image_id" uuid,
	"community_type" "board_community_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "board_post_hashtag" (
	"board_post_id" uuid NOT NULL,
	"hashtag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "board_post_hashtag_pkey" PRIMARY KEY("board_post_id","hashtag_id")
);
--> statement-breakpoint
ALTER TABLE "board_post" ADD CONSTRAINT "board_post_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."board"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post" ADD CONSTRAINT "board_post_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post" ADD CONSTRAINT "board_post_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post_hashtag" ADD CONSTRAINT "board_post_hashtag_board_post_id_fkey" FOREIGN KEY ("board_post_id") REFERENCES "public"."board_post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post_hashtag" ADD CONSTRAINT "board_post_hashtag_hashtag_id_fkey" FOREIGN KEY ("hashtag_id") REFERENCES "public"."board_hashtag"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_hashtag_tag_lower_idx" ON "board_hashtag" USING btree (LOWER("tag"));--> statement-breakpoint
CREATE INDEX "idx_board_post_board_id_created" ON "board_post" USING btree ("board_id","created_at");