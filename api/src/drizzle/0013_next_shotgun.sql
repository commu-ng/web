CREATE TABLE "bot" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"profile_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bot_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"token" uuid DEFAULT uuidv7() NOT NULL,
	"bot_id" uuid NOT NULL,
	"name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "bot_token_token_key" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "public"."community"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_token" ADD CONSTRAINT "bot_token_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bot_community_id" ON "bot" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "idx_bot_token_bot_id" ON "bot_token" USING btree ("bot_id");