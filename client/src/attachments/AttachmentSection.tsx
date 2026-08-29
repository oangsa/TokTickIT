import { ChangeEvent, MutableRefObject, useEffect, useId, useMemo, useRef, useState } from "react";

import { ApiResponseError, Attachment } from "../api.js";
import { AttachmentState, AttachmentStateName } from "../components/AttachmentState.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { IconButton } from "../components/IconButton.js";
import { Modal } from "../components/Modal.js";
import { useRequesterApi } from "../requester/useRequesterApi.js";
import { ticketDateTime } from "../tickets/ticketDate.js";
import { AttachmentDownloadButton, AttachmentPreviewModal, PreviewTarget } from "./AttachmentPreviewModal.js";
import {
  ATTACHMENT_RULES_TEXT,
  ATTACHMENT_TIMEOUT_MS,
  MAX_ACTIVE_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  formatSize,
  removalReasonError,
  validateSelectedFile,
} from "./attachmentRules.js";
import { releasePendingAttachments } from "./pendingCleanup.js";

/*
 * `md` (768px) is the same cut My Tickets uses for secondary metadata. Filename,
 * status, selection, and actions stay at every width (ui-spec Section 21.3).
 */
const SECONDARY_COLUMN = "d-none d-md-table-cell";

/*
 * A row in the table, whichever screen it came from. Create Ticket rows are
 * client-local until they are pre-uploaded; Ticket Detail rows are always
 * persisted. Collapsing them here keeps one table rather than two that have to
 * be kept looking alike.
 */
interface AttachmentRowView {
  key: string;
  name: string;
  extension: string | null;
  sizeBytes: number;
  uploadedAt: string | null;
  state: AttachmentStateName;
  attachmentId: string | null;
  mimeType: string | null;
  removalReason: string | null;
  message: string | null;
}

interface UploadEntry {
  key: string;
  file: File;
  state: "Uploading" | "Failed" | "Invalid" | "Pending" | "Active";
  message: string | null;
  attachment: Attachment | null;
}

interface CreateModeProps {
  mode: "create";
  /* Receives the compensation handle below; see `AttachmentSectionHandle`. */
  handleRef?: MutableRefObject<AttachmentSectionHandle | null>;
  /* The prepared Pending IDs, in the order they were accepted. */
  onPendingIdsChange: (attachmentIds: string[]) => void;
  /* True while any intended file is still Uploading, Failed, or Invalid. */
  onUnresolvedChange: (unresolved: boolean) => void;
}

interface DetailModeProps {
  mode: "detail";
  ticketPublicId: string;
  attachments: Attachment[];
  onChanged: () => void;
}

export type AttachmentSectionProps = CreateModeProps | DetailModeProps;

/*
 * The imperative seam Create Ticket needs for BR-23 compensation. The rows and
 * their upload state live in this component, so the release has to be driven
 * from here; what the page owns is the decision to trigger it.
 */
export interface AttachmentSectionHandle {
  /*
   * Releases every prepared Pending row. Resolves `true` only when the server
   * confirmed the deletion, which is also the moment the rows flip to a state
   * that offers Retry Upload.
   */
  releasePending: () => Promise<boolean>;
}

function toRowView(entry: UploadEntry): AttachmentRowView {
  const name = entry.attachment?.originalName ?? entry.file.name;

  return {
    key: entry.key,
    name,
    extension: entry.attachment?.extension ?? null,
    sizeBytes: entry.attachment?.sizeBytes ?? entry.file.size,
    uploadedAt: entry.attachment?.createdAt ?? null,
    state: entry.state,
    attachmentId: entry.attachment?.attachmentId ?? null,
    mimeType: entry.attachment?.mimeType ?? null,
    removalReason: null,
    message: entry.message,
  };
}

function attachmentToRowView(attachment: Attachment): AttachmentRowView {
  return {
    key: attachment.attachmentId,
    name: attachment.originalName,
    extension: attachment.extension,
    sizeBytes: attachment.sizeBytes,
    uploadedAt: attachment.createdAt,
    state: attachment.deleted ? "Removed" : "Active",
    attachmentId: attachment.attachmentId,
    mimeType: attachment.mimeType,
    removalReason: attachment.removalReason,
    message: null,
  };
}

function localKey(): string {
  return `local-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/*
 * The Attachment card shared by Create Ticket and Ticket Detail (ui-spec
 * Sections 21 to 26).
 *
 * One component, two modes, because the table, the `x/5` header, the preview,
 * and the accessible-name rules are identical on both screens; only where a file
 * goes differs. Create Ticket pre-uploads to `POST /api/attachments` and holds
 * Pending rows the Ticket-create call will bind. Ticket Detail uploads straight
 * to `POST /api/tickets/:publicId/attachments`, where the row is Active on
 * arrival.
 */
export function AttachmentSection(props: AttachmentSectionProps) {
  const callApi = useRequesterApi();
  const inputId = useId();
  const rulesId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  /*
   * What the open confirmation is about, which is not always what the
   * checkboxes hold: a row's own Remove control confirms that one row. Kept
   * apart from `selected` so cancelling the dialog gives the Requester their
   * checkbox selection back instead of the single row they clicked past it.
   */
  const [removalTargets, setRemovalTargets] = useState<string[]>([]);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [reasonErrors, setReasonErrors] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const rows = useMemo(() => {
    if (props.mode === "create") {
      return entries.map(toRowView);
    }

    const persistedIds = new Set(props.attachments.map((attachment) => attachment.attachmentId));
    const transientRows = entries
      .filter(
        (entry) =>
          entry.attachment === null || !persistedIds.has(entry.attachment.attachmentId),
      )
      .map(toRowView);

    return [...props.attachments.map(attachmentToRowView), ...transientRows];
  }, [props, entries]);

  /*
   * Removed rows never count (BR-47). On Create Ticket the same counter bounds
   * how many Pending rows may be prepared for the initial create.
   *
   * An Uploading row counts too, because it is a Pending row the server has
   * probably already created -- it just has not answered yet. Counting only the
   * settled ones lets a second selection made while the first batch is still in
   * flight compute its room from a stale zero, prepare more than five, and turn
   * Submit into a 400 the Requester has to unpick by hand.
   */
  const countedRows = rows.filter((row) =>
    props.mode === "create"
      ? row.state === "Pending" || row.state === "Uploading"
      : row.state === "Active",
  );
  const atLimit = countedRows.length >= MAX_ACTIVE_ATTACHMENTS;

  const pendingIds = entries
    .filter((entry) => entry.state === "Pending" && entry.attachment !== null)
    .map((entry) => entry.attachment?.attachmentId ?? "");
  const pendingIdKey = pendingIds.join(",");
  const unresolved = entries.some((entry) => entry.state !== "Pending");

  const onPendingIdsChange = props.mode === "create" ? props.onPendingIdsChange : null;
  const onUnresolvedChange = props.mode === "create" ? props.onUnresolvedChange : null;

  /*
   * The draft's `attachmentIds` and the submit gate live on the Create Ticket
   * page, because they are part of its payload and its validity -- not of this
   * card. They are pushed up whenever the derived value actually changes.
   */
  useEffect(() => {
    onPendingIdsChange?.(pendingIdKey === "" ? [] : pendingIdKey.split(","));
  }, [onPendingIdsChange, pendingIdKey]);

  useEffect(() => {
    onUnresolvedChange?.(unresolved);
  }, [onUnresolvedChange, unresolved]);

  function updateEntry(key: string, change: Partial<UploadEntry>): void {
    setEntries((current) =>
      current.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)),
    );
  }

  /* ui-spec Section 22.1: each valid file is pre-uploaded on its own. */
  async function preUpload(key: string, file: File): Promise<void> {
    const body = new FormData();
    body.append("file", file, file.name);

    try {
      const attachment = await callApi<Attachment>("/api/attachments", {
        method: "POST",
        body,
        timeoutMs: ATTACHMENT_TIMEOUT_MS,
      });
      updateEntry(key, { state: "Pending", attachment, message: null });
    } catch (error) {
      updateEntry(key, {
        state: "Failed",
        message: uploadFailureMessage(error, "create"),
        attachment: null,
      });
    }
  }

  async function uploadToTicket(key: string, file: File, ticketPublicId: string): Promise<void> {
    const body = new FormData();
    body.append("file", file, file.name);

    setUploading(true);
    setFailure(null);

    try {
      const attachment = await callApi<Attachment>(
        `/api/tickets/${encodeURIComponent(ticketPublicId)}/attachments`,
        { method: "POST", body, timeoutMs: ATTACHMENT_TIMEOUT_MS },
      );
      updateEntry(key, { state: "Active", attachment, message: null });

      if (props.mode === "detail") {
        props.onChanged();
      }
    } catch (error) {
      updateEntry(key, {
        state: "Failed",
        attachment: null,
        message: uploadFailureMessage(error, "detail"),
      });
    } finally {
      setUploading(false);
    }
  }

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>): void {
    const files = Array.from(event.target.files ?? []);

    /* Selecting the same file twice in a row must still fire a change event. */
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (props.mode === "detail") {
      const file = files[0];
      const invalid = validateSelectedFile(file);
      const entry: UploadEntry = {
        key: localKey(),
        file,
        state: invalid === null ? "Uploading" : "Invalid",
        message: invalid,
        attachment: null,
      };

      setFailure(null);
      setEntries((current) => [...current, entry]);

      if (invalid === null) {
        void uploadToTicket(entry.key, file, props.ticketPublicId);
      }
      return;
    }

    const room = MAX_ACTIVE_ATTACHMENTS - countedRows.length;
    const accepted = files.slice(0, room);

    if (accepted.length < files.length) {
      setFailure(`Only ${MAX_ACTIVE_ATTACHMENTS} attachments can be prepared for a new Ticket.`);
    } else {
      setFailure(null);
    }

    /*
     * An invalid file becomes its own Invalid row and nothing more: it must not
     * stop its valid siblings from uploading (ui-spec Section 23.3).
     */
    const created = accepted.map((file) => {
      const invalid = validateSelectedFile(file);

      return {
        key: localKey(),
        file,
        state: invalid === null ? ("Uploading" as const) : ("Invalid" as const),
        message: invalid,
        attachment: null,
      };
    });

    setEntries((current) => [...current, ...created]);

    for (const entry of created) {
      if (entry.state === "Uploading") {
        void preUpload(entry.key, entry.file);
      }
    }
  }

  /*
   * Retry is an add path like the file input, so it answers to the same bound.
   * Without the check a Failed row could be re-uploaded past 5/5 -- Failed rows
   * do not count, so a release or a handful of failures re-opens the input,
   * and retrying the old rows afterwards prepared more than the create accepts.
   * The control is hidden at the limit as well; this is the guard behind it.
   */
  function handleRetry(key: string): void {
    const entry = entries.find((candidate) => candidate.key === key);

    if (entry === undefined || atLimit) {
      return;
    }

    updateEntry(key, { state: "Uploading", message: null });

    if (props.mode === "detail") {
      void uploadToTicket(key, entry.file, props.ticketPublicId);
    } else {
      void preUpload(key, entry.file);
    }
  }

  /*
   * Removing a prepared file drops it from the intended set. The Pending row is
   * also hard-deleted best-effort: the 24-hour orphan sweep would take it
   * eventually, but a row the user explicitly removed should not sit in the
   * database until then. The row leaves the table either way -- a failed cleanup
   * is not the user's problem, and the sweep is the backstop.
   */
  function handleRemovePending(key: string): void {
    const entry = entries.find((candidate) => candidate.key === key);
    const attachmentId = entry?.attachment?.attachmentId ?? null;

    setEntries((current) => current.filter((candidate) => candidate.key !== key));

    if (attachmentId !== null) {
      void releasePendingAttachments(callApi, [attachmentId]);
    }
  }

  /*
   * BR-23 compensation, driven by Create Ticket after an ambiguous `5xx`.
   *
   * A confirmed release is also an answer about the Ticket: the rows were still
   * Pending, so the create transaction had not bound them, and a create that
   * commits later finds them gone and rolls itself back rather than binding
   * around the gap. The rows therefore become re-uploadable rather than
   * disappearing, which is what Retry Upload is for.
   *
   * An unconfirmed release changes nothing at all -- the rows may well be Active
   * on a Ticket that did commit, and the recovery path is what recovers them.
   */
  async function releasePending(): Promise<boolean> {
    const prepared = entries.filter(
      (entry) => entry.state === "Pending" && entry.attachment !== null,
    );

    if (prepared.length === 0) {
      return false;
    }

    const released = await releasePendingAttachments(
      callApi,
      prepared.map((entry) => entry.attachment?.attachmentId ?? ""),
    );

    if (!released) {
      return false;
    }

    const releasedKeys = new Set(prepared.map((entry) => entry.key));

    setEntries((current) =>
      current.map((entry) =>
        releasedKeys.has(entry.key)
          ? {
              ...entry,
              state: "Failed" as const,
              attachment: null,
              message: "This prepared file was released. Retry Upload to attach it again.",
            }
          : entry,
      ),
    );

    return true;
  }

  /*
   * Published as a plain ref prop rather than through `forwardRef`: the page
   * needs one method, not a DOM handle, and `ref` itself stays free for whatever
   * the element tree wants.
   *
   * Written in an effect with no dependency array rather than during render, so
   * it runs after every COMMITTED render and the closure the page calls always
   * sees the current rows. Assigning during render would also publish a handle
   * from a render React went on to discard.
   */
  const handleRef = props.mode === "create" ? props.handleRef : undefined;

  useEffect(() => {
    if (handleRef === undefined) {
      return;
    }

    handleRef.current = { releasePending };

    return () => {
      handleRef.current = null;
    };
  });

  function toggleSelected(attachmentId: string): void {
    setSelected((current) =>
      current.includes(attachmentId)
        ? current.filter((value) => value !== attachmentId)
        : [...current, attachmentId],
    );
  }

  function openRemoval(attachmentIds: string[]): void {
    setRemovalTargets(attachmentIds);
    setReasons(Object.fromEntries(attachmentIds.map((id) => [id, ""])));
    setReasonErrors({});
    setFailure(null);
    setConfirmRemoval(true);
  }

  /* ui-spec Section 25.2: one required, trimmed, 3-200 character reason each. */
  async function submitRemoval(): Promise<void> {
    const errors: Record<string, string> = {};

    for (const attachmentId of removalTargets) {
      const message = removalReasonError((reasons[attachmentId] ?? "").trim());

      if (message !== null) {
        errors[attachmentId] = message;
      }
    }

    setReasonErrors(errors);

    if (Object.keys(errors).length > 0) {
      /*
       * The first invalid reason takes focus, the way the Create Ticket form
       * focuses its first invalid field (ui-spec Section 8.2). Without it a
       * multi-row removal leaves the keyboard on Remove with the message it
       * has to act on somewhere above, off screen on a long dialog.
       */
      const first = removalTargets.find((attachmentId) => errors[attachmentId] !== undefined);

      if (first !== undefined) {
        document.getElementById(removalReasonFieldId(first))?.focus();
      }

      return;
    }

    setRemoving(true);
    setFailure(null);

    try {
      await callApi("/api/attachments/collection", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: removalTargets.map((attachmentId) => ({
            attachmentId,
            reason: (reasons[attachmentId] ?? "").trim(),
          })),
        }),
      });

      setConfirmRemoval(false);
      /* Only the rows this batch removed leave the selection. */
      setSelected((current) => current.filter((id) => !removalTargets.includes(id)));
      setRemovalTargets([]);
      setReasons({});

      if (props.mode === "detail") {
        props.onChanged();
      }
    } catch {
      /*
       * The batch is all-or-nothing on the backend, so nothing here may be
       * redrawn as Removed. The previous state stands and the user can correct
       * the reasons or try again (ui-spec Section 25.3).
       */
      setFailure("The attachments could not be removed. Nothing was changed.");
    } finally {
      setRemoving(false);
    }
  }

  /* The rows the confirmation is about, in the order the targets were named. */
  const removalRows = rows.filter(
    (row) => row.attachmentId !== null && removalTargets.includes(row.attachmentId),
  );

  return (
    <>
      <Card title={`Attachments ${countedRows.length}/${MAX_ACTIVE_ATTACHMENTS}`}>
        {/*
          A real file input, not a button that hides one. The native control is
          already "opens the file picker", it is keyboard reachable with a
          visible focus ring, and its label names it -- where a visually-hidden
          input behind a styled label would put focus somewhere invisible.

          `disabled` rather than `aria-disabled`: at 5/5 there is no tooltip to
          keep reachable, so nothing is lost by taking it out of the tab order,
          and ui-spec Section 21.1 adds no explanatory paragraph beside it.
        */}
        <div className="mb-3">
          <label htmlFor={inputId} className="form-label">
            Add Attachment
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="form-control"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            multiple={props.mode === "create"}
            disabled={atLimit || uploading}
            aria-describedby={rulesId}
            onChange={handleFilesSelected}
          />
          <p id={rulesId} className="form-text">
            {ATTACHMENT_RULES_TEXT}
          </p>
        </div>

        {/*
          While the removal dialog is open it renders this itself: an alert on the
          card behind the backdrop is in the DOM but not on the screen, and
          ui-spec Section 25.3 requires the failure to be visible where the user
          can act on it.
        */}
        {failure === null || confirmRemoval ? null : (
          <p role="alert" className="tt-invalid-text">
            {failure}
          </p>
        )}

        {props.mode === "detail" && selected.length > 0 ? (
          <div className="d-flex align-items-center justify-content-between gap-3 mb-3">
            <span role="status">{selected.length} selected</span>
            <Button variant="destructive" onClick={() => openRemoval(selected)}>
              Remove Selected
            </Button>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-secondary mb-0">No attachments.</p>
        ) : (
          <table className="table tt-table tt-table--attachments align-middle mb-0">
            <thead>
              <tr>
                {props.mode === "detail" ? <th scope="col">Select</th> : null}
                <th scope="col">File Name</th>
                <th scope="col" className={SECONDARY_COLUMN}>
                  Type
                </th>
                <th scope="col" className={SECONDARY_COLUMN}>
                  Size
                </th>
                <th scope="col" className={SECONDARY_COLUMN}>
                  Uploaded At
                </th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <AttachmentTableRow
                  key={row.key}
                  row={row}
                  mode={props.mode}
                  selected={row.attachmentId !== null && selected.includes(row.attachmentId)}
                  atLimit={atLimit}
                  onToggleSelected={toggleSelected}
                  onPreview={setPreview}
                  onRetry={handleRetry}
                  onRemoveLocal={handleRemovePending}
                  onRemoveActive={(attachmentId) => openRemoval([attachmentId])}
                />
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AttachmentPreviewModal target={preview} onClose={() => setPreview(null)} />

      <Modal
        open={confirmRemoval}
        title={`Remove ${removalRows.length} ${removalRows.length === 1 ? "Attachment" : "Attachments"}`}
        onClose={() => setConfirmRemoval(false)}
        footer={
          <>
            <Button onClick={() => setConfirmRemoval(false)}>Cancel</Button>
            <Button variant="destructive" busy={removing} onClick={() => void submitRemoval()}>
              Remove
            </Button>
          </>
        }
      >
        {failure === null ? null : (
          <p role="alert" className="tt-invalid-text">
            {failure}
          </p>
        )}

        {removalRows.map((row) => (
          <RemovalReasonField
            key={row.key}
            name={row.name}
            attachmentId={row.attachmentId ?? ""}
            value={reasons[row.attachmentId ?? ""] ?? ""}
            error={reasonErrors[row.attachmentId ?? ""]}
            onChange={(value) =>
              setReasons((current) => ({ ...current, [row.attachmentId ?? ""]: value }))
            }
          />
        ))}
      </Modal>
    </>
  );
}

/* Shared with the first-invalid focus in `submitRemoval`. */
function removalReasonFieldId(attachmentId: string): string {
  return `removal-reason-${attachmentId}`;
}

function RemovalReasonField({
  name,
  attachmentId,
  value,
  error,
  onChange,
}: {
  name: string;
  attachmentId: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const fieldId = removalReasonFieldId(attachmentId);
  const errorId = `${fieldId}-error`;

  return (
    <div className="mb-3">
      <label htmlFor={fieldId} className="form-label">
        {name} — Reason <span aria-hidden="true">*</span>
      </label>
      <input
        id={fieldId}
        name={fieldId}
        type="text"
        autoComplete="off"
        className={`form-control${error === undefined ? "" : " is-invalid"}`}
        value={value}
        required
        aria-describedby={error === undefined ? undefined : errorId}
        aria-invalid={error === undefined ? undefined : true}
        onChange={(event) => onChange(event.target.value)}
      />
      {error === undefined ? null : (
        <p id={errorId} className="tt-invalid-text mb-0">
          {error}
        </p>
      )}
    </div>
  );
}

interface AttachmentTableRowProps {
  row: AttachmentRowView;
  mode: "create" | "detail";
  selected: boolean;
  /* Retry adds a counted row, so it disappears at 5/5 like the file input. */
  atLimit: boolean;
  onToggleSelected: (attachmentId: string) => void;
  onPreview: (target: PreviewTarget) => void;
  onRetry: (key: string) => void;
  onRemoveLocal: (key: string) => void;
  onRemoveActive: (attachmentId: string) => void;
}

function AttachmentTableRow({
  row,
  mode,
  selected,
  atLimit,
  onToggleSelected,
  onPreview,
  onRetry,
  onRemoveLocal,
  onRemoveActive,
}: AttachmentTableRowProps) {
  /* Only Active rows may be selected for removal (ui-spec Section 25.1). */
  const selectable = mode === "detail" && row.state === "Active" && row.attachmentId !== null;
  /* Preview and Download belong to the states that have usable bytes. */
  const hasBinary = (row.state === "Pending" || row.state === "Active") && row.attachmentId !== null;

  return (
    <tr className={row.state === "Removed" ? "text-secondary" : undefined}>
      {mode === "detail" ? (
        <td>
          {selectable ? (
            <input
              type="checkbox"
              className="form-check-input"
              checked={selected}
              aria-label={`Select ${row.name}`}
              onChange={() => onToggleSelected(row.attachmentId ?? "")}
            />
          ) : null}
        </td>
      ) : null}

      <td>
        {row.name}
        {/*
          Section 26 shows the removal reason as secondary metadata rather than
          as a permanently wide column of its own.
        */}
        {row.state === "Removed" && row.removalReason !== null ? (
          <div className="small text-secondary">Removal reason: {row.removalReason}</div>
        ) : null}
        {row.message === null ? null : (
          <div className="small tt-invalid-text">{row.message}</div>
        )}
      </td>
      <td className={SECONDARY_COLUMN}>{(row.extension ?? "").toUpperCase()}</td>
      <td className={SECONDARY_COLUMN}>{formatSize(row.sizeBytes)}</td>
      <td className={SECONDARY_COLUMN}>
        {row.uploadedAt === null ? "—" : ticketDateTime(row.uploadedAt)}
      </td>
      <td>
        {/* The state name is the visible text, so it never reads by colour alone. */}
        <AttachmentState state={row.state} />
      </td>
      <td>
        {/*
          Every action in this cell is an icon control of one size, so the group
          fits the width the column reserves for it and stays on a single line
          at every viewport (ui-spec Sections 21.3 and 30.5). Retry is the one
          text control, and it appears only on a Failed row, where the preview
          and download actions are absent.
        */}
        <div className="tt-row-actions">
          {hasBinary ? (
            <IconButton
              label={`Preview ${row.name}`}
              onClick={() =>
                onPreview({
                  attachmentId: row.attachmentId ?? "",
                  originalName: row.name,
                  mimeType: row.mimeType ?? "application/octet-stream",
                })
              }
            >
              {/*
                An SVG rather than 👁: the emoji renders in colour presentation
                on most platforms, which put a brown pictogram in a row of
                monochrome controls, and its shape depends on the platform's
                emoji font.
              */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <circle cx="8" cy="8" r="1.75" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </IconButton>
          ) : null}

          {hasBinary ? (
            <AttachmentDownloadButton
              attachmentId={row.attachmentId ?? ""}
              originalName={row.name}
              variant="icon"
            />
          ) : null}

          {row.state === "Failed" && !atLimit ? (
            <Button variant="tertiary" onClick={() => onRetry(row.key)}>
              Retry
            </Button>
          ) : null}

          {(mode === "create" && row.state !== "Uploading") ||
          row.state === "Failed" || row.state === "Invalid" ? (
            <IconButton label={`Remove ${row.name}`} onClick={() => onRemoveLocal(row.key)}>
              <span aria-hidden="true">✕</span>
            </IconButton>
          ) : null}

          {selectable ? (
            <IconButton
              label={`Remove ${row.name}`}
              onClick={() => onRemoveActive(row.attachmentId ?? "")}
            >
              <span aria-hidden="true">✕</span>
            </IconButton>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function uploadFailureMessage(error: unknown, mode: "create" | "detail"): string {
  if (error instanceof ApiResponseError) {
    if (error.status === 413) {
      return `The file is larger than the ${formatSize(MAX_ATTACHMENT_BYTES)} limit.`;
    }

    if (error.status === 415) {
      return "Unsupported file type. Use JPG, JPEG, PNG, WEBP, or PDF.";
    }

    if (error.status === 409 && mode === "detail") {
      return `A Ticket can hold at most ${MAX_ACTIVE_ATTACHMENTS} active attachments.`;
    }
  }

  return "The upload did not complete.";
}
