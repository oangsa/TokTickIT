import { ApiRequestInit } from "../api.js";

type CallApi = <T>(path: string, init?: ApiRequestInit) => Promise<T>;

/*
 * Best-effort release of prepared Pending Attachments through the unified
 * collection endpoint (api-spec Section 13, ui-spec Section 12.4).
 *
 * Every item carries an EMPTY reason, and that is the safety mechanism rather
 * than a shortcut. The backend ignores the reason for a Pending row and requires
 * a trimmed 3-200 character one for an Active row, so a row that a Ticket-create
 * already bound cannot be soft-removed by this call: the batch fails validation
 * instead, and because it is all-or-nothing, nothing at all is removed. The
 * client therefore never has to guess a lifecycle state, and never invents an
 * Active-removal reason to fit one.
 *
 * Returns whether the server CONFIRMED the release. `true` means every listed
 * row was still Pending and is now gone; anything else -- a bound row, a missing
 * row, a transport failure -- means nothing was removed and the caller must
 * assume the rows still stand.
 */
export async function releasePendingAttachments(
  callApi: CallApi,
  attachmentIds: string[],
): Promise<boolean> {
  if (attachmentIds.length === 0) {
    return false;
  }

  try {
    await callApi("/api/attachments/collection", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: attachmentIds.map((attachmentId) => ({ attachmentId, reason: "" })),
      }),
    });

    return true;
  } catch {
    /* Best effort: a forgotten row is already covered by the 24-hour sweep. */
    return false;
  }
}
