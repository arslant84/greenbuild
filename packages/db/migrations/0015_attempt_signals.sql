CREATE TABLE "attempt_signals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"signal" text NOT NULL,
	"value" real NOT NULL,
	"weight" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_signals_attempt_signal" UNIQUE("attempt_id","signal")
);
--> statement-breakpoint
ALTER TABLE "attempt_signals" ADD CONSTRAINT "attempt_signals_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE restrict ON UPDATE no action;