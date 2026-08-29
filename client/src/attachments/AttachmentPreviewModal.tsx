import { useEffect, useState } from "react";

import { Button } from "../components/Button.js";
import { IconButton } from "../components/IconButton.js";
import { Modal } from "../components/Modal.js";
import { useRequesterBlob } from "../requester/useRequesterApi.js";
import { ATTACHMENT_TIMEOUT_MS } from "./attachmentRules.js";

export interface PreviewTarget {
  attachmentId: string;
  originalName: string;
  mimeType: string;
}

interface AttachmentPreviewModalProps {
  target: PreviewTarget | null;
  onClose: () => void;
}

/*
 * Attachment preview (ui-spec Section 24).
 *
 * The binary is fetched through the API client rather than pointed at: an
 * `<img src>` or an `<iframe src>` cannot carry `X-Requester-Id`, so a
 * requester-scoped URL used directly would answer 400 and the picture would
 * simply not appear. The bytes arrive as a Blob and are rendered from a
 * temporary object URL instead.
 *
 * Every object URL this component creates is revoked: when the modal closes,
 * when the target is replaced, and when the component unmounts. An unrevoked
 * one pins the whole file in memory for the life of the document.
 *
 * `Modal` already owns the focus trap, Escape, and focus return.
 */
export function AttachmentPreviewModal({ target, onClose }: AttachmentPreviewModalProps) {
  const fetchBlob = useRequesterBlob();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (target === null) {
      return;
    }

    let url: string | null = null;
    let ignore = false;

    setFailed(false);

    void fetchBlob(`/api/attachments/${encodeURIComponent(target.attachmentId)}/preview`, {
      timeoutMs: ATTACHMENT_TIMEOUT_MS,
    })
      .then((blob) => {
        if (ignore) {
          return;
        }

        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!ignore) {
          setFailed(true);
        }
      });

    return () => {
      ignore = true;
      setObjectUrl(null);

      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    };
  }, [target, fetchBlob]);

  if (target === null) {
    return null;
  }

  const isPdf = target.mimeType === "application/pdf";

  return (
    <Modal open title={target.originalName} onClose={onClose} size="lg">
      {/*
        The frame is reserved before the bytes arrive. An image has no known
        dimensions until it decodes -- there is nothing honest to put in
        `width`/`height` on a blob -- so the box holds the height instead, and
        the dialog does not jump from a one-line "Loading preview…" to a
        full-size picture under the reader's pointer.
      */}
      <div className="tt-attachment-preview">
        {failed ? (
          <p role="alert" className="tt-invalid-text mb-0">
            This attachment could not be opened.
          </p>
        ) : objectUrl === null ? (
          <p role="status" className="text-secondary mb-0">
            Loading preview…
          </p>
        ) : isPdf ? (
          <iframe
            src={objectUrl}
            title={`Preview of ${target.originalName}`}
            className="tt-attachment-preview__frame"
          />
        ) : (
          /* Fits the modal and keeps its aspect ratio (ui-spec Section 24). */
          <img
            src={objectUrl}
            alt={`Preview of ${target.originalName}`}
            className="img-fluid d-block mx-auto"
          />
        )}
      </div>

      <div className="d-flex justify-content-end mt-3">
        <AttachmentDownloadButton
          attachmentId={target.attachmentId}
          originalName={target.originalName}
        />
      </div>
    </Modal>
  );
}

/*
 * Download shares the preview's rule: fetch with the requester header, check the
 * response before reading the body, and use the already-known
 * `AttachmentDTO.originalName` as the filename rather than parsing
 * `Content-Disposition`. The object URL is revoked as soon as the download has
 * been initiated.
 */
export function AttachmentDownloadButton({
  attachmentId,
  originalName,
  variant = "secondary",
}: {
  attachmentId: string;
  originalName: string;
  /*
   * `icon` is the table-row presentation: the same action as a control sized to
   * a row, naming the file it downloads. ui-spec Section 29.8 allows an
   * icon-only Attachment download provided it carries both an accessible name
   * and a hover/focus label, which `IconButton` supplies.
   */
  variant?: "secondary" | "tertiary" | "icon";
}) {
  const fetchBlob = useRequesterBlob();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /*
   * The failure has to be caught here, the way the preview catches its own. A
   * download can fail for reasons the row does not show -- the Attachment was
   * removed from another tab and now answers `410`, or the request never left
   * the browser -- and without this the promise rejects unhandled and the only
   * thing the Requester sees is the spinner stopping.
   */
  async function download(): Promise<void> {
    setBusy(true);
    setFailed(false);

    try {
      const blob = await fetchBlob(`/api/attachments/${encodeURIComponent(attachmentId)}/download`, {
        timeoutMs: ATTACHMENT_TIMEOUT_MS,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = originalName;
      document.body.append(link);
      link.click();
      link.remove();
      /*
       * Revoked on the next task, not on this one. Chrome takes its reference
       * inside `click()`, but Firefox and Safari resolve the href after the
       * handler returns, and revoking synchronously cancels the download there
       * with no error of any kind for this component to catch.
       */
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === "icon" ? (
        <IconButton
          label={`Download ${originalName}`}
          disabled={busy}
          onClick={() => void download()}
        >
          <span aria-hidden="true">⤓</span>
        </IconButton>
      ) : (
        <Button variant={variant} busy={busy} onClick={() => void download()}>
          Download
        </Button>
      )}
      {failed ? (
        <p role="alert" className="tt-invalid-text mb-0">
          {originalName} could not be downloaded.
        </p>
      ) : null}
    </>
  );
}
