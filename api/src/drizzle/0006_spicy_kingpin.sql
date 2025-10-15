CREATE TABLE "masquerade_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"session_id" uuid
);
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "original_user_id" uuid;--> statement-breakpoint
ALTER TABLE "masquerade_audit_log" ADD CONSTRAINT "masquerade_audit_log_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masquerade_audit_log" ADD CONSTRAINT "masquerade_audit_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "masquerade_audit_log" ADD CONSTRAINT "masquerade_audit_log_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_masquerade_audit_log_admin_user" ON "masquerade_audit_log" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "idx_masquerade_audit_log_target_user" ON "masquerade_audit_log" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "idx_masquerade_audit_log_created_at" ON "masquerade_audit_log" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_original_user_id_fkey" FOREIGN KEY ("original_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;