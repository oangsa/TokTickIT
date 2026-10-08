-- Lab 4 data foundation. One transaction keeps schema and truthful backfill atomic.
BEGIN;

CREATE TYPE "ActionTakenStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TicketActivityType" AS ENUM (
  'MIGRATED_TICKET_SNAPSHOT', 'TICKET_ASSIGNED', 'TICKET_REASSIGNED', 'TICKET_UNASSIGNED',
  'IT_PRIORITY_CHANGED', 'TICKET_STARTED_WORK', 'INFORMATION_REQUESTED', 'TICKET_RESUMED',
  'TICKET_MARKED_RESOLVED', 'REQUESTER_RESOLUTION_CONFIRMED', 'TICKET_CLOSED',
  'TICKET_CANCELLED', 'TICKET_REOPENED', 'ACTION_CREATED', 'ACTION_UPDATED',
  'ACTION_ASSIGNED', 'ACTION_REASSIGNED', 'ACTION_UNASSIGNED', 'ACTION_STARTED',
  'ACTION_COMPLETED', 'ACTION_CANCELLED'
);

ALTER TABLE "user" ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "user" ADD CONSTRAINT user_system_non_login_check CHECK (
  NOT is_system OR (is_active = FALSE AND must_change_password = FALSE AND password_hash = '!system-no-login')
);
CREATE UNIQUE INDEX user_single_system_idx ON "user" (is_system) WHERE is_system = TRUE;

INSERT INTO "user" (
  name, email, role, password_hash, must_change_password, is_active, is_system,
  deleted, created_by, updated_by
) VALUES (
  'SYSTEM', 'system@toktickit.invalid', 'REQUESTER', '!system-no-login', FALSE, FALSE, TRUE,
  FALSE, 'migration', 'migration'
)
ON CONFLICT (email) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" WHERE is_system = TRUE) THEN
    RAISE EXCEPTION 'Lab 4 SYSTEM User identity is unavailable';
END IF;
END;
$$;

CREATE TABLE action_taken (
  id SERIAL NOT NULL,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL,
  creator_user_id INTEGER NOT NULL,
  assigned_to_user_id INTEGER,
  performed_by_user_id INTEGER,
  status "ActionTakenStatus" NOT NULL,
  description VARCHAR(2000) NOT NULL,
  result VARCHAR(2000),
  follow_up_required BOOLEAN NOT NULL,
  follow_up_note VARCHAR(2000),
  attachment_notes VARCHAR(2000),
  cancellation_reason VARCHAR(500),
  is_migrated BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ(3),
  completed_at TIMESTAMPTZ(3),
  cancelled_at TIMESTAMPTZ(3),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT action_taken_pkey PRIMARY KEY (id),
  CONSTRAINT action_taken_public_id_key UNIQUE (public_id),
  CONSTRAINT action_taken_ticket_id_fkey FOREIGN KEY (ticket_id)
    REFERENCES ticket (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_creator_user_id_fkey FOREIGN KEY (creator_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_assigned_to_user_id_fkey FOREIGN KEY (assigned_to_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_performed_by_user_id_fkey FOREIGN KEY (performed_by_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_version_check CHECK (version >= 1),
  CONSTRAINT action_taken_description_check CHECK (description = btrim(description) AND char_length(description) BETWEEN 1 AND 2000),
  CONSTRAINT action_taken_result_check CHECK (result IS NULL OR (result = btrim(result) AND char_length(result) BETWEEN 1 AND 2000)),
  CONSTRAINT action_taken_follow_up_check CHECK (
    (follow_up_required AND follow_up_note IS NOT NULL AND follow_up_note = btrim(follow_up_note) AND char_length(follow_up_note) BETWEEN 1 AND 2000)
    OR (NOT follow_up_required AND follow_up_note IS NULL)
  ),
  CONSTRAINT action_taken_attachment_notes_check CHECK (
    attachment_notes IS NULL OR (attachment_notes = btrim(attachment_notes) AND char_length(attachment_notes) BETWEEN 1 AND 2000)
  ),
  CONSTRAINT action_taken_state_check CHECK (
    (status = 'PLANNED' AND started_at IS NULL AND completed_at IS NULL AND cancelled_at IS NULL AND performed_by_user_id IS NULL AND cancellation_reason IS NULL)
    OR (status = 'IN_PROGRESS' AND started_at IS NOT NULL AND completed_at IS NULL AND cancelled_at IS NULL AND performed_by_user_id IS NULL AND cancellation_reason IS NULL)
    OR (status = 'COMPLETED' AND result IS NOT NULL AND completed_at IS NOT NULL AND cancelled_at IS NULL AND cancellation_reason IS NULL
      AND (is_migrated OR (started_at IS NOT NULL AND performed_by_user_id IS NOT NULL)))
    OR (status = 'CANCELLED' AND cancelled_at IS NOT NULL AND completed_at IS NULL AND performed_by_user_id IS NULL AND cancellation_reason IS NOT NULL
      AND cancellation_reason = btrim(cancellation_reason) AND char_length(cancellation_reason) BETWEEN 1 AND 500)
  ),
  CONSTRAINT action_taken_migrated_check CHECK (NOT is_migrated OR (status = 'COMPLETED' AND assigned_to_user_id IS NULL AND performed_by_user_id IS NULL))
);
CREATE UNIQUE INDEX action_taken_one_migrated_per_ticket_idx ON action_taken (ticket_id) WHERE is_migrated = TRUE;
CREATE INDEX action_taken_ticket_created_idx ON action_taken (ticket_id, created_at DESC, id DESC);
CREATE INDEX action_taken_assignee_status_idx ON action_taken (assigned_to_user_id, status);
CREATE INDEX action_taken_performer_completed_idx ON action_taken (performed_by_user_id, completed_at);
CREATE INDEX action_taken_status_ticket_idx ON action_taken (status, ticket_id);
CREATE INDEX ticket_dashboard_status_priority_idx ON ticket (current_status, it_priority);
CREATE INDEX ticket_updated_recent_idx ON ticket (updated_at DESC, id DESC);

CREATE TABLE action_taken_attachment (
  action_taken_id INTEGER NOT NULL,
  attachment_id INTEGER NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT action_taken_attachment_pkey PRIMARY KEY (action_taken_id, attachment_id),
  CONSTRAINT action_taken_attachment_action_taken_id_fkey FOREIGN KEY (action_taken_id)
    REFERENCES action_taken (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_attachment_attachment_id_fkey FOREIGN KEY (attachment_id)
    REFERENCES attachment (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX action_taken_attachment_attachment_idx ON action_taken_attachment (attachment_id);

CREATE FUNCTION enforce_action_attachment_ticket_match() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM action_taken AS action
    JOIN attachment AS evidence
      ON evidence.id = NEW.attachment_id
      AND evidence.ticket_id = action.ticket_id
      AND evidence.deleted = FALSE
    WHERE action.id = NEW.action_taken_id
  ) THEN
    RAISE EXCEPTION 'Action Attachment must reference an Active Attachment on the same Ticket'
      USING ERRCODE = '23514', CONSTRAINT = 'action_taken_attachment_same_ticket_check';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER action_taken_attachment_same_ticket_trigger
  BEFORE INSERT OR UPDATE OF action_taken_id, attachment_id ON action_taken_attachment
  FOR EACH ROW EXECUTE FUNCTION enforce_action_attachment_ticket_match();

CREATE TABLE ticket_activity (
  id SERIAL NOT NULL,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ticket_id INTEGER NOT NULL,
  performed_by_user_id INTEGER NOT NULL,
  action "TicketActivityType" NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ticket_activity_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_activity_public_id_key UNIQUE (public_id),
  CONSTRAINT ticket_activity_ticket_id_fkey FOREIGN KEY (ticket_id)
    REFERENCES ticket (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ticket_activity_performed_by_user_id_fkey FOREIGN KEY (performed_by_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX ticket_activity_ticket_created_idx ON ticket_activity (ticket_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX ticket_activity_one_migrated_snapshot_idx ON ticket_activity (ticket_id)
  WHERE action = 'MIGRATED_TICKET_SNAPSHOT';

CREATE TABLE ticket_assignment_activity (
  ticket_activity_id INTEGER NOT NULL,
  previous_assigned_to_user_id INTEGER,
  assigned_to_user_id INTEGER,
  CONSTRAINT ticket_assignment_activity_pkey PRIMARY KEY (ticket_activity_id),
  CONSTRAINT ticket_assignment_activity_activity_fkey FOREIGN KEY (ticket_activity_id)
    REFERENCES ticket_activity (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ticket_assignment_activity_previous_owner_fkey FOREIGN KEY (previous_assigned_to_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ticket_assignment_activity_assigned_owner_fkey FOREIGN KEY (assigned_to_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE ticket_status_activity (
  ticket_activity_id INTEGER NOT NULL,
  previous_status "TicketStatus",
  status "TicketStatus" NOT NULL,
  CONSTRAINT ticket_status_activity_pkey PRIMARY KEY (ticket_activity_id),
  CONSTRAINT ticket_status_activity_activity_fkey FOREIGN KEY (ticket_activity_id)
    REFERENCES ticket_activity (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE ticket_priority_activity (
  ticket_activity_id INTEGER NOT NULL,
  previous_priority "TicketPriority",
  priority "TicketPriority" NOT NULL,
  CONSTRAINT ticket_priority_activity_pkey PRIMARY KEY (ticket_activity_id),
  CONSTRAINT ticket_priority_activity_activity_fkey FOREIGN KEY (ticket_activity_id)
    REFERENCES ticket_activity (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE action_taken_activity (
  ticket_activity_id INTEGER NOT NULL,
  action_taken_id INTEGER NOT NULL,
  previous_assigned_to_user_id INTEGER,
  assigned_to_user_id INTEGER,
  CONSTRAINT action_taken_activity_pkey PRIMARY KEY (ticket_activity_id),
  CONSTRAINT action_taken_activity_activity_fkey FOREIGN KEY (ticket_activity_id)
    REFERENCES ticket_activity (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_activity_action_taken_id_fkey FOREIGN KEY (action_taken_id)
    REFERENCES action_taken (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_activity_previous_assignee_fkey FOREIGN KEY (previous_assigned_to_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT action_taken_activity_assigned_assignee_fkey FOREIGN KEY (assigned_to_user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX action_taken_activity_action_idx ON action_taken_activity (action_taken_id);

CREATE FUNCTION enforce_action_activity_ticket_match() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM ticket_activity AS activity
    JOIN action_taken AS action
      ON action.id = NEW.action_taken_id
      AND action.ticket_id = activity.ticket_id
    WHERE activity.id = NEW.ticket_activity_id
  ) THEN
    RAISE EXCEPTION 'Action Activity and Action must reference the same Ticket'
      USING ERRCODE = '23514', CONSTRAINT = 'action_taken_activity_same_ticket_check';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER action_taken_activity_same_ticket_trigger
  BEFORE INSERT OR UPDATE OF ticket_activity_id, action_taken_id ON action_taken_activity
  FOR EACH ROW EXECUTE FUNCTION enforce_action_activity_ticket_match();

-- Preserve historical idempotency claims and identify existing Ticket-create route.
ALTER TABLE idempotency_record DROP CONSTRAINT idempotency_record_requester_key_key;
ALTER TABLE idempotency_record DROP CONSTRAINT idempotency_record_state_check;
ALTER TABLE idempotency_record DROP CONSTRAINT idempotency_record_requester_id_fkey;
ALTER TABLE idempotency_record RENAME COLUMN requester_id TO user_id;
ALTER TABLE idempotency_record
  ADD COLUMN method VARCHAR(10),
  ADD COLUMN resource_path VARCHAR(512),
  ADD COLUMN action_taken_id INTEGER;
UPDATE idempotency_record SET method = 'POST', resource_path = '/api/users/me/tickets';
ALTER TABLE idempotency_record
  ALTER COLUMN method SET NOT NULL,
  ALTER COLUMN resource_path SET NOT NULL,
  ADD CONSTRAINT idempotency_record_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES "user" (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT idempotency_record_action_taken_id_fkey FOREIGN KEY (action_taken_id)
    REFERENCES action_taken (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT idempotency_record_method_check CHECK (method ~ '^[A-Z]+$'),
  ADD CONSTRAINT idempotency_record_path_check CHECK (resource_path LIKE '/%' AND resource_path NOT LIKE '%?%' AND resource_path NOT LIKE '%/' AND resource_path !~ '[A-Z]'),
  ADD CONSTRAINT idempotency_record_state_check CHECK (
    (status = 'PROCESSING' AND ticket_id IS NULL AND action_taken_id IS NULL AND completed_at IS NULL AND expires_at IS NULL)
    OR (status = 'COMPLETED' AND (
      (ticket_id IS NOT NULL AND action_taken_id IS NULL AND method = 'POST' AND resource_path = '/api/users/me/tickets')
      OR (ticket_id IS NULL AND action_taken_id IS NOT NULL AND method = 'POST'
        AND resource_path ~ '^/api/tickets/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/actions(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/(start|complete|cancel))?$')
    ) AND completed_at IS NOT NULL AND expires_at IS NOT NULL AND expires_at = completed_at + INTERVAL '24 hours')
  );
CREATE UNIQUE INDEX idempotency_record_user_method_path_key_key
  ON idempotency_record (user_id, method, resource_path, key);

-- Capture only current known state; null previous values make no historical claim.
INSERT INTO ticket_activity (ticket_id, performed_by_user_id, action, created_by, updated_by)
SELECT t.id, u.id, 'MIGRATED_TICKET_SNAPSHOT', 'migration', 'migration'
FROM ticket AS t
CROSS JOIN "user" AS u
WHERE u.is_system = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO ticket_assignment_activity (ticket_activity_id, previous_assigned_to_user_id, assigned_to_user_id)
SELECT a.id, NULL, t.owner_user_id
FROM ticket_activity AS a
JOIN ticket AS t ON t.id = a.ticket_id
WHERE a.action = 'MIGRATED_TICKET_SNAPSHOT'
ON CONFLICT DO NOTHING;

INSERT INTO ticket_status_activity (ticket_activity_id, previous_status, status)
SELECT a.id, NULL, t.current_status
FROM ticket_activity AS a
JOIN ticket AS t ON t.id = a.ticket_id
WHERE a.action = 'MIGRATED_TICKET_SNAPSHOT'
ON CONFLICT DO NOTHING;

INSERT INTO ticket_priority_activity (ticket_activity_id, previous_priority, priority)
SELECT a.id, NULL, t.it_priority
FROM ticket_activity AS a
JOIN ticket AS t ON t.id = a.ticket_id
WHERE a.action = 'MIGRATED_TICKET_SNAPSHOT'
ON CONFLICT DO NOTHING;

INSERT INTO action_taken (
  ticket_id, creator_user_id, status, description, result, follow_up_required,
  is_migrated, completed_at, created_at, created_by, updated_by, updated_at
)
SELECT t.id, u.id, 'COMPLETED',
  'Migrated historical completion. Original work details and performer were not recorded.',
  'Ticket was marked resolved or closed before Action Taken history was introduced.',
  FALSE, TRUE, t.updated_at, t.updated_at, 'migration', 'migration', t.updated_at
FROM ticket AS t
CROSS JOIN "user" AS u
WHERE u.is_system = TRUE AND t.current_status IN ('RESOLVED', 'CLOSED')
ON CONFLICT DO NOTHING;

COMMIT;
