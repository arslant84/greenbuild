CREATE TABLE "user_skills" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"skill" text NOT NULL,
	"rating" real DEFAULT 1500 NOT NULL,
	"rating_deviation" real DEFAULT 350 NOT NULL,
	"volatility" real DEFAULT 0.06 NOT NULL,
	"attempts_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_skills_user_skill" UNIQUE("user_id","skill")
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "rated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "challenge_versions" ADD COLUMN "rating_volatility" real DEFAULT 0.06 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;