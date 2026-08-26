import { useEffect, useRef } from "react";

import { Button } from "./Button.js";

interface PaginationProps {
  pageNumber: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (pageNumber: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

const DEFAULT_PAGE_SIZES = [10, 20, 30, 50, 100];

/* Section 18.1 shows five numbers; a wide sequence is forbidden (Section 18.2). */
const WINDOW = 5;

/*
 * Page numbers around the current page, always including the first and last.
 * `null` marks an elided run. Rendering every page instead would put 400 buttons
 * on screen for 4000 tickets and force the page-level horizontal scroll that
 * Section 4 forbids outright.
 */
function pageWindow(pageNumber: number, pageCount: number): (number | null)[] {
  if (pageCount <= WINDOW + 2) {
    return Array.from({ length: pageCount }, (_unused, index) => index + 1);
  }

  const half = Math.floor(WINDOW / 2);
  const start = Math.min(Math.max(pageNumber - half, 2), pageCount - WINDOW);
  const middle = Array.from({ length: WINDOW }, (_unused, index) => start + index);

  return [
    1,
    ...(middle[0] > 2 ? [null] : []),
    ...middle,
    ...(middle[middle.length - 1] < pageCount - 1 ? [null] : []),
    pageCount,
  ];
}

/*
 * Pagination (ui-spec Section 18). Desktop shows the range and a windowed page
 * list; mobile keeps compact Previous/Next controls. Both arrows carry visible
 * text, so no icon-only control is introduced here.
 */
export function Pagination({
  pageNumber,
  pageSize,
  totalItems,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  /*
   * Clamp here rather than in every caller. Narrowing a search or filter shrinks
   * `totalItems` while the caller still holds the old page number, and an
   * unclamped `firstItem` then reads past the end: "Showing 391-25 of 25", with
   * Previous still offering a page that no longer exists.
   */
  const page = Math.min(Math.max(1, pageNumber), pageCount);

  /*
   * The clamp alone would only make the controls internally consistent: the
   * caller would still hold the stale page number, still be showing the empty
   * result of fetching it, and the range above those zero rows would claim
   * "Showing 21-25 of 25". Report the clamp so the caller's own page state
   * converges and the next fetch matches what is rendered.
   *
   * `totalItems > 0` guards the report, and it is load-bearing rather than an
   * optimisation. `totalItems: 0` is what a caller renders while a refetch is in
   * flight, and it collapses `pageCount` to 1: reporting there would knock a user
   * on page 3 back to page 1 and discard the page-3 response that was about to
   * arrive. A genuinely empty result set needs no report either — every page of
   * it is equally empty, and the clamped display already reads "Page 1 of 1" —
   * so the report is only owed once a real total contradicts the caller.
   *
   * `onPageChange` is read through a ref: callers commonly pass an inline arrow,
   * and depending on its identity would re-run this on every render.
   */
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    if (totalItems > 0 && pageNumber !== page) {
      onPageChangeRef.current(page);
    }
  }, [pageNumber, page, totalItems]);

  const firstItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  const pages = pageWindow(page, pageCount);
  /*
   * A `pageSize` outside the presets would leave the select with no matching
   * option, so it would render blank while the list showed that size's rows.
   */
  const sizeOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((left, right) => left - right);

  return (
    <nav aria-label="Ticket pagination" className="d-flex flex-wrap align-items-center gap-3 mt-3">
      {/*
        * Not a live region. The page that renders this control owns one
        * always-mounted `role="status"` announcement (ui-spec 29.7); a second
        * one here announced the range again on every fetch, and announced it
        * wrong -- see the range guard below.
        *
        * A caller unmounts this control for a genuinely empty result set, so
        * `totalItems === 0` inside a rendered `Pagination` means the refetch
        * that will supply the real total is still in flight. Printing the
        * derived range there reads "Showing 0–0 of 0" underneath the caller's
        * skeleton rows, which contradicts them. The line keeps its height with
        * a non-breaking space so the surrounding structure does not jump
        * (ui-spec 19.1).
        */}
      <p className="mb-0 small text-secondary">
        {totalItems === 0 ? (
          "\u00a0"
        ) : (
          <>
            <span className="d-none d-lg-inline">
              Showing {firstItem}–{lastItem} of {totalItems}
            </span>
            <span className="d-lg-none">
              Page {page} of {pageCount}
            </span>
          </>
        )}
      </p>

      <label className="d-flex align-items-center gap-2 mb-0 small">
        Rows per page
        <select
          className="form-select form-select-sm w-auto"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {sizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="d-flex align-items-center gap-2 ms-auto">
        <Button
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <span aria-hidden="true">‹ </span>Previous
        </Button>

        <ul className="pagination mb-0 d-none d-lg-flex">
          {pages.map((entry, index) =>
            entry === null ? (
              <li key={`gap-${index}`} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={entry} className={`page-item${entry === page ? " active" : ""}`}>
                <button
                  type="button"
                  className="page-link"
                  aria-current={entry === page ? "page" : undefined}
                  onClick={() => onPageChange(entry)}
                >
                  {entry}
                </button>
              </li>
            )
          )}
        </ul>

        <Button
          variant="secondary"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next<span aria-hidden="true"> ›</span>
        </Button>
      </div>
    </nav>
  );
}
