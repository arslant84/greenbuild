-- Task 31b: 0008 added the foreign key NOT VALID; existing challenges are public with no company.
ALTER TABLE "challenges" VALIDATE CONSTRAINT "challenges_company_id_companies_id_fk";
