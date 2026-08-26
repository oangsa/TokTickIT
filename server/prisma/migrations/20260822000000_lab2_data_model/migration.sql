-- Lab 2 forward migration.
-- The Lab 1 Category table is altered in place so its IDs, names, and
-- timezone-less creation values remain attached to the same rows. Lab 1
-- timestamps are interpreted as UTC explicitly; this does not depend on the
-- PostgreSQL session TimeZone setting.
--
-- Specification Section 7.2.7 makes the three Attachment CHECK constraints the
-- complete database-level Attachment contract: no triggers, rules, or stored
-- procedures are added to `attachment`. Lifecycle transitions - binding once,
-- never rebinding, never resurrecting a Removed row, never hard deleting a
-- bound row - are application-owned in the Attachment service.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Category"
    WHERE char_length("name") > 100
  ) THEN
    RAISE EXCEPTION
      'Lab 2 migration cannot preserve Category names longer than 100 characters';
  END IF;
END
$$;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Category" RENAME TO category;
ALTER TABLE category RENAME CONSTRAINT "Category_pkey" TO category_pkey;
ALTER INDEX "Category_name_key" RENAME TO category_name_key;
ALTER TABLE category RENAME COLUMN "createdAt" TO created_at;

ALTER TABLE category ALTER COLUMN created_at DROP DEFAULT;
ALTER TABLE category
  ALTER COLUMN created_at TYPE TIMESTAMPTZ(3)
  USING (created_at AT TIME ZONE 'UTC');
ALTER TABLE category
  ALTER COLUMN name TYPE VARCHAR(100)
  USING (name::VARCHAR(100));

ALTER TABLE category
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN created_by VARCHAR(255),
  ADD COLUMN updated_by VARCHAR(255),
  ADD COLUMN updated_at TIMESTAMPTZ(3);

UPDATE category
SET created_by = 'seed',
    updated_by = 'seed',
    updated_at = created_at;

ALTER TABLE category
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN created_by SET NOT NULL,
  ALTER COLUMN updated_by SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN updated_at SET NOT NULL;

CREATE TYPE "RequestedPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "TicketStatus" AS ENUM ('NEW');
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');

CREATE TABLE development_requester (
  id SERIAL NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(254) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT development_requester_pkey PRIMARY KEY (id),
  CONSTRAINT development_requester_email_key UNIQUE (email)
);

CREATE TABLE related_system (
  id SERIAL NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT related_system_pkey PRIMARY KEY (id),
  CONSTRAINT related_system_name_key UNIQUE (name)
);

CREATE TABLE ticket (
  id SERIAL NOT NULL,
  public_id UUID NOT NULL,
  ticket_number VARCHAR(25) NOT NULL,
  requester_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  related_system_id INTEGER NOT NULL,
  summary VARCHAR(150) NOT NULL,
  requested_priority "RequestedPriority" NOT NULL,
  description VARCHAR(2000) NOT NULL,
  current_status "TicketStatus" NOT NULL DEFAULT 'NEW',
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT ticket_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_public_id_key UNIQUE (public_id),
  CONSTRAINT ticket_ticket_number_key UNIQUE (ticket_number),
  CONSTRAINT ticket_ticket_number_format_check CHECK (
    ticket_number ~ '^TKT-[0-9]{8}-[0-9A-F]{12}$'
  ),
  CONSTRAINT ticket_summary_check CHECK (
    summary = btrim(summary)
    AND char_length(summary) BETWEEN 3 AND 150
  ),
  CONSTRAINT ticket_description_check CHECK (
    description = btrim(description)
    AND char_length(description) BETWEEN 10 AND 2000
  ),
  CONSTRAINT ticket_requester_id_fkey FOREIGN KEY (requester_id)
    REFERENCES development_requester (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ticket_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES category (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ticket_related_system_id_fkey FOREIGN KEY (related_system_id)
    REFERENCES related_system (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE attachment (
  id SERIAL NOT NULL,
  storage_key UUID NOT NULL,
  ticket_id INTEGER,
  uploaded_by_requester_id INTEGER NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  extension VARCHAR(10) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BYTEA NOT NULL,
  removal_reason VARCHAR(200),
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT attachment_pkey PRIMARY KEY (id),
  CONSTRAINT attachment_storage_key_key UNIQUE (storage_key),
  CONSTRAINT attachment_original_name_bytes_check CHECK (
    octet_length(original_name) BETWEEN 1 AND 255
  ),
  CONSTRAINT attachment_size_data_check CHECK (
    size_bytes > 0
    AND size_bytes <= 5000000
    AND size_bytes = octet_length(data)
  ),
  CONSTRAINT attachment_lifecycle_check CHECK (
    (
      ticket_id IS NULL
      AND deleted = false
      AND removal_reason IS NULL
    )
    OR
    (
      ticket_id IS NOT NULL
      AND deleted = false
      AND removal_reason IS NULL
    )
    OR
    (
      ticket_id IS NOT NULL
      AND deleted = true
      AND removal_reason IS NOT NULL
      AND removal_reason = btrim(removal_reason)
      AND char_length(removal_reason) BETWEEN 3 AND 200
    )
  ),
  CONSTRAINT attachment_ticket_id_fkey FOREIGN KEY (ticket_id)
    REFERENCES ticket (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT attachment_uploaded_by_requester_id_fkey
    FOREIGN KEY (uploaded_by_requester_id)
    REFERENCES development_requester (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE TABLE idempotency_record (
  id SERIAL NOT NULL,
  requester_id INTEGER NOT NULL,
  key UUID NOT NULL,
  request_hash VARCHAR(128) NOT NULL,
  status "IdempotencyStatus" NOT NULL,
  processing_started_at TIMESTAMPTZ(3) NOT NULL,
  ticket_id INTEGER,
  completed_at TIMESTAMPTZ(3),
  expires_at TIMESTAMPTZ(3),
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT idempotency_record_pkey PRIMARY KEY (id),
  CONSTRAINT idempotency_record_requester_key_key UNIQUE (requester_id, key),
  CONSTRAINT idempotency_record_request_hash_check CHECK (
    request_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT idempotency_record_state_check CHECK (
    (
      status = 'PROCESSING'
      AND processing_started_at IS NOT NULL
      AND ticket_id IS NULL
      AND completed_at IS NULL
      AND expires_at IS NULL
    )
    OR
    (
      status = 'COMPLETED'
      AND processing_started_at IS NOT NULL
      AND ticket_id IS NOT NULL
      AND completed_at IS NOT NULL
      AND expires_at IS NOT NULL
      AND expires_at = completed_at + INTERVAL '24 hours'
    )
  ),
  CONSTRAINT idempotency_record_requester_id_fkey FOREIGN KEY (requester_id)
    REFERENCES development_requester (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT idempotency_record_ticket_id_fkey FOREIGN KEY (ticket_id)
    REFERENCES ticket (id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
);

CREATE INDEX ticket_requester_created_at_id_active_idx
  ON ticket (requester_id, created_at DESC, id DESC)
  WHERE deleted = false;
CREATE INDEX ticket_category_id_idx ON ticket (category_id);
CREATE INDEX ticket_related_system_id_idx ON ticket (related_system_id);
CREATE INDEX ticket_requested_priority_idx ON ticket (requested_priority);
CREATE INDEX ticket_current_status_idx ON ticket (current_status);

CREATE INDEX attachment_ticket_id_idx ON attachment (ticket_id);
CREATE INDEX attachment_active_ticket_id_idx
  ON attachment (ticket_id)
  WHERE ticket_id IS NOT NULL AND deleted = false;
CREATE INDEX attachment_pending_created_at_id_idx
  ON attachment (created_at, id)
  WHERE ticket_id IS NULL AND deleted = false;
CREATE INDEX attachment_uploader_ticket_idx
  ON attachment (uploaded_by_requester_id, ticket_id);

CREATE INDEX idempotency_record_expires_at_id_idx
  ON idempotency_record (expires_at, id);

-- Indexed on the bare column, exactly as `summary` and `description` are.
-- `gin_trgm_ops` refuses `character`, so a CHAR(25) column forces the index
-- onto the expression `(ticket_number::text)` -- and then nothing reaches it,
-- because Prisma emits `ticket_number ILIKE $1` with no cast and PostgreSQL
-- matches an expression index only against that same expression. Ticket
-- Numbers are exactly 25 characters by the format CHECK above, so VARCHAR(25)
-- stores precisely what CHAR(25) did, with no blank padding to reason about.
CREATE INDEX ticket_ticket_number_trgm_idx
  ON ticket USING GIN (ticket_number gin_trgm_ops);
CREATE INDEX ticket_summary_trgm_idx
  ON ticket USING GIN (summary gin_trgm_ops);
CREATE INDEX ticket_description_trgm_idx
  ON ticket USING GIN (description gin_trgm_ops);

COMMIT;
