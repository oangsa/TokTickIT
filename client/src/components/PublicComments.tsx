import { useCallback, useEffect, useState } from "react";
import { ApiResponseError, readPaginationHeader, type PaginationMetadata } from "../api.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { Badge } from "./Badge.js";
import { Button } from "./Button.js";
import { ticketDateTime } from "../tickets/ticketDate.js";
import { statusLabel } from "../tickets/staffTickets.js";

export interface PublicCommentAuthorDTO {
  publicId: string;
  name: string;
  role: string;
}

export interface PublicCommentReplyTargetDTO {
  commentPublicId: string;
  userPublicId: string;
  name: string;
}

export interface PublicCommentDTO {
  publicId: string;
  content: string;
  author: PublicCommentAuthorDTO;
  parentCommentPublicId: string | null;
  replyTo: PublicCommentReplyTargetDTO | null;
  depth: 0 | 1 | 2;
  createdAt: string;
}

export interface RootPublicCommentDTO extends PublicCommentDTO {
  depth: 0;
  replyCount: number;
  replies: PublicCommentDTO[];
}

interface PublicCommentsProps {
  ticketPublicId: string;
  onCommentAdded?: () => void;
}

export function PublicComments({ ticketPublicId, onCommentAdded }: PublicCommentsProps) {
  const callApi = useAuthenticatedApi();

  const [roots, setRoots] = useState<RootPublicCommentDTO[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Root composer state
  const [rootContent, setRootContent] = useState("");
  const [rootSubmitting, setRootSubmitting] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);

  // Active reply state
  const [activeReply, setActiveReply] = useState<{
    targetPublicId: string;
    targetAuthorName: string;
    rootPublicId: string;
  } | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Expanded replies storage per root comment
  const [expandedThreads, setExpandedThreads] = useState<
    Record<
      string,
      {
        items: PublicCommentDTO[];
        loading: boolean;
        page: number;
        totalPages: number;
        error?: string | null;
        failedPage?: number;
      }
    >
  >({});

  const loadRoots = useCallback(
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
          | RootPublicCommentDTO[]
          | {
              items: RootPublicCommentDTO[];
              pagination: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
            }
        >(`/api/tickets/${ticketPublicId}/comments?pageNumber=${pageToLoad}&pageSize=10`, {
          onResponse: (response) => {
            paginationMeta = readPaginationHeader(response.headers.get("X-Pagination"));
          },
        });

        const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
        setRoots((prev) => (append ? [...prev, ...items] : items));
        const pagination = paginationMeta ?? (Array.isArray(res) ? null : res?.pagination);
        setPage(pagination?.pageNumber ?? pageToLoad);
        setTotalPages(pagination?.totalPages ?? 1);
      } catch (err) {
        if (err instanceof ApiResponseError) {
          setError(err.message || "Failed to load comments.");
        } else {
          setError("Failed to load comments.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [callApi, ticketPublicId],
  );

  useEffect(() => {
    void loadRoots(1, false);
  }, [loadRoots]);

  const handleCreateRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = rootContent.trim();
    const len = [...trimmed].length;
    if (len < 1 || len > 2000) {
      setRootError("Comment must be between 1 and 2000 characters.");
      return;
    }

    setRootSubmitting(true);
    setRootError(null);

    try {
      const created = await callApi<PublicCommentDTO>(`/api/tickets/${ticketPublicId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });

      const newRoot: RootPublicCommentDTO = {
        ...created,
        depth: 0,
        replyCount: 0,
        replies: [],
      };

      setRoots((prev) => [newRoot, ...prev]);
      setRootContent("");
      onCommentAdded?.();
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setRootError(err.message || "Failed to post comment.");
      } else {
        setRootError("Failed to post comment.");
      }
    } finally {
      setRootSubmitting(false);
    }
  };

  const handleExpandReplies = async (rootPublicId: string, pageToLoad = 1) => {
    setExpandedThreads((prev) => ({
      ...prev,
      [rootPublicId]: {
        items: prev[rootPublicId]?.items ?? [],
        loading: true,
        page: prev[rootPublicId]?.page ?? 1,
        totalPages: prev[rootPublicId]?.totalPages ?? 1,
        error: null,
      },
    }));

    try {
      let paginationMeta: PaginationMetadata | null = null;
      const res = await callApi<
        | PublicCommentDTO[]
        | {
            items: PublicCommentDTO[];
            pagination: { pageNumber: number; pageSize: number; totalPages: number; totalItems: number };
          }
      >(`/api/tickets/${ticketPublicId}/comments/${rootPublicId}/replies?pageNumber=${pageToLoad}&pageSize=5`, {
        onResponse: (response) => {
          paginationMeta = readPaginationHeader(response.headers.get("X-Pagination"));
        },
      });

      const items = Array.isArray(res) ? res : Array.isArray(res?.items) ? res.items : [];
      const pagination = paginationMeta ?? (Array.isArray(res) ? null : res?.pagination);
      setExpandedThreads((prev) => {
        const prevItems = pageToLoad === 1 ? [] : (prev[rootPublicId]?.items ?? []);
        const existingIds = new Set(prevItems.map((i) => i.publicId));
        const combined = [...prevItems];
        for (const item of items) {
          if (!existingIds.has(item.publicId)) {
            existingIds.add(item.publicId);
            combined.push(item);
          }
        }
        return {
          ...prev,
          [rootPublicId]: {
            items: combined,
            loading: false,
            page: pagination?.pageNumber ?? pageToLoad,
            totalPages: pagination?.totalPages ?? 1,
            error: null,
          },
        };
      });
    } catch {
      setExpandedThreads((prev) => ({
        ...prev,
        [rootPublicId]: {
          items: prev[rootPublicId]?.items ?? [],
          loading: false,
          page: prev[rootPublicId]?.page ?? 1,
          totalPages: prev[rootPublicId]?.totalPages ?? 1,
          error: "Failed to load replies.",
          failedPage: pageToLoad,
        },
      }));
    }
  };

  const handleCreateReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReply) return;

    const trimmed = replyContent.trim();
    const len = [...trimmed].length;
    if (len < 1 || len > 2000) {
      setReplyError("Reply must be between 1 and 2000 characters.");
      return;
    }

    setReplySubmitting(true);
    setReplyError(null);

    try {
      const created = await callApi<PublicCommentDTO>(
        `/api/tickets/${ticketPublicId}/comments/${activeReply.targetPublicId}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: trimmed }),
        },
      );

      // Append reply to root's replies or expanded thread
      const rootId = activeReply.rootPublicId;
      setRoots((prev) =>
        prev.map((r) => {
          if (r.publicId === rootId) {
            return {
              ...r,
              replyCount: r.replyCount + 1,
              replies: [...r.replies, created],
            };
          }
          return r;
        }),
      );

      if (expandedThreads[rootId]) {
        setExpandedThreads((prev) => ({
          ...prev,
          [rootId]: {
            ...prev[rootId],
            items: [...prev[rootId].items, created],
          },
        }));
      }

      setReplyContent("");
      setActiveReply(null);
      onCommentAdded?.();
    } catch (err) {
      if (err instanceof ApiResponseError) {
        setReplyError(err.message || "Failed to post reply.");
      } else {
        setReplyError("Failed to post reply.");
      }
    } finally {
      setReplySubmitting(false);
    }
  };

  const rootCharCount = [...rootContent.trim()].length;
  const replyCharCount = [...replyContent.trim()].length;

  return (
    <div className="tt-public-comments" data-testid="public-comments">
      {/* Root comment composer */}
      <form onSubmit={handleCreateRoot} className="mb-4">
        <div className="mb-2">
          <label htmlFor="tt-root-comment-input" className="form-label fw-medium">
            Add a comment
          </label>
          <textarea
            id="tt-root-comment-input"
            className={`form-control${rootError ? " is-invalid" : ""}`}
            rows={3}
            placeholder="Write a comment…"
            value={rootContent}
            disabled={rootSubmitting}
            onChange={(e) => {
              setRootContent(e.target.value);
              if (rootError) setRootError(null);
            }}
          />
          {rootError ? <div className="invalid-feedback" role="alert">{rootError}</div> : null}
        </div>
        <div className="d-flex justify-content-between align-items-center">
          <small className="text-secondary">{rootCharCount} / 2000</small>
          <Button
            type="submit"
            variant="primary"
            disabled={rootSubmitting || rootCharCount < 1 || rootCharCount > 2000}
            busy={rootSubmitting}
          >
            Post Comment
          </Button>
        </div>
      </form>

      {/* Loading state */}
      {loading ? (
        <p role="status" className="text-secondary">
          Loading comments…
        </p>
      ) : null}

      {/* Error state */}
      {error ? (
        <div className="alert alert-danger" role="alert">
          <p className="mb-2">{error}</p>
          <Button variant="secondary" onClick={() => void loadRoots(1, false)}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && !error && roots.length === 0 ? (
        <p className="text-secondary" data-testid="empty-comments">
          No comments yet.
        </p>
      ) : null}

      {/* Comment List */}
      {!loading && roots.length > 0 ? (
        <div className="d-flex flex-column gap-3">
          {roots.map((root) => {
            const isReplyingToRoot = activeReply?.targetPublicId === root.publicId;
            const expanded = expandedThreads[root.publicId];
            const displayedReplies = expanded
              ? expanded.items
              : (root.replies ?? (root as unknown as { previews?: PublicCommentDTO[] }).previews ?? []);
            const remainingReplies = Math.max(0, root.replyCount - displayedReplies.length);

            return (
              <div
                key={root.publicId}
                className="border rounded p-3 bg-light"
                role="article"
                data-testid={`comment-${root.publicId}`}
              >
                {/* Root Comment Header */}
                <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
                  <span className="fw-bold">{root.author?.name}</span>
                  {root.author?.role ? <Badge>{statusLabel(root.author.role)}</Badge> : null}
                  <small className="text-secondary">{ticketDateTime(root.createdAt)}</small>
                </div>

                {/* Root Comment Content */}
                <p className="mb-2 text-break" style={{ whiteSpace: "pre-wrap" }}>
                  {root.content}
                </p>

                {/* Root Comment Actions */}
                <div className="mb-2">
                  <Button
                    variant="tertiary"
                    className="p-0 text-decoration-none btn-sm"
                    onClick={() => {
                      setActiveReply({
                        targetPublicId: root.publicId,
                        targetAuthorName: root.author?.name ?? "User",
                        rootPublicId: root.publicId,
                      });
                      setReplyContent("");
                      setReplyError(null);
                    }}
                  >
                    Reply
                  </Button>
                </div>

                {/* Inline Reply Composer for Root */}
                {isReplyingToRoot ? (
                  <form onSubmit={handleCreateReply} className="mt-2 mb-3 p-2 border rounded bg-white">
                    <div className="mb-1 text-secondary small">
                      Replying to <strong>@{activeReply.targetAuthorName}</strong>
                    </div>
                    <textarea
                      className={`form-control form-control-sm mb-2${replyError ? " is-invalid" : ""}`}
                      rows={2}
                      aria-label={`Reply to ${activeReply.targetAuthorName}`}
                      placeholder="Write a reply…"
                      value={replyContent}
                      disabled={replySubmitting}
                      onChange={(e) => {
                        setReplyContent(e.target.value);
                        if (replyError) setReplyError(null);
                      }}
                      autoFocus
                    />
                    {replyError ? <div className="invalid-feedback d-block">{replyError}</div> : null}
                    <div className="d-flex justify-content-between align-items-center">
                      <small className="text-secondary">{replyCharCount} / 2000</small>
                      <div className="d-flex gap-2">
                        <Button
                          variant="secondary"
                          className="btn-sm"
                          disabled={replySubmitting}
                          onClick={() => {
                            setActiveReply(null);
                            setReplyContent("");
                            setReplyError(null);
                          }}
                        >
                          Cancel Reply
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          className="btn-sm"
                          disabled={replySubmitting || replyCharCount < 1 || replyCharCount > 2000}
                          busy={replySubmitting}
                        >
                          Reply
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : null}

                {/* Replies Thread */}
                {displayedReplies.length > 0 ? (
                  <div className="d-flex flex-column gap-2 mt-2 pt-2 border-top">
                    {displayedReplies.map((reply) => {
                      const isReplyingToThis = activeReply?.targetPublicId === reply.publicId;
                      const indentClass = reply.depth === 2 ? "ms-4" : "ms-3";

                      return (
                        <div
                          key={reply.publicId}
                          className={`${indentClass} p-2 rounded bg-white border`}
                          data-testid={`comment-${reply.publicId}`}
                        >
                          <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                            <span className="fw-semibold small">{reply.author?.name}</span>
                            {reply.author?.role ? <Badge>{statusLabel(reply.author.role)}</Badge> : null}
                            <small className="text-secondary">{ticketDateTime(reply.createdAt)}</small>
                          </div>
                          <p className="mb-1 small text-break" style={{ whiteSpace: "pre-wrap" }}>
                            {reply.depth === 2 && reply.replyTo ? (
                              <span className="text-primary fw-medium">
                                @{reply.replyTo.name}{" "}
                              </span>
                            ) : null}
                            {reply.content}
                          </p>
                          <div>
                            <Button
                              variant="tertiary"
                              className="p-0 text-decoration-none btn-sm small"
                              onClick={() => {
                                setActiveReply({
                                  targetPublicId: reply.publicId,
                                  targetAuthorName: reply.author?.name ?? "User",
                                  rootPublicId: root.publicId,
                                });
                                setReplyContent("");
                                setReplyError(null);
                              }}
                            >
                              Reply
                            </Button>
                          </div>

                          {/* Inline Reply Composer for Reply */}
                          {isReplyingToThis ? (
                            <form onSubmit={handleCreateReply} className="mt-2 p-2 border rounded bg-light">
                              <div className="mb-1 text-secondary small">
                                Replying to <strong>@{activeReply.targetAuthorName}</strong>
                              </div>
                              <textarea
                                className={`form-control form-control-sm mb-2${replyError ? " is-invalid" : ""}`}
                                rows={2}
                                aria-label={`Reply to ${activeReply.targetAuthorName}`}
                                placeholder="Write a reply…"
                                value={replyContent}
                                disabled={replySubmitting}
                                onChange={(e) => {
                                  setReplyContent(e.target.value);
                                  if (replyError) setReplyError(null);
                                }}
                                autoFocus
                              />
                              {replyError ? <div className="invalid-feedback d-block">{replyError}</div> : null}
                              <div className="d-flex justify-content-between align-items-center">
                                <small className="text-secondary">{replyCharCount} / 2000</small>
                                <div className="d-flex gap-2">
                                  <Button
                                    variant="secondary"
                                    className="btn-sm"
                                    disabled={replySubmitting}
                                    onClick={() => {
                                      setActiveReply(null);
                                      setReplyContent("");
                                      setReplyError(null);
                                    }}
                                  >
                                    Cancel Reply
                                  </Button>
                                  <Button
                                    type="submit"
                                    variant="primary"
                                    className="btn-sm"
                                    disabled={replySubmitting || replyCharCount < 1 || replyCharCount > 2000}
                                    busy={replySubmitting}
                                  >
                                    Reply
                                  </Button>
                                </div>
                              </div>
                            </form>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* View more replies button */}
                {!expanded?.loading && !expanded?.error && remainingReplies > 0 ? (
                  <div className="mt-2">
                    <Button
                      variant="tertiary"
                      className="p-0 text-decoration-none btn-sm"
                      onClick={() => void handleExpandReplies(root.publicId, expanded ? expanded.page + 1 : 1)}
                    >
                      View {remainingReplies} more {remainingReplies === 1 ? "reply" : "replies"}
                    </Button>
                  </div>
                ) : null}

                {expanded?.loading ? (
                  <div className="mt-2 text-secondary small">Loading replies…</div>
                ) : null}

                {expanded?.error ? (
                  <div className="mt-2 d-flex align-items-center gap-2">
                    <span className="text-danger small">{expanded.error}</span>
                    <Button
                      variant="tertiary"
                      className="p-0 text-decoration-none btn-sm"
                      onClick={() =>
                        void handleExpandReplies(
                          root.publicId,
                          expanded.failedPage ?? (expanded ? expanded.page + 1 : 1),
                        )
                      }
                    >
                      Retry
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}

          {/* Load More Comments button */}
          {page < totalPages ? (
            <div className="d-flex justify-content-center mt-2">
              <Button
                variant="secondary"
                disabled={loadingMore}
                busy={loadingMore}
                onClick={() => void loadRoots(page + 1, true)}
              >
                Load more comments
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
