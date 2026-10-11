CREATE TYPE "public"."daily_track" AS ENUM('linux');--> statement-breakpoint
CREATE TABLE "daily_challenges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"track" "daily_track" NOT NULL,
	"challenge_version_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_challenges_day_track" UNIQUE("day","track")
);
--> statement-breakpoint
ALTER TABLE "daily_challenges" ADD CONSTRAINT "daily_challenges_challenge_version_id_challenge_versions_id_fk" FOREIGN KEY ("challenge_version_id") REFERENCES "public"."challenge_versions"("id") ON DELETE restrict ON UPDATE no action;