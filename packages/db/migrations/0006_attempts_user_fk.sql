-- Task 29b: attempts made before users existed (dev databases, dev tokens) get a stub user each,
-- so the foreign key can be validated in the next migration.
INSERT INTO "users" ("id")
SELECT DISTINCT "attempts"."user_id" FROM "attempts"
WHERE NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "attempts"."user_id");--> statement-breakpoint
-- NOT VALID checks new rows at once and skips the scan of existing ones; 0007 validates them.
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action NOT VALID;
