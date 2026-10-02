CREATE TABLE "attempt_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"passed" boolean NOT NULL,
	"output_tail" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempt_checks" ADD CONSTRAINT "attempt_checks_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_checks_attempt_created" ON "attempt_checks" USING btree ("attempt_id","created_at");