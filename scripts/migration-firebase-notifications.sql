-- =============================================================
-- FIREBASE CLOUD MESSAGING TOKENS
-- Run in Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- =============================================================

CREATE TABLE IF NOT EXISTS firebase_messaging_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  user_agent TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE firebase_messaging_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "users_read_own_fcm_tokens"
    ON firebase_messaging_tokens FOR SELECT TO authenticated
    USING (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_insert_own_fcm_tokens"
    ON firebase_messaging_tokens FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "users_update_own_fcm_tokens"
    ON firebase_messaging_tokens FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_firebase_messaging_tokens_user_id
  ON firebase_messaging_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_firebase_messaging_tokens_active
  ON firebase_messaging_tokens(active);
