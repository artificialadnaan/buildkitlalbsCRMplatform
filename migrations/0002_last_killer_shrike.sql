CREATE TYPE "public"."deal_event_type" AS ENUM('stage_change', 'status_change', 'sms_sent', 'call_made', 'note_added', 'email_sent');--> statement-breakpoint
CREATE TYPE "public"."sequence_step_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."task_source" AS ENUM('manual', 'stale_deal', 'change_request', 'system');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('stale_deal', 'hot_lead', 'sequence_digest', 'task_due', 'milestone_completed', 'reply_received', 'campaign_update');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('scraping', 'auditing', 'scoring', 'enrolling', 'active', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."change_request_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."change_request_status" AS ENUM('submitted', 'reviewed', 'approved', 'rejected', 'completed');--> statement-breakpoint
CREATE TYPE "public"."report_frequency" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('client_monthly', 'sales_performance', 'roi');--> statement-breakpoint
CREATE TYPE "public"."conversation_channel" AS ENUM('email', 'sms', 'call', 'internal');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('email', 'sms', 'call');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'received');--> statement-breakpoint
CREATE TABLE "deal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"type" "deal_event_type" NOT NULL,
	"from_value" varchar(255),
	"to_value" varchar(255),
	"user_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stale_deal_days" integer DEFAULT 7 NOT NULL,
	"hot_lead_opens" integer DEFAULT 3 NOT NULL,
	"hot_lead_window_hours" integer DEFAULT 1 NOT NULL,
	"daily_digest_enabled" boolean DEFAULT true NOT NULL,
	"digest_send_hour" integer DEFAULT 9 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_by" uuid NOT NULL,
	"scrape_job_id" uuid,
	"sequence_id" uuid,
	"zip_codes" text[] NOT NULL,
	"search_query" varchar(255) NOT NULL,
	"top_n" integer DEFAULT 100 NOT NULL,
	"min_score" integer DEFAULT 0 NOT NULL,
	"status" "campaign_status" DEFAULT 'scraping' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "satisfaction_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"milestone_id" uuid NOT NULL,
	"portal_user_id" uuid NOT NULL,
	"rating" integer,
	"comment" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "change_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"portal_user_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"priority" "change_request_priority" DEFAULT 'medium' NOT NULL,
	"status" "change_request_status" DEFAULT 'submitted' NOT NULL,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "generated_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"type" "report_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"file_url" varchar(500),
	"data" jsonb,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"frequency" "report_frequency" DEFAULT 'monthly' NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"channel" "message_channel" NOT NULL,
	"body" text NOT NULL,
	"sender_name" varchar(255),
	"sender_phone" varchar(50),
	"sender_email" varchar(255),
	"twilio_sid" varchar(255),
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"contact_id" uuid,
	"deal_id" uuid,
	"channel" "conversation_channel" NOT NULL,
	"subject" varchar(500),
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sequence_steps" ALTER COLUMN "template_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "milestone_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "scrape_job_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website_audit" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website_score" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "website_audited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "assigned_to" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "enrichment_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "linkedin_url" varchar(500);--> statement-breakpoint
ALTER TABLE "pipeline_stages" ADD COLUMN "follow_up_days" integer;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "call_prep" jsonb;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "call_prep_generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD COLUMN "channel" "sequence_step_channel" DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "sequence_steps" ADD COLUMN "sms_body" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source" "task_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_scrape_job_id_scrape_jobs_id_fk" FOREIGN KEY ("scrape_job_id") REFERENCES "public"."scrape_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_sequence_id_email_sequences_id_fk" FOREIGN KEY ("sequence_id") REFERENCES "public"."email_sequences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "satisfaction_surveys" ADD CONSTRAINT "satisfaction_surveys_portal_user_id_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_portal_user_id_portal_users_id_fk" FOREIGN KEY ("portal_user_id") REFERENCES "public"."portal_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_scrape_job_id_scrape_jobs_id_fk" FOREIGN KEY ("scrape_job_id") REFERENCES "public"."scrape_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;