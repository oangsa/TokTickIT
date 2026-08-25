import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ApiResponseError,
  InvalidRequesterContextError,
  MasterDataItem,
  Ticket,
} from "../api.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { Form } from "../components/Form.js";
import { Modal } from "../components/Modal.js";
import { PageHeader } from "../components/PageHeader.js";
import { ReadOnlyField } from "../components/ReadOnlyField.js";
import { Select } from "../components/Select.js";
import { Skeleton } from "../components/Skeleton.js";
import { Textarea } from "../components/Textarea.js";
import { TextInput } from "../components/TextInput.js";
import { useRequester } from "../requester/RequesterProvider.js";
import { useRequesterApi } from "../requester/useRequesterApi.js";
import {
  CreateTicketDraft,
  CreateTicketPayload,
  EMPTY_DRAFT,
  RecoveryRecord,
  clearRecovery,
  isDirty,
  payloadSignature,
  readRecovery,
  toPayload,
  writeRecovery,
} from "../tickets/createTicketDraft.js";

type LoadState = "loading" | "loaded" | "failed";

type FieldErrors = Partial<Record<keyof CreateTicketDraft | "form", string>>;

const GENERATED_VALUE_TEXT = "Assigned on submission";

/* Field order drives first-invalid focus (ui-spec Section 8.2). */
const FIELD_ORDER: (keyof CreateTicketDraft)[] = [
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "summary",
  "description",
];

const FIELD_IDS: Record<string, string> = {
  categoryId: "create-ticket-category",
  relatedSystemId: "create-ticket-related-system",
  requestedPriority: "create-ticket-priority",
  summary: "create-ticket-summary",
  description: "create-ticket-description",
};

/*
 * Mirrors api-spec Section 7.3 so the user sees the message beside the field
 * instead of after a round trip. The backend stays authoritative: a rejection
 * that arrives anyway is mapped back onto the same fields below.
 */
/*
 * Characters, not UTF-16 code units: the backend measures the same way because
 * the database CHECK is `char_length(...)`. Counting with `.length` here would
 * mark a valid emoji Summary invalid and let a too-short one through to a 500.
 */
function characters(value: string): number {
  return [...value].length;
}

function validate(draft: CreateTicketDraft): FieldErrors {
  const errors: FieldErrors = {};
  const summary = draft.summary.trim();
  const description = draft.description.trim();

  if (draft.categoryId === "") {
    errors.categoryId = "Select a Category.";
  }

  if (draft.relatedSystemId === "") {
    errors.relatedSystemId = "Select a Related System.";
  }

  if (draft.requestedPriority === "") {
    errors.requestedPriority = "Select a Requested Priority.";
  }

  if (characters(summary) < 3 || characters(summary) > 150) {
    errors.summary = "Summary must contain 3-150 characters.";
  }

  if (characters(description) < 10 || characters(description) > 2000) {
    errors.description = "Description must contain 10-2000 characters.";
  }

  return errors;
}

/* Only the fields this form owns; anything else stays a form-level message. */
function mapServerErrors(error: ApiResponseError): FieldErrors {
  const errors: FieldErrors = {};

  for (const detail of error.details) {
    if (detail.field in FIELD_IDS) {
      errors[detail.field as keyof CreateTicketDraft] = detail.message;
    }
  }

  if (Object.keys(errors).length === 0) {
    errors.form =
      error.status === 409
        ? "This submission conflicts with the current state. Review the form and try again."
        : "The Ticket could not be created. Review the form and try again.";
  }

  return errors;
}

export default function CreateTicket() {
  const navigate = useNavigate();
  const { requester, captureRequesterContext, isRequesterContextCurrent } = useRequester();
  const callApi = useRequesterApi();

  const [categories, setCategories] = useState<MasterDataItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<MasterDataItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadCount, setReloadCount] = useState(0);

  const [draft, setDraft] = useState<CreateTicketDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryRecord | null>(null);

  /*
   * BR-24. The key belongs to one logical payload: an unchanged retry reuses it
   * and any change to the normalized payload mints a new one. Kept in refs
   * because changing them must not re-render; `signatureRef` decides "unchanged".
   */
  const keyRef = useRef<string | null>(null);
  const keyCreatedAtRef = useRef(0);
  const signatureRef = useRef<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load(): Promise<void> {
      setLoadState("loading");

      try {
        const [loadedCategories, loadedSystems] = await Promise.all([
          callApi<MasterDataItem[]>("/api/categories"),
          callApi<MasterDataItem[]>("/api/related-systems"),
        ]);

        /* A slower earlier response must never paint over a newer one. */
        if (!ignore) {
          setCategories(loadedCategories);
          setRelatedSystems(loadedSystems);
          setLoadState("loaded");
        }
      } catch {
        if (!ignore) {
          setCategories([]);
          setRelatedSystems([]);
          setLoadState("failed");
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [callApi, reloadCount]);

  /*
   * ui-spec Section 12.2: a stored ambiguous attempt is offered, never
   * auto-submitted on load.
   */
  useEffect(() => {
    if (requester === null) {
      return;
    }

    setRecovery(readRecovery(requester.id, Date.now()));
  }, [requester]);

  const update = useCallback((patch: Partial<CreateTicketDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  function focusFirstInvalid(fieldErrors: FieldErrors): void {
    const first = FIELD_ORDER.find((field) => fieldErrors[field] !== undefined);

    if (first !== undefined) {
      document.getElementById(FIELD_IDS[first])?.focus();
    }
  }

  /*
   * Reuses the current key when the normalized payload is unchanged and mints a
   * new one otherwise, so a corrected form never replays under the old key.
   */
  function idempotencyKeyFor(payload: CreateTicketPayload): string {
    const signature = payloadSignature(payload);

    if (keyRef.current === null || signatureRef.current !== signature) {
      keyRef.current = crypto.randomUUID();
      keyCreatedAtRef.current = Date.now();
      signatureRef.current = signature;
    }

    return keyRef.current;
  }

  /*
   * A submission belongs to the Requester context that started it. The request
   * can outlive that context -- the user may change Requester while it is still
   * pending -- and every completion path below writes requester-scoped state:
   * navigation, the shared `sessionStorage` recovery record, the form's own
   * errors. Applying any of that under a different Requester would render
   * Requester A's outcome for Requester B, so an obsolete completion is dropped
   * instead. The server result stays authoritative and is simply not consumed
   * by this session; selecting Requester A again discovers it normally.
   */
  async function submit(payload: CreateTicketPayload, key: string): Promise<void> {
    const token = captureRequesterContext();

    setSubmitting(true);

    try {
      const ticket = await callApi<Ticket>("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });

      if (!isRequesterContextCurrent(token)) {
        return;
      }

      /* Confirmed success: nothing is left ambiguous to resume. */
      clearRecovery();
      setRecovery(null);
      navigate(`/tickets/${ticket.publicId}`, {
        state: { created: true, ticketNumber: ticket.ticketNumber },
      });
    } catch (error) {
      /*
       * Checked before the failure is classified at all: a stale 4xx must not
       * clear the current Requester's recovery record, and a stale 5xx or
       * transport failure -- which is also how the requester-change abort
       * surfaces -- must not write the previous Requester's record over it.
       */
      if (!isRequesterContextCurrent(token)) {
        return;
      }

      /*
       * A context-invalidating 400 is a confirmed non-ambiguous failure: the
       * guard rejected the request before the route, so no Ticket exists.
       * `useRequesterApi` has already cleared the requester and its recovery
       * record, and `RequesterGuard` is redirecting to `/requesters`; writing a
       * recovery record here would resurrect one for a Requester that is gone.
       */
      if (error instanceof InvalidRequesterContextError) {
        return;
      }

      if (error instanceof ApiResponseError && error.status < 500) {
        /*
         * Section 12.1: a 4xx is a confirmed non-ambiguous failure. Stay on the
         * page, keep the values and the Pending Attachment state, mark the
         * fields, and drop any recovery record -- there is nothing to resume.
         */
        clearRecovery();
        setRecovery(null);

        const mapped = mapServerErrors(error);
        setErrors(mapped);
        focusFirstInvalid(mapped);
        return;
      }

      /*
       * Section 12.2: a 5xx or a transport failure leaves completion ambiguous.
       * Persist the approved recovery data so an explicit Resume can retry the
       * unchanged request under the same key.
       */
      if (requester !== null) {
        const record: RecoveryRecord = {
          requesterId: requester.id,
          idempotencyKey: key,
          keyCreatedAt: keyCreatedAtRef.current,
          payload,
        };
        writeRecovery(record);
        setRecovery(record);
      }

      setErrors({
        form: "The Ticket submission did not complete. Use Resume Submission Recovery to retry it.",
      });
    } finally {
      if (isRequesterContextCurrent(token)) {
        setSubmitting(false);
      }
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const fieldErrors = validate(draft);
    setErrors(fieldErrors);

    if (Object.keys(fieldErrors).length > 0) {
      focusFirstInvalid(fieldErrors);
      return;
    }

    const payload = toPayload(draft);
    void submit(payload, idempotencyKeyFor(payload));
  }

  function handleResume(): void {
    if (recovery === null || submitting) {
      return;
    }

    /* The unchanged original request under the original key (Section 12.2). */
    keyRef.current = recovery.idempotencyKey;
    keyCreatedAtRef.current = recovery.keyCreatedAt;
    signatureRef.current = payloadSignature(recovery.payload);
    void submit(recovery.payload, recovery.idempotencyKey);
  }

  /* BR-25: an untouched empty draft leaves directly; anything else confirms. */
  function handleCancel(): void {
    if (isDirty(draft) || draft.attachmentIds.length > 0) {
      setConfirmDiscard(true);
      return;
    }

    navigate("/tickets");
  }

  function handleConfirmDiscard(): void {
    setConfirmDiscard(false);
    clearRecovery();
    setRecovery(null);
    setDraft(EMPTY_DRAFT);
    keyRef.current = null;
    signatureRef.current = null;
    navigate("/tickets");
  }

  /* No <main> here: AppShell owns the main landmark for in-shell routes. */
  return (
    <>
      <PageHeader title="Create Ticket" subtitle="Describe your IT support request." />

      {loadState === "failed" ? (
        <Card>
          <ErrorState
            title="The Ticket form could not be loaded."
            description="Check that the TokTickIT API is running, then try again."
            onRetry={() => setReloadCount((count) => count + 1)}
          />
        </Card>
      ) : null}

      {loadState === "loading" ? (
        <Card>
          <Skeleton width="12rem" height="1rem" />
          <Skeleton height="2.5rem" />
          <Skeleton height="2.5rem" />
          <Skeleton height="8rem" />
        </Card>
      ) : null}

      {loadState === "loaded" ? (
        <Form onSubmit={handleSubmit} aria-label="Create Ticket">
          <Card>
            <h2 className="h6 fw-semibold">Ticket Information</h2>

            {/*
             * ui-spec Section 11.3. The generated values are shown as read-only
             * controls that state they are assigned on submission. They are
             * never request-body fields, so they live outside the draft.
             */}
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Ticket Number" value={GENERATED_VALUE_TEXT} />
              </div>
              <div className="col-12 col-md-6">
                <ReadOnlyField label="Ticket Date" value={GENERATED_VALUE_TEXT} />
              </div>
            </div>

            <ReadOnlyField
              label="Requester"
              value={requester?.name ?? ""}
              helpText="Change the Requester from the navigation, not from this form."
            />

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <Select
                  id={FIELD_IDS.categoryId}
                  label="Category"
                  required
                  value={draft.categoryId}
                  error={errors.categoryId}
                  onChange={(event) => update({ categoryId: event.target.value })}
                >
                  <option value="">Select a Category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="col-12 col-md-6">
                <Select
                  id={FIELD_IDS.relatedSystemId}
                  label="Related System"
                  required
                  value={draft.relatedSystemId}
                  error={errors.relatedSystemId}
                  onChange={(event) => update({ relatedSystemId: event.target.value })}
                >
                  <option value="">Select a Related System</option>
                  {relatedSystems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <Select
              id={FIELD_IDS.requestedPriority}
              label="Requested Priority"
              required
              value={draft.requestedPriority}
              error={errors.requestedPriority}
              onChange={(event) => update({ requestedPriority: event.target.value })}
            >
              <option value="">Select a Requested Priority</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>

            {/*
             * No `maxLength`: the attribute counts UTF-16 code units, so it
             * would cut a 150-character emoji Summary off at 75 -- a value the
             * counter, the validator, and the column all accept. Section 9
             * makes the always-visible counter the feedback mechanism, and
             * `validate` is the hard stop.
             */}
            <TextInput
              id={FIELD_IDS.summary}
              label="Summary"
              required
              value={draft.summary}
              error={errors.summary}
              counter={{ value: characters(draft.summary.trim()), max: 150 }}
              onChange={(event) => update({ summary: event.target.value })}
            />

            <Textarea
              id={FIELD_IDS.description}
              label="Description"
              required
              value={draft.description}
              error={errors.description}
              counter={{ value: characters(draft.description.trim()), max: 2000 }}
              onChange={(event) => update({ description: event.target.value })}
            />
          </Card>

          {/*
           * Attachments are the Issue #24 seam. The draft already carries the
           * final prepared Pending `attachmentIds`, which is what the submission
           * sends; the upload cards, their states, and Retry belong to that Issue.
           */}
          <Card>
            <h2 className="h6 fw-semibold">Attachments</h2>
            <p className="text-secondary mb-0">Attachment upload is added in Issue 24.</p>
          </Card>

          {recovery !== null ? (
            <Card>
              <p role="status" className="mb-3">
                A previous submission did not complete. Resume it to recover the Ticket without
                creating a duplicate.
              </p>
              <Button variant="secondary" onClick={handleResume} disabled={submitting}>
                Resume Submission Recovery
              </Button>
            </Card>
          ) : null}

          {errors.form !== undefined ? (
            <p role="alert" className="tt-invalid-text">
              {errors.form}
            </p>
          ) : null}

          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" type="button" onClick={handleCancel}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" busy={submitting} disabled={submitting}>
              Submit Ticket
            </Button>
          </div>
        </Form>
      ) : null}

      <Modal
        open={confirmDiscard}
        title="Discard this Ticket?"
        onClose={() => setConfirmDiscard(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={handleConfirmDiscard}>
              Discard
            </Button>
          </>
        }
      >
        <p className="mb-0">Your Ticket details and any prepared Attachments will be discarded.</p>
      </Modal>
    </>
  );
}
