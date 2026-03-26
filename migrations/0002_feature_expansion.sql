-- Feature Expansion Migration
-- Adds: website audit columns, call prep, outreach campaigns, notifications, surveys, change requests, reports

-- ============================================================
-- 0. Fix existing constraints for new features
-- ============================================================

-- Make tasks.milestone_id nullable so standalone tasks can be created
-- (needed for stale deal follow-ups, change requests, etc.)
ALTER TABLE "tasks" ALTER COLUMN "milestone_id" DROP NOT NULL;

-- Add deal reference and source tracking to tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deal_id" uuid REFERENCES "deals"("id") ON DELETE CASCADE;

DO $$ BEGIN
  CREATE TYPE "public"."task_source" AS ENUM('manual', 'stale_deal', 'change_request', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "source" "task_source" NOT NULL DEFAULT 'manual';

-- ============================================================
-- 1. Add columns to existing tables
-- ============================================================

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "website_audit" jsonb;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "website_score" integer DEFAULT 0;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "website_audited_at" timestamp with time zone;

ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "call_prep" jsonb;
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "call_prep_generated_at" timestamp with time zone;

-- ============================================================
-- 2. New enums (remaining)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "public"."campaign_status" AS ENUM('scraping', 'auditing', 'scoring', 'enrolling', 'active', 'completed', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_type" AS ENUM('stale_deal', 'hot_lead', 'sequence_digest', 'task_due', 'milestone_completed', 'reply_received', 'campaign_update');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."change_request_status" AS ENUM('submitted', 'reviewed', 'approved', 'rejected', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."change_request_priority" AS ENUM('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."report_frequency" AS ENUM('weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."report_type" AS ENUM('client_monthly', 'sales_performance', 'roi');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. New tables
-- ============================================================

CREATE TABLE IF NOT EXISTS "outreach_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "scrape_job_id" uuid REFERENCES "scrape_jobs"("id"),
  "sequence_id" uuid REFERENCES "email_sequences"("id"),
  "zip_codes" text[] NOT NULL,
  "search_query" varchar(255) NOT NULL,
  "top_n" integer NOT NULL DEFAULT 100,
  "min_score" integer NOT NULL DEFAULT 0,
  "status" "campaign_status" NOT NULL DEFAULT 'scraping',
  "stats" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "type" "notification_type" NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text,
  "entity_type" varchar(50),
  "entity_id" uuid,
  "is_read" boolean NOT NULL DEFAULT false,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") UNIQUE,
  "stale_deal_days" integer NOT NULL DEFAULT 7,
  "hot_lead_opens" integer NOT NULL DEFAULT 3,
  "hot_lead_window_hours" integer NOT NULL DEFAULT 1,
  "daily_digest_enabled" boolean NOT NULL DEFAULT true,
  "digest_send_hour" integer NOT NULL DEFAULT 9,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "satisfaction_surveys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "milestone_id" uuid NOT NULL REFERENCES "milestones"("id"),
  "portal_user_id" uuid NOT NULL REFERENCES "portal_users"("id"),
  "rating" integer,
  "comment" text,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "change_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "portal_user_id" uuid NOT NULL REFERENCES "portal_users"("id"),
  "title" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "priority" "change_request_priority" NOT NULL DEFAULT 'medium',
  "status" "change_request_status" NOT NULL DEFAULT 'submitted',
  "task_id" uuid REFERENCES "tasks"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "report_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "frequency" "report_frequency" NOT NULL DEFAULT 'monthly',
  "next_run_at" timestamp with time zone NOT NULL,
  "last_run_at" timestamp with time zone,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "generated_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid REFERENCES "projects"("id"),
  "type" "report_type" NOT NULL,
  "title" varchar(255) NOT NULL,
  "file_url" varchar(500),
  "data" jsonb,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================================
-- 4. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" ("user_id") WHERE "is_read" = false;
CREATE INDEX IF NOT EXISTS "idx_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_outreach_campaigns_status" ON "outreach_campaigns" ("status");
CREATE INDEX IF NOT EXISTS "idx_companies_website_score" ON "companies" ("website_score" DESC) WHERE "website_score" > 0;
CREATE INDEX IF NOT EXISTS "idx_change_requests_project" ON "change_requests" ("project_id", "status");
CREATE INDEX IF NOT EXISTS "idx_satisfaction_surveys_project" ON "satisfaction_surveys" ("project_id");
