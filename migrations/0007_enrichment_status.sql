ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "enrichment_status" varchar(20) DEFAULT 'pending';
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "linkedin_url" varchar(500);
