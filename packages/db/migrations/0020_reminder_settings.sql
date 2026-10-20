ALTER TABLE "user_settings" ADD COLUMN "reminder_hour" smallint DEFAULT 19 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "last_reminded_day" date;