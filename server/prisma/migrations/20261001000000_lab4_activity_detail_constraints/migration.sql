-- Typed detail cardinality spans tables, so CHECK constraints alone cannot enforce it.
-- Defer validation until commit to allow the parent and its children in one transaction.
BEGIN;

CREATE FUNCTION validate_ticket_activity_details(activity_id INTEGER) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  activity_action "TicketActivityType";
  has_assignment BOOLEAN;
  has_status BOOLEAN;
  has_priority BOOLEAN;
  has_action BOOLEAN;
  needs_assignment BOOLEAN;
  needs_status BOOLEAN;
  needs_priority BOOLEAN;
  needs_action BOOLEAN;
BEGIN
  -- Serialize checks for concurrent changes to this Activity's children.
  SELECT action INTO activity_action FROM ticket_activity WHERE id = activity_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  needs_assignment := activity_action IN ('MIGRATED_TICKET_SNAPSHOT', 'TICKET_ASSIGNED', 'TICKET_REASSIGNED', 'TICKET_UNASSIGNED');
  needs_status := activity_action IN ('MIGRATED_TICKET_SNAPSHOT', 'TICKET_STARTED_WORK', 'INFORMATION_REQUESTED', 'TICKET_RESUMED', 'TICKET_MARKED_RESOLVED', 'TICKET_CLOSED', 'TICKET_CANCELLED', 'TICKET_REOPENED');
  needs_priority := activity_action IN ('MIGRATED_TICKET_SNAPSHOT', 'IT_PRIORITY_CHANGED');
  needs_action := activity_action IN ('ACTION_CREATED', 'ACTION_UPDATED', 'ACTION_ASSIGNED', 'ACTION_REASSIGNED', 'ACTION_UNASSIGNED', 'ACTION_STARTED', 'ACTION_COMPLETED', 'ACTION_CANCELLED');

  SELECT EXISTS (SELECT 1 FROM ticket_assignment_activity WHERE ticket_activity_id = activity_id),
         EXISTS (SELECT 1 FROM ticket_status_activity WHERE ticket_activity_id = activity_id),
         EXISTS (SELECT 1 FROM ticket_priority_activity WHERE ticket_activity_id = activity_id),
         EXISTS (SELECT 1 FROM action_taken_activity WHERE ticket_activity_id = activity_id)
    INTO has_assignment, has_status, has_priority, has_action;

  IF has_assignment <> needs_assignment OR has_status <> needs_status
     OR has_priority <> needs_priority OR has_action <> needs_action
     OR (activity_action <> 'MIGRATED_TICKET_SNAPSHOT' AND (
       EXISTS (SELECT 1 FROM ticket_status_activity WHERE ticket_activity_id = activity_id AND previous_status IS NULL)
       OR EXISTS (SELECT 1 FROM ticket_priority_activity WHERE ticket_activity_id = activity_id AND previous_priority IS NULL)
     )) THEN
    RAISE EXCEPTION 'Activity typed details must match its action and include required previous state'
      USING ERRCODE = '23514', CONSTRAINT = 'ticket_activity_typed_details_check';
  END IF;
END;
$$;

CREATE FUNCTION enforce_ticket_activity_details() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'ticket_activity' THEN
    IF TG_OP <> 'INSERT' THEN PERFORM validate_ticket_activity_details(OLD.id); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM validate_ticket_activity_details(NEW.id); END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN PERFORM validate_ticket_activity_details(OLD.ticket_activity_id); END IF;
    IF TG_OP <> 'DELETE' THEN PERFORM validate_ticket_activity_details(NEW.ticket_activity_id); END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER ticket_activity_typed_details_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ticket_activity
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ticket_activity_details();
CREATE CONSTRAINT TRIGGER ticket_assignment_activity_typed_details_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ticket_assignment_activity
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ticket_activity_details();
CREATE CONSTRAINT TRIGGER ticket_status_activity_typed_details_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ticket_status_activity
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ticket_activity_details();
CREATE CONSTRAINT TRIGGER ticket_priority_activity_typed_details_trigger
  AFTER INSERT OR UPDATE OR DELETE ON ticket_priority_activity
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ticket_activity_details();
CREATE CONSTRAINT TRIGGER action_taken_activity_typed_details_trigger
  AFTER INSERT OR UPDATE OR DELETE ON action_taken_activity
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enforce_ticket_activity_details();

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
