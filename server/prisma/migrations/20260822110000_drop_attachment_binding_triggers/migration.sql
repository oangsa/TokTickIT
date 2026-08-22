-- Remove the Attachment binding triggers.
--
-- Specification Section 7.2.7 makes the three Attachment CHECK constraints the
-- authoritative persistence contract and leaves lifecycle transitions to the
-- application. The triggers added earlier claimed a stronger guarantee than
-- they delivered: they blocked unbinding to NULL and hard-deleting a bound
-- row, but still allowed rebinding an Attachment to a different Ticket and
-- resurrecting a Removed Attachment back to Active (which silently discards
-- removal_reason). TRUNCATE bypassed the row-level DELETE trigger entirely.
--
-- Prisma cannot represent triggers, so they were also invisible to
-- `prisma migrate diff` and unprotected against later schema work.
--
-- IF EXISTS covers both possible prior states: a database that applied only
-- 20260822000000_lab2_data_model, and one that also applied the withdrawn
-- 20260822100000_protect_attachment_bindings.

BEGIN;

DROP TRIGGER IF EXISTS attachment_prevent_bound_unbind ON attachment;
DROP FUNCTION IF EXISTS prevent_bound_attachment_unbind();

DROP TRIGGER IF EXISTS attachment_prevent_bound_hard_delete ON attachment;
DROP FUNCTION IF EXISTS prevent_bound_attachment_hard_delete();

COMMIT;
