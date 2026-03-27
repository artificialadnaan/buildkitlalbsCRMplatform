ALTER TABLE "companies" ADD COLUMN "prospecting_data" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "prospecting_status" varchar(20);--> statement-breakpoint
ALTER TABLE "scrape_jobs" ADD COLUMN "mode" varchar(20) DEFAULT 'standard' NOT NULL;