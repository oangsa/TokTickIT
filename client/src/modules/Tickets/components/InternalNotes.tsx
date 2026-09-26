import { useCallback, useEffect, useState } from "react";
import { ApiResponseError, readPaginationHeader, type PaginationMetadata } from "../../../api.js";
import { useAuth } from "../../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../../auth/useAuthenticatedApi.js";
import { Button } from "../../../components/Common/Button.js";
import { Chip } from "../../../components/Common/Chip.js";
import { ticketDateTime } from "../ticketDate.js";
import { statusLabel } from "../staffTickets.js";

export interface InternalNoteAuthorDTO {
  publicId: string;
  name: string;
  role: string;
}

export interface InternalNoteDTO {
  publicId: string;
  content: string;
  author: InternalNoteAuthorDTO;
  createdAt: string;
}

interface InternalNotesProps {
  ticketPublicId: string;
  ticketOwnerPublicId?: string | null;
  onNoteAdded?: () => void;
}

export function InternalNotes({
  ticketPublicId,
  ticketOwnerPublicId,
  onNoteAdded,
}: InternalNotesProps) {
  const { user } = useAuth();
  const callApi = useAuthenticatedApi();

  const [notes, setNotes] = useState<InternalNoteDTO[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isStaff = user?.role === "IT_STAFF";
  const isAdminOwner =
    user?.role === "ADMINISTRATOR" &&
    Boolean(ticketOwnerPublicId && user.publicId.toLowerCase() === ticketOwnerPublicId.toLowerCase());
  const canCreate = isStaff || isAdminOwner;

  const loadNotes = useCallback(
    async (pageToLoad: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        let paginationMeta: PaginationMetadata | null = null;
        const res = await callApi<
          | InternalNoteDTO[]
          | {
              items: InternalNoteDTO[];
              pagination: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
            }
        >(`/api/tickets/${ticketPublicId}/internal-notes?pageNumber=${pageToLoad}&pageSize=10`, {
          onResponse: (response) => {
            paginationMeta = readPaginationHeader(response.headers.get("X-Pagination"));
          },
        });

        const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        setNotes((prev) => {
          if (!append) return items;
          const existingIds = new Set(prev.map((note) => note.publicId));
          return [...prev, ...items.filter((note) => !existingIds.has(note.publicId))];
        });
        const pagination = paginationMeta ?? (Array.isArray(res) ? null : res?.pagination);
        setPage(pagination?.pageNumber ?? pageToLoad);
        setTotalPages(pagination?.totalPages ?? 1);
      } catch (err) {
        if (err instanceof ApiResponseError) {
          setError(err.message || "Failed to load internal notes.");
        } else {
          setError("Failed to load internal notes.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [callApi, ticketPublicId],
  );

  useEffect(() => {
    void loadNotes(1, false);
  }, [loadNotes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    const len = [...trimmed].length;
    if (len < 1 || len > 4000) {
      setFormError("Note must be between 1 and 4000 characters.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      const created = await callApi<InternalNoteDTO>(
        `/api/tickets/${ticketPublicId}/internal-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        },
      );

      setNotes((prev) => [created, ...prev]);
      setContent("");
      onNoteAdded?.();
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setFormError(err.message || "Failed to save internal note.");
      } else {
        setFormError("Failed to save internal note.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = [...content.trim()].length;

  return (
    <div className="tt-internal-notes" data-testid="internal-notes">
      {/* Privacy Warning Banner */}
      <div className="alert alert-warning mb-4" role="alert">
        <div className="fw-bold mb-1">Internal Note</div>
        <div>
          Visible only to IT Staff and Administrators. Do not place information here that should be
          sent to the Requester.
        </div>
      </div>

      {/* Composer or Read-Only Notice */}
      {canCreate ? (
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="mb-2">
            <label htmlFor="tt-internal-note-input" className="form-label fw-medium">
              Add an internal note
            </label>
            <textarea
              id="tt-internal-note-input"
              className={`form-control${formError ? " is-invalid" : ""}`}
              rows={3}
              placeholder="Write an internal note…"
              value={content}
              disabled={submitting}
              onChange={(e) => {
                setContent(e.target.value);
                if (formError) setFormError(null);
              }}
            />
            {formError ? <div className="invalid-feedback" role="alert">{formError}</div> : null}
          </div>
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-secondary">{charCount} / 4000</small>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || charCount < 1 || charCount > 4000}
              busy={submitting}
            >
              Add Note
            </Button>
          </div>
        </form>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <p role="status" className="text-secondary">
          Loading internal notes…
        </p>
      ) : null}

      {/* Error state */}
      {error ? (
        <div className="alert alert-danger" role="alert">
          <p className="mb-2">{error}</p>
          <Button variant="secondary" onClick={() => void loadNotes(1, false)}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && !error && notes.length === 0 ? (
        <p className="text-secondary" data-testid="empty-notes">
          No internal notes yet.
        </p>
      ) : null}

      {/* Notes list */}
      {!loading && notes.length > 0 ? (
        <div className="d-flex flex-column gap-3">
          {notes.map((note) => (
            <div
              key={note.publicId}
              className="border rounded p-3 bg-light border-warning-subtle"
              role="article"
              data-testid={`note-${note.publicId}`}
            >
              <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                <span className="fw-bold">{note.author.name}</span>
                <Chip variant="secondary">{statusLabel(note.author.role)}</Chip>
                <small className="text-secondary">{ticketDateTime(note.createdAt)}</small>
              </div>
              <p className="mb-0 text-break" style={{ whiteSpace: "pre-wrap" }}>
                {note.content}
              </p>
            </div>
          ))}

          {/* Load More Notes button */}
          {page < totalPages ? (
            <div className="d-flex justify-content-center mt-2">
              <Button
                variant="secondary"
                disabled={loadingMore}
                busy={loadingMore}
                onClick={() => void loadNotes(page + 1, true)}
              >
                Load more notes
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
