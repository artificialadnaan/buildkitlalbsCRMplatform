ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "scrape_job_id" uuid REFERENCES "scrape_jobs"("id");
