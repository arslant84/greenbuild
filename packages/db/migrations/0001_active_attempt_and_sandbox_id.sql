ALTER TABLE "sandbox_sessions" ADD COLUMN "sandbox_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_one_active_per_user" ON "attempts" USING btree ("user_id") WHERE "attempts"."status" in ('starting', 'ready');--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_sandbox_id_unique" UNIQUE("sandbox_id");