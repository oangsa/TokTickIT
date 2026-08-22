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
  const firstItem = totalItems === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const lastItem = Math.min(pageNumber * pageSize, totalItems);
  const pages = pageWindow(pageNumber, pageCount);

  return (
    <nav aria-label="Ticket pagination" className="d-flex flex-wrap align-items-center gap-3 mt-3">
      <p className="mb-0 small text-secondary" aria-live="polite">
        <span className="d-none d-lg-inline">
          Showing {firstItem}–{lastItem} of {totalItems}
        </span>
        <span className="d-lg-none">
          Page {pageNumber} of {pageCount}
        </span>
      </p>

      <label className="d-flex align-items-center gap-2 mb-0 small">
        Rows per page
        <select
          className="form-select form-select-sm w-auto"
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="d-flex align-items-center gap-2 ms-auto">
        <Button
          variant="secondary"
          disabled={pageNumber <= 1}
          onClick={() => onPageChange(pageNumber - 1)}
        >
          <span aria-hidden="true">‹ </span>Previous
        </Button>

        <ul className="pagination mb-0 d-none d-lg-flex">
          {pages.map((page, index) =>
            page === null ? (
              <li key={`gap-${index}`} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={page} className={`page-item${page === pageNumber ? " active" : ""}`}>
                <button
                  type="button"
                  className="page-link"
                  aria-current={page === pageNumber ? "page" : undefined}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </button>
              </li>
            )
          )}
        </ul>

        <Button
          variant="secondary"
          disabled={pageNumber >= pageCount}
          onClick={() => onPageChange(pageNumber + 1)}
        >
          Next<span aria-hidden="true"> ›</span>
        </Button>
      </div>
    </nav>
  );
}
