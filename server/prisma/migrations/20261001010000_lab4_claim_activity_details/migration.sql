-- Frozen API §16.3 permits Claim to include NEW -> OPEN on TICKET_ASSIGNED.
-- Preserve applied migration checksums and existing deferred constraint triggers.
BEGIN;

CREATE OR REPLACE FUNCTION validate_ticket_activity_details(activity_id INTEGER) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  activity_action "TicketActivityType";
  has_assignment BOOLEAN;
  has_status BOOLEAN;
  has_priority BOOLEAN;
  has_action BOOLEAN;
  needs_assignment BOOLEAN;
  needs_status BOOLEAN;
  allows_status BOOLEAN;
  needs_priority BOOLEAN;
  needs_action BOOLEAN;
BEGIN
  -- Serialize checks for concurrent changes to this Activity's children.
  SELECT action INTO activity_action FROM ticket_activity WHERE id = activity_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  needs_assignment := activity_action IN ('MIGRATED_TICKET_SNAPSHOT', 'TICKET_ASSIGNED', 'TICKET_REASSIGNED', 'TICKET_UNASSIGNED');
  needs_status := activity_action IN ('MIGRATED_TICKET_SNAPSHOT', 'TICKET_STARTED_WORK', 'INFORMATION_REQUESTED', 'TICKET_RESUMED', 'TICKET_MARKED_RESOLVED', 'TICKET_CLOSED', 'TICKET_CANCELLED', 'TICKET_REOPENED');
  allows_status := needs_status OR activity_action = 'TICKET_ASSIGNED';
  needs_priority := activity_action IN ('MIGRATED_TICKET_SNAPSHOT', 'IT_PRIORITY_CHANGED');
  needs_action := activity_action IN ('ACTION_CREATED', 'ACTION_UPDATED', 'ACTION_ASSIGNED', 'ACTION_REASSIGNED', 'ACTION_UNASSIGNED', 'ACTION_STARTED', 'ACTION_COMPLETED', 'ACTION_CANCELLED');

  SELECT EXISTS (SELECT 1 FROM ticket_assignment_activity WHERE ticket_activity_id = activity_id),
         EXISTS (SELECT 1 FROM ticket_status_activity WHERE ticket_activity_id = activity_id),
         EXISTS (SELECT 1 FROM ticket_priority_activity WHERE ticket_activity_id = activity_id),
         EXISTS (SELECT 1 FROM action_taken_activity WHERE ticket_activity_id = activity_id)
    INTO has_assignment, has_status, has_priority, has_action;

  IF has_assignment <> needs_assignment
     OR (needs_status AND NOT has_status) OR (has_status AND NOT allows_status)
     OR has_priority <> needs_priority OR has_action <> needs_action
     OR (activity_action = 'TICKET_ASSIGNED' AND EXISTS (
       SELECT 1 FROM ticket_status_activity WHERE ticket_activity_id = activity_id
         AND (previous_status IS DISTINCT FROM 'NEW'::"TicketStatus" OR status <> 'OPEN'::"TicketStatus")
     ))
     OR (activity_action <> 'MIGRATED_TICKET_SNAPSHOT' AND (
       EXISTS (SELECT 1 FROM ticket_status_activity WHERE ticket_activity_id = activity_id AND previous_status IS NULL)
       OR EXISTS (SELECT 1 FROM ticket_priority_activity WHERE ticket_activity_id = activity_id AND previous_priority IS NULL)
     )) THEN
    RAISE EXCEPTION 'Activity typed details must match its action and include required previous state'
      USING ERRCODE = '23514', CONSTRAINT = 'ticket_activity_typed_details_check';
  END IF;
END;
$$;

-- Existing rows must satisfy the same contract; fail atomically without deleting data.
DO $$
DECLARE activity_id INTEGER;
BEGIN
  FOR activity_id IN SELECT id FROM ticket_activity ORDER BY id LOOP
    PERFORM validate_ticket_activity_details(activity_id);
  END LOOP;
END;
$$;

COMMIT;
