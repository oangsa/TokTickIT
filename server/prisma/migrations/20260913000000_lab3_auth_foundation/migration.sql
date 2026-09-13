-- Lab 3 forward migration.
-- This migration renames the Lab 2 requester table in place. It never resets,
-- copies, or deletes business rows.

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');
CREATE TYPE "SessionStage" AS ENUM ('PASSWORD_CHANGE_REQUIRED', 'FULL');
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "LoginRateLimitScope" AS ENUM ('EMAIL_IP', 'IP');

ALTER TABLE development_requester RENAME TO "user";
ALTER TABLE "user" RENAME CONSTRAINT development_requester_pkey TO user_pkey;
ALTER INDEX development_requester_email_key RENAME TO user_email_key;

ALTER TABLE "user"
  ADD COLUMN public_id UUID,
  ADD COLUMN role "UserRole" NOT NULL DEFAULT 'REQUESTER',
  ADD COLUMN password_hash VARCHAR(255),
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE "user"
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

UPDATE "user"
SET password_hash = '!migrated-password-unprovisioned:' || gen_random_uuid()::text
WHERE password_hash IS NULL;

ALTER TABLE "user"
  ALTER COLUMN public_id SET NOT NULL,
  ALTER COLUMN public_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN must_change_password DROP DEFAULT,
  ALTER COLUMN email TYPE CITEXT USING email::citext;

ALTER TABLE "user"
  ADD CONSTRAINT user_public_id_key UNIQUE (public_id);

ALTER TABLE ticket
  ADD COLUMN owner_user_id INTEGER,
  ADD COLUMN it_priority "TicketPriority" NOT NULL DEFAULT 'LOW',
  ADD COLUMN requester_resolution_confirmed_at TIMESTAMPTZ(3);

UPDATE ticket
SET it_priority = requested_priority::text::"TicketPriority";

ALTER TABLE ticket
  ALTER COLUMN it_priority SET DEFAULT 'LOW';

ALTER TABLE ticket
  ALTER COLUMN current_status DROP DEFAULT;

ALTER TYPE "TicketStatus" RENAME TO "TicketStatus_old";
CREATE TYPE "TicketStatus" AS ENUM (
  'NEW',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_REQUESTER',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED'
);

ALTER TABLE ticket
  ALTER COLUMN current_status TYPE "TicketStatus"
  USING current_status::text::"TicketStatus";

ALTER TABLE ticket
  ALTER COLUMN current_status SET DEFAULT 'NEW';

DROP TYPE "TicketStatus_old";

ALTER TABLE attachment
  RENAME COLUMN uploaded_by_requester_id TO uploaded_by_user_id;

ALTER TABLE attachment
  RENAME CONSTRAINT attachment_uploaded_by_requester_id_fkey TO attachment_uploaded_by_user_id_fkey;

ALTER TABLE ticket
  ADD CONSTRAINT ticket_owner_user_id_fkey FOREIGN KEY (owner_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "user"
  ADD CONSTRAINT user_email_length_check CHECK (char_length(email::text) BETWEEN 3 AND 254);

CREATE INDEX user_role_active_deleted_idx
  ON "user" (role, is_active, deleted);

CREATE TABLE user_session (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL,
  stage "SessionStage" NOT NULL,
  remember_me BOOLEAN NOT NULL DEFAULT FALSE,
  refresh_token_hash CHAR(64) NOT NULL,
  previous_refresh_token_hash CHAR(64),
  previous_refresh_valid_until TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  absolute_expires_at TIMESTAMPTZ(3) NOT NULL,
  revoked_at TIMESTAMPTZ(3),
  revoke_reason VARCHAR(100),
  user_agent VARCHAR(512),
  ip_address VARCHAR(64),
  CONSTRAINT user_session_pkey PRIMARY KEY (id),
  CONSTRAINT user_session_refresh_token_hash_key UNIQUE (refresh_token_hash),
  CONSTRAINT user_session_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT user_session_hash_check CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT user_session_stage_remember_check CHECK (
    stage = 'FULL'::"SessionStage" OR remember_me = false
  ),
  CONSTRAINT user_session_previous_hash_check CHECK (
    (previous_refresh_token_hash IS NULL AND previous_refresh_valid_until IS NULL)
    OR
    (previous_refresh_token_hash IS NOT NULL
      AND previous_refresh_valid_until IS NOT NULL
      AND previous_refresh_token_hash ~ '^[0-9a-f]{64}$')
  )
);

CREATE INDEX user_session_user_active_idx
  ON user_session (user_id, revoked_at, absolute_expires_at);
CREATE INDEX user_session_expiry_idx
  ON user_session (absolute_expires_at, id);
CREATE INDEX user_session_revoked_idx
  ON user_session (revoked_at, id);

CREATE TABLE login_rate_limit_bucket (
  id SERIAL NOT NULL,
  scope "LoginRateLimitScope" NOT NULL,
  bucket_key_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ(3) NOT NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  blocked_until TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT login_rate_limit_bucket_pkey PRIMARY KEY (id),
  CONSTRAINT login_rate_limit_scope_key_hash_key UNIQUE (scope, bucket_key_hash),
  CONSTRAINT login_rate_limit_bucket_hash_check CHECK (bucket_key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT login_rate_limit_bucket_count_check CHECK (failure_count >= 0)
);

CREATE INDEX login_rate_limit_cleanup_idx
  ON login_rate_limit_bucket (blocked_until, window_started_at, id);

CREATE TABLE public_comment (
  id SERIAL NOT NULL,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL,
  author_user_id INTEGER NOT NULL,
  parent_comment_id INTEGER,
  reply_to_comment_id INTEGER,
  content VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT public_comment_pkey PRIMARY KEY (id),
  CONSTRAINT public_comment_public_id_key UNIQUE (public_id),
  CONSTRAINT public_comment_ticket_id_fkey FOREIGN KEY (ticket_id)
    REFERENCES ticket (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT public_comment_author_user_id_fkey FOREIGN KEY (author_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT public_comment_parent_comment_id_fkey FOREIGN KEY (parent_comment_id)
    REFERENCES public_comment (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT public_comment_reply_to_comment_id_fkey FOREIGN KEY (reply_to_comment_id)
    REFERENCES public_comment (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT public_comment_content_check CHECK (content = btrim(content) AND char_length(content) BETWEEN 1 AND 2000)
);

CREATE INDEX public_comment_thread_idx
  ON public_comment (ticket_id, parent_comment_id, created_at, id);
CREATE INDEX public_comment_reply_target_idx
  ON public_comment (reply_to_comment_id);

CREATE TABLE internal_note (
  id SERIAL NOT NULL,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL,
  author_user_id INTEGER NOT NULL,
  content VARCHAR(4000) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT internal_note_pkey PRIMARY KEY (id),
  CONSTRAINT internal_note_public_id_key UNIQUE (public_id),
  CONSTRAINT internal_note_ticket_id_fkey FOREIGN KEY (ticket_id)
    REFERENCES ticket (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT internal_note_author_user_id_fkey FOREIGN KEY (author_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT internal_note_content_check CHECK (content = btrim(content) AND char_length(content) BETWEEN 1 AND 4000)
);

CREATE INDEX internal_note_ticket_created_idx
  ON internal_note (ticket_id, created_at, id);

CREATE INDEX ticket_owner_status_created_idx
  ON ticket (owner_user_id, current_status, created_at);
CREATE INDEX ticket_it_priority_idx
  ON ticket (it_priority);

ALTER TABLE "user" ALTER COLUMN public_id SET NOT NULL;

COMMIT;
