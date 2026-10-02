CREATE TYPE "public"."attempt_context" AS ENUM('daily', 'catalog', 'assessment', 'duel');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('starting', 'ready', 'solved', 'failed', 'expired', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."sandbox_status" AS ENUM('starting', 'ready', 'failed', 'destroyed');--> statement-breakpoint
CREATE TYPE "public"."challenge_source" AS ENUM('human', 'ai', 'community', 'company');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'review', 'live', 'retired');--> statement-breakpoint
CREATE TYPE "public"."challenge_visibility" AS ENUM('public', 'company_private');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_version_id" uuid NOT NULL,
	"seed" bigint NOT NULL,
	"context" "attempt_context" NOT NULL,
	"assessment_invite_id" uuid,
	"status" "attempt_status" DEFAULT 'starting' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"checks_used" smallint DEFAULT 0 NOT NULL,
	"hints_used" smallint DEFAULT 0 NOT NULL,
	"score" integer,
	"flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_seed_range" CHECK ("attempts"."seed" between 0 and 9007199254740991),
	CONSTRAINT "attempts_checks_range" CHECK ("attempts"."checks_used" between 0 and 10),
	CONSTRAINT "attempts_hints_not_negative" CHECK ("attempts"."hints_used" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sandbox_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"attempt_id" uuid NOT NULL,
	"node" text,
	"pod_name" text,
	"status" "sandbox_status" DEFAULT 'starting' NOT NULL,
	"destroyed_at" timestamp with time zone,
	"exit_reason" text,
	"log_ref" text,
	"log_deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"challenge_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"spec_json" jsonb NOT NULL,
	"image_ref" text NOT NULL,
	"image_digest" text,
	"checker_hash" text NOT NULL,
	"rating" real DEFAULT 1500 NOT NULL,
	"rating_deviation" real DEFAULT 350 NOT NULL,
	"solve_rate_baseline" real,
	"retired_reason" text,
	"source" "challenge_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_versions_challenge_version" UNIQUE("challenge_id","version"),
	CONSTRAINT "challenge_versions_version_positive" CHECK ("challenge_versions"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"difficulty" smallint NOT NULL,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL,
	"visibility" "challenge_visibility" DEFAULT 'public' NOT NULL,
	"company_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "challenges_slug_unique" UNIQUE("slug"),
	CONSTRAINT "challenges_difficulty_range" CHECK ("challenges"."difficulty" between 1 and 10),
	CONSTRAINT "challenges_private_has_company" CHECK ("challenges"."visibility" = 'public' or "challenges"."company_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_challenge_version_id_challenge_versions_id_fk" FOREIGN KEY ("challenge_version_id") REFERENCES "public"."challenge_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_sessions" ADD CONSTRAINT "sandbox_sessions_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_versions" ADD CONSTRAINT "challenge_versions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_created" ON "attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "sandbox_sessions_attempt" ON "sandbox_sessions" USING btree ("attempt_id");