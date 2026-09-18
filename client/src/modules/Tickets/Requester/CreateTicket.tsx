import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

import {
  ApiResponseError,
  MasterDataItem,
  Ticket,
} from "../../../api.js";
import { useAuth } from "../../../auth/AuthProvider.js";
import { Button } from "../../../components/Common/Button.js";
import {
  AttachmentSection,
  AttachmentSectionHandle,
} from "../attachments/AttachmentSection.js";
import { releasePendingAttachments } from "../attachments/pendingCleanup.js";
import { Card } from "../../../components/Common/Card.js";
import { CommonForm } from "../../../components/Common/Form/CommonForm.js";
import { ErrorState } from "../../../components/Common/Feedback/ErrorState.js";
import { ManagePage } from "../../../components/Maintain/ManagePage.js";
import { Modal } from "../../../components/Common/Modal.js";
import type { PageHeaderProps } from "../../../components/Maintain/PageHeader.js";
import { Skeleton } from "../../../components/Common/Feedback/Skeleton.js";
import type { FormSection } from "../../../forms/formTypes.js";
import { useManagedForm } from "../../../forms/useManagedForm.js";
import { TICKET_FORM_RULES } from "../../../constants/forms/ticket.js";
import {
  NavigationAction,
  useNavigationGuard,
} from "../../../navigation/NavigationGuard.js";
import { useAuthenticatedApi } from "../../../auth/useAuthenticatedApi.js";
import {
  CreateTicketPayload,
  RecoveryRecord,
  clearRecovery,
  payloadSignature,
  readRecovery,
  writeRecovery,
} from "../createTicketDraft.js";

type LoadState = "loading" | "loaded" | "failed";

const GENERATED_VALUE_TEXT = "Assigned on submission";

const CREATE_TICKET_PAGE_HEADER = {
  title: "Create Ticket",
  subtitle: "Describe your IT support request.",
  backAction: { to: "/tickets", label: "Back to My Tickets" },
} satisfies PageHeaderProps;

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

function payloadFromForm(values: CreateTicketFormValues): CreateTicketPayload {
  return {
    categoryId: values.categoryId as number,
    relatedSystemId: values.relatedSystemId as number,
    requestedPriority: values.requestedPriority as "LOW" | "MEDIUM" | "HIGH",
    summary: values.summary.trim(),
    description: values.description.trim(),
    attachmentIds: values.attachmentIds,
  };
}

interface CreateTicketFormValues {
  ticketNumber: string;
  ticketDate: string;
  requester: string;
  categoryId: number | undefined;
  relatedSystemId: number | undefined;
  requestedPriority: "" | "LOW" | "MEDIUM" | "HIGH";
  summary: string;
  description: string;
  attachmentIds: string[];
}

const TICKET_FORM_FIELDS = new Set([
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "summary",
  "description",
  "attachmentIds",
]);

const ticketSchema = z.object({
  ticketNumber: z.string(),
  ticketDate: z.string(),
  requester: z.string(),
  categoryId: z.number({ error: "Select a Category." }).int().positive("Select a Category."),
  relatedSystemId: z.number({ error: "Select a Related System." }).int().positive("Select a Related System."),
  requestedPriority: z.enum(["LOW", "MEDIUM", "HIGH"], { error: "Select a Requested Priority." }),
  summary: z.string()
    .trim()
    .refine((value) => characters(value) >= TICKET_FORM_RULES.summary.minLength, "Summary must contain 3-150 characters.")
    .refine((value) => characters(value) <= TICKET_FORM_RULES.summary.maxLength, "Summary must contain 3-150 characters."),
  description: z.string()
    .trim()
    .refine((value) => characters(value) >= TICKET_FORM_RULES.description.minLength, "Description must contain 10-2000 characters.")
    .refine((value) => characters(value) <= TICKET_FORM_RULES.description.maxLength, "Description must contain 10-2000 characters."),
  attachmentIds: z.array(z.string()).max(5),
});

export default function CreateTicket() {
  const navigate = useNavigate();
  const { register, allowNavigation, cancelNavigation } = useNavigationGuard();
  const { user } = useAuth();
  const callApi = useAuthenticatedApi();
  const identityRef = useRef<string | null>(user?.publicId ?? null);

  const form = useManagedForm<CreateTicketFormValues>({
    schema: ticketSchema as never,
    defaultValues: {
      ticketNumber: GENERATED_VALUE_TEXT,
      ticketDate: GENERATED_VALUE_TEXT,
      requester: user?.name ?? "",
      categoryId: undefined,
      relatedSystemId: undefined,
      requestedPriority: "",
      summary: "",
      description: "",
      attachmentIds: [],
    },
  });

  const [categories, setCategories] = useState<MasterDataItem[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<MasterDataItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadCount, setReloadCount] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryRecord | null>(null);
  const pendingNavigationRef = useRef<NavigationAction | null>(null);
  const recoveryIdentityRef = useRef<string | null>(user?.publicId ?? null);
  /*
   * AC-16: an intended file that is still Uploading, or that Failed or was
   * Invalid, blocks Submit until it is retried successfully or explicitly
   * removed. Submitting anyway would create the Ticket as though the file had
   * uploaded, which is the one outcome the contract rules out.
   */
  const [unresolvedFiles, setUnresolvedFiles] = useState(false);
  /* BR-23 compensation is driven from here but performed by the Attachment card,
   * which is where the prepared rows and their upload state live. */
  const attachmentsRef = useRef<AttachmentSectionHandle | null>(null);

  /*
   * BR-24. The key belongs to one logical payload: an unchanged retry reuses it
   * and any change to the normalized payload mints a new one. Kept in refs
   * because changing them must not re-render; `signatureRef` decides "unchanged".
   */
  const keyRef = useRef<string | null>(null);
  const keyCreatedAtRef = useRef(0);
  const signatureRef = useRef<string | null>(null);
  /* Independent from Requester generation: confirmed discard invalidates the
   * Create Ticket attempt even when the Requester remains unchanged. */
  const submissionGenerationRef = useRef(0);

  useEffect(() => {
    identityRef.current = user?.publicId ?? null;
  }, [user?.publicId]);

  /*
   * BR-25's "anything else". `unresolvedFiles` is part of it: a file still
   * Uploading is in neither `isDirty` nor `attachmentIds` yet, but the Requester
   * did choose it, and leaving silently would drop a row the server is about to
   * create. The Cancel confirmation and the unload warning both read this, so
   * those two can never disagree about what counts as work worth keeping.
   */
  const dirty =
    form.formState.isDirty ||
    form.watch("attachmentIds").length > 0 ||
    unresolvedFiles ||
    recovery !== null;

  /*
   * Cancel confirms through the discard dialog. The shared shell navigation uses
   * the same guard, so leaving through My Tickets cannot
   * silently drop the draft or a stored recovery attempt.
   *
   * A reload or tab close still uses the browser's own prompt. In-app history
   * navigation is blocked by the data-router guard registered above.
   */
  useEffect(() => {
    if (!dirty) {
      return;
    }

    function warn(event: BeforeUnloadEvent): void {
      event.preventDefault();
      /* Safari still reads the legacy field rather than the cancellation. */
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const requestDiscard = useCallback((action: NavigationAction): void => {
    pendingNavigationRef.current = action;
    setConfirmDiscard(true);
  }, []);

  useEffect(
    () => register({ dirty, onBlockedNavigation: requestDiscard }),
    [dirty, register, requestDiscard],
  );

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
    const currentIdentity = user?.publicId ?? null;

    if (
      currentIdentity === null ||
      (recoveryIdentityRef.current !== null && recoveryIdentityRef.current !== currentIdentity)
    ) {
      clearRecovery();
      setRecovery(null);
    } else {
      setRecovery(readRecovery(Date.now()));
    }

    recoveryIdentityRef.current = currentIdentity;
  }, [user?.publicId]);

  const handlePendingIdsChange = useCallback(
    (attachmentIds: string[]) => {
      const current = form.getValues("attachmentIds");
      if (current.join(",") === attachmentIds.join(",")) return;
      form.setValue("attachmentIds", attachmentIds, { shouldDirty: true, shouldValidate: true });
    },
    [form],
  );

  const sections = useMemo<FormSection<CreateTicketFormValues>[]>(
    () => [
      {
        key: "ticket-information",
        title: "Ticket Information",
        fields: [
          { key: "ticketNumber", name: "ticketNumber", label: "Ticket Number", type: "readonly", value: GENERATED_VALUE_TEXT, span: "half" },
          { key: "ticketDate", name: "ticketDate", label: "Ticket Date", type: "readonly", value: GENERATED_VALUE_TEXT, span: "half" },
          { key: "requester", name: "requester", label: "Requester", type: "readonly", value: user?.name ?? "", helpText: "Authenticated User", span: "full" },
          {
            key: "categoryId",
            name: "categoryId",
            label: "Category",
            type: "select",
            required: true,
            autoComplete: "off",
            options: categories.map((category) => ({ value: category.id, label: category.name })),
            span: "half",
          },
          {
            key: "relatedSystemId",
            name: "relatedSystemId",
            label: "Related System",
            type: "select",
            required: true,
            autoComplete: "off",
            options: relatedSystems.map((system) => ({ value: system.id, label: system.name })),
            span: "half",
          },
          {
            key: "requestedPriority",
            name: "requestedPriority",
            label: "Requested Priority",
            type: "select",
            required: true,
            autoComplete: "off",
            options: [
              { value: "LOW", label: "Low" },
              { value: "MEDIUM", label: "Medium" },
              { value: "HIGH", label: "High" },
            ],
            span: "half",
          },
          {
            key: "summary",
            name: "summary",
            label: "Summary",
            type: "text",
            required: true,
            maxLength: TICKET_FORM_RULES.summary.maxLength,
            enforceMaxLength: false,
            showCount: true,
            autoComplete: "off",
            span: "full",
          },
          {
            key: "description",
            name: "description",
            label: "Description",
            type: "textarea",
            required: true,
            maxLength: TICKET_FORM_RULES.description.maxLength,
            enforceMaxLength: false,
            showCount: true,
            autoComplete: "off",
            span: "full",
          },
          {
            key: "attachments",
            name: "attachmentIds",
            label: "Attachments",
            type: "custom",
            span: "full",
            render: () => (
              <AttachmentSection
                mode="create"
                handleRef={attachmentsRef}
                onPendingIdsChange={handlePendingIdsChange}
                onUnresolvedChange={setUnresolvedFiles}
              />
            ),
          },
        ],
      },
    ],
    [categories, relatedSystems, user?.name, handlePendingIdsChange],
  );

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

  function isSubmissionCurrent(generation: number): boolean {
    return submissionGenerationRef.current === generation;
  }

  function invalidateSubmission(): void {
    submissionGenerationRef.current += 1;
  }

  /* A submission can outlive an auth identity change; stale completions cannot
   * write form state, recovery, or navigation into the replacement session. */
  async function submit(payload: CreateTicketPayload, key: string): Promise<void> {
    const identityAtStart = identityRef.current;
    const generation = ++submissionGenerationRef.current;

    setSubmitting(true);

    try {
      const ticket = await callApi<Ticket>("/api/users/me/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify(payload),
      });

      if (identityRef.current !== identityAtStart || !isSubmissionCurrent(generation)) {
        return;
      }

      /* Confirmed success: nothing is left ambiguous to resume. */
      clearRecovery();
      setRecovery(null);
      allowNavigation(() =>
        navigate(`/tickets/${ticket.publicId}`, {
          state: { created: true, ticketNumber: ticket.ticketNumber },
        }),
      );
    } catch (error) {
      /*
       * Check identity before classifying failures so stale results cannot write
       * recovery or form state into a replacement session.
       */
      if (identityRef.current !== identityAtStart || !isSubmissionCurrent(generation)) {
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
        form.mapServerErrors(
          error,
          TICKET_FORM_FIELDS,
          error.status === 409
            ? "This submission conflicts with the current state. Review the form and try again."
            : "The Ticket could not be created. Review the form and try again.",
        );
        return;
      }

      /*
       * Section 12.2: a 5xx or a transport failure leaves completion ambiguous.
       * Persist the approved recovery data so an explicit Retry Again action can retry the
       * unchanged request under the same key.
       */
      if (user !== null) {
        const record: RecoveryRecord = {
          idempotencyKey: key,
          keyCreatedAt: keyCreatedAtRef.current,
          payload,
        };
        writeRecovery(record);
        setRecovery(record);
      }

      form.setFormError(
        "The Ticket submission did not complete. Use Retry Again to recover the Ticket without creating a duplicate.",
      );

      /*
       * BR-23 compensation. The release carries an empty reason per item, so a
       * row a committed create already bound cannot be removed by it -- the
       * batch is refused and, being all-or-nothing, nothing changes. That makes
       * the answer informative rather than merely safe:
       *
       * - refused: the rows may be Active on a Ticket that did commit, so the
       *   recovery record stands and Retry Again replays the same key.
       * - confirmed: every row was still Pending, so the create never bound
       *   them; and a create that commits after this finds them gone, fails its
       *   guarded binding, and rolls back. Nothing is left to resume, so the
       *   recovery record is dropped rather than left to answer 404 forever, and
       *   the rows become re-uploadable through Retry Upload.
       */
      const released = (await attachmentsRef.current?.releasePending()) ?? false;

      if (
        released &&
        identityRef.current === identityAtStart &&
        isSubmissionCurrent(generation)
      ) {
        clearRecovery();
        setRecovery(null);
        form.setFormError("The Ticket was not created. Retry the uploads shown below, then submit again.");
      }
    } finally {
      if (identityRef.current === identityAtStart && isSubmissionCurrent(generation)) {
        setSubmitting(false);
      }
    }
  }

  async function handleFormSubmit(values: CreateTicketFormValues): Promise<void> {
    if (submitting) return;

    if (recovery !== null) {
      handleRetrySubmission();
      return;
    }

    const payload = payloadFromForm(values);
    await submit(payload, idempotencyKeyFor(payload));
  }

  function handleRetrySubmission(): void {
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
    if (dirty) {
      pendingNavigationRef.current = null;
      setConfirmDiscard(true);
      return;
    }

    navigate("/tickets");
  }

  /*
   * BR-25 and ui-spec Section 12.4. Discarding the draft also releases the
   * Pending rows it prepared, through the unified collection endpoint with an
   * empty reason for each -- Pending rows ignore the reason, and inventing an
   * Active-removal reason here would be the client asserting something about a
   * lifecycle state it does not know the row is in.
   *
   * Best effort on purpose: the request is not awaited and its failure is
   * swallowed, because the user asked to leave and a forgotten Pending row is
   * already covered by the 24-hour orphan sweep. It is only safe at all because
   * the endpoint hard-deletes a row solely while it is still unbound: a row that
   * a create already bound is not silently soft-removed by this call.
   *
   * Only reached from a confirmed discard, which is the one moment the draft is
   * known not to have been submitted.
   */
  function handleConfirmDiscard(): void {
    const preparedIds = Array.from(
      new Set([...form.getValues("attachmentIds"), ...(recovery?.payload.attachmentIds ?? [])]),
    );
    const pendingNavigation =
      pendingNavigationRef.current ?? (() => allowNavigation(() => navigate("/tickets")));

    invalidateSubmission();
    setConfirmDiscard(false);
    pendingNavigationRef.current = null;
    clearRecovery();
    setRecovery(null);
    form.reset({
      ticketNumber: GENERATED_VALUE_TEXT,
      ticketDate: GENERATED_VALUE_TEXT,
      requester: user?.name ?? "",
      categoryId: undefined,
      relatedSystemId: undefined,
      requestedPriority: "",
      summary: "",
      description: "",
      attachmentIds: [],
    });
    form.setFormError(undefined);
    keyRef.current = null;
    signatureRef.current = null;

    void releasePendingAttachments(callApi, preparedIds);

    pendingNavigation();
  }

  function handleKeepEditing(): void {
    pendingNavigationRef.current = null;
    cancelNavigation();
    setConfirmDiscard(false);
  }

  /* No <main> here: AppShell owns the main landmark for in-shell routes. */
  return (
    <ManagePage header={CREATE_TICKET_PAGE_HEADER} className="tt-create-ticket">

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

      <p role="status" className="visually-hidden">
        {loadState === "loading"
          ? "Loading Ticket form…"
          : loadState === "loaded"
            ? "Ticket form loaded."
            : ""}
      </p>

      {loadState === "loaded" ? (
        <CommonForm
          form={form}
          sections={sections}
          onSubmit={handleFormSubmit}
          onCancel={handleCancel}
          submitLabel={recovery === null ? "Submit Ticket" : "Retry Again"}
          submitting={submitting}
          submitDisabled={submitting || unresolvedFiles}
          bypassValidation={recovery !== null}
          className="tt-stack"
          ariaLabel="Create Ticket"
        />
      ) : null}

      <Modal
        open={confirmDiscard}
        title="Discard this Ticket?"
        onClose={handleKeepEditing}
        footer={
          <>
            <Button variant="secondary" onClick={handleKeepEditing}>
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
    </ManagePage>
  );
}
