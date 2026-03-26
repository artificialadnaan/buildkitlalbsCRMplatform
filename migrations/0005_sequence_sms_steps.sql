DO $$ BEGIN
  CREATE TYPE "public"."sequence_step_channel" AS ENUM('email', 'sms');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "channel" "sequence_step_channel" NOT NULL DEFAULT 'email';
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "sms_body" text;
