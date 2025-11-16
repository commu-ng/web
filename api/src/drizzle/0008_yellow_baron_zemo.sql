CREATE TABLE "board_post_reply" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"board_post_id" uuid NOT NULL,
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
ALTER TABLE "board" ADD COLUMN "allow_comments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "board_post_reply_board_post_id_fkey" FOREIGN KEY ("board_post_id") REFERENCES "public"."board_post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "board_post_reply_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "board_post_reply_in_reply_to_id_fkey" FOREIGN KEY ("in_reply_to_id") REFERENCES "public"."board_post_reply"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "board_post_reply_root_reply_id_fkey" FOREIGN KEY ("root_reply_id") REFERENCES "public"."board_post_reply"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_board_post_reply_board_post_id_created" ON "board_post_reply" USING btree ("board_post_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_board_post_reply_in_reply_to_id_created" ON "board_post_reply" USING btree ("in_reply_to_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_board_post_reply_root_reply_id_created" ON "board_post_reply" USING btree ("root_reply_id","created_at");--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "valid_board_post_reply_content" CHECK (length(content) > 0 AND length(content) <= 10000);--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "valid_board_reply_depth" CHECK ((in_reply_to_id IS NULL AND depth = 0) OR (in_reply_to_id IS NOT NULL AND depth > 0));--> statement-breakpoint
ALTER TABLE "board_post_reply" ADD CONSTRAINT "valid_board_root_reply" CHECK ((depth = 0 AND root_reply_id IS NULL) OR (depth > 0 AND root_reply_id IS NOT NULL));