-- Conversations + Messages migration
-- Adds unified thread (conversations) and per-message records (conversation_messages)

-- ============================================================
-- 1. New enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "public"."conversation_channel" AS ENUM('email', 'sms', 'call', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."message_channel" AS ENUM('email', 'sms', 'call');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'failed', 'received');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. New tables
-- ============================================================

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid REFERENCES "companies"("id") ON DELETE SET NULL,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE SET NULL,
  "deal_id" uuid REFERENCES "deals"("id") ON DELETE SET NULL,
  "channel" "conversation_channel" NOT NULL,
  "subject" varchar(500),
  "last_message_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "conversation_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "direction" "message_direction" NOT NULL,
  "channel" "message_channel" NOT NULL,
  "body" text NOT NULL,
  "sender_name" varchar(255),
  "sender_phone" varchar(50),
  "sender_email" varchar(255),
  "twilio_sid" varchar(255),
  "status" "message_status" NOT NULL DEFAULT 'queued',
  "metadata" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS "idx_conversations_contact" ON "conversations" ("contact_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_company" ON "conversations" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_last_message" ON "conversations" ("last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversation_messages_conversation" ON "conversation_messages" ("conversation_id", "created_at" ASC);
CREATE INDEX IF NOT EXISTS "idx_conversation_messages_twilio_sid" ON "conversation_messages" ("twilio_sid") WHERE "twilio_sid" IS NOT NULL;
