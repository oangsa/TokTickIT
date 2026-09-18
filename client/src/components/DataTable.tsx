import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Eye, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "./Button.js";
import { Card } from "./Card.js";
import { ErrorState } from "./ErrorState.js";
import { FilterChip } from "./FilterChip.js";
import { Modal } from "./Modal.js";
import { MultiSelect } from "./MultiSelect.js";
import { PageHeader } from "./PageHeader.js";
import { Pagination } from "./Pagination.js";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];
const MULTI_VALUE_SEPARATOR = ",";
const EMPTY_FILTER_FIELDS: IDataTableFilterField[] = [];

export interface IColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface IFetchParams {
  searchTerm: string;
  page: number;
  limit: number;
  search?: Record<string, string>;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface IDataTableFilterOption {
  label: string;
  value: string;
}

export interface IDataTableFilterField {
  key: string;
  label: string;
  ariaLabel?: string;
  placeholder?: string;
  type: "text" | "select" | "date" | "multi-select";
  options?: IDataTableFilterOption[];
}

export interface IFetchResult<T> {
  data: T[];
  total: number;
  totalPages?: number;
  pageItemCount?: number;
  currentPage?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export interface IActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface IDataTableProps<T extends object = Record<string, unknown>> {
  title?: string;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;

  // Header & actions
  headerActions?: React.ReactNode;
  showCreateButton?: boolean;
  createButtonLabel?: string;
  createButtonTo?: string;
  createButtonAriaLabel?: string;
  cardClassName?: string;

  // Fetch / Controlled Data
  fetchData?: (params: IFetchParams) => Promise<IFetchResult<T>>;
  data?: T[];
  total?: number;
  loading?: boolean;
  errorMessage?: string;
  invalidState?: boolean;
  onResetQuery?: () => void;

  // Columns & Rendering
  columns: IColumn<T>[];
  renderMobileCard?: (item: T, index: number) => React.ReactNode;
  tableClassName?: string;
  tableCaption?: string;
  tableTestId?: string;
  rowTestIdPrefix?: string;
  basePath?: string;
  itemKey?: keyof T & string;
  showViewAction?: boolean;
  onView?: (item: T) => void;
  viewButtonTo?: (item: T) => string;
  showEditAction?: boolean;
  showDeleteAction?: boolean;
  onDelete?: (id: string | number) => void;
  renderActions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
  rowLink?: (item: T) => string;
  rowClassName?: string | ((item: T) => string);
  linkFirstColumn?: boolean;

  // Search
  searchLabel?: string;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  searchLabelHidden?: boolean;
  searchMaxLength?: number;
  searchValue?: string;
  searchId?: string;
  onSearchChange?: (search: string) => void;
  onSearchInputChange?: (input: string) => void;

  // Sort
  sortOptions?: [string, string][];
  selectedSort?: string;
  sortId?: string;
  onSortChange?: (sort: string) => void;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";

  // Filters
  filterFields?: IDataTableFilterField[];
  filterValues?: Record<string, string>;
  onFilterChange?: (filters: Record<string, string>) => void;
  filterCount?: number;
  activeChips?: IActiveFilterChip[];
  onClearFilters?: () => void;
  onOpenFilterDialog?: () => void;
  customFilterModal?: React.ReactNode;

  // Pagination
  pageNumber?: number;
  pageSize?: number;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  showPagination?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;

  // Layout & Styling
  containerClassName?: string;

  // Messages & Test IDs
  itemName?: string;
  emptyMessage?: string;
  noMatchMessage?: string;
  renderEmptyState?: (context: { hasQuery: boolean }) => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  linkFirstColumnLabel?: (item: T) => string;
  tableTopContent?: React.ReactNode;
  statusMessage?: React.ReactNode;
  emptyTestId?: string;
  refreshTrigger?: number;
}

function normalizeFilterValues(
  filterFields: IDataTableFilterField[],
  values?: Record<string, string>,
): Record<string, string> {
  const nextValues: Record<string, string> = {};
  for (const field of filterFields) {
    nextValues[field.key] = values?.[field.key] ?? "";
  }
  return nextValues;
}

function hasActiveFilterValue(value?: string): boolean {
  return Boolean(value && value.trim().length > 0);
}

function splitMultiSelectValues(value?: string): string[] {
  return String(value ?? "")
    .split(MULTI_VALUE_SEPARATOR)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinMultiSelectValues(values: string[]): string {
  return values.join(MULTI_VALUE_SEPARATOR);
}

function getFilterDisplayValue(field: IDataTableFilterField, rawValue: string): string {
  if (field.type === "select") {
    return field.options?.find((opt) => opt.value === rawValue)?.label ?? rawValue;
  }
  if (field.type === "multi-select") {
    const selected = splitMultiSelectValues(rawValue);
    const labels = selected.map(
      (val) => field.options?.find((opt) => opt.value === val)?.label ?? val,
    );
    if (labels.length <= 2) {
      return labels.join(", ");
    }
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
  }
  return rawValue;
}

function areFilterValuesEqual(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((k) => left[k] === right[k]);
}

export function DataTable<T extends object>({
  title,
  subtitle,
  eyebrow,
  headerActions,
  showCreateButton = false,
  createButtonLabel = "Create",
  createButtonTo,
  createButtonAriaLabel,
  cardClassName,

  fetchData,
  data: externalData,
  total: externalTotal,
  loading: externalLoading,
  errorMessage,
  invalidState = false,
  onResetQuery,

  columns = [],
  renderMobileCard,
  tableClassName,
  tableCaption,
  tableTestId = "user-table",
  rowTestIdPrefix = "user-row",
  basePath = "",
  itemKey = "id" as keyof T & string,
  showViewAction = false,
  onView,
  viewButtonTo,
  showEditAction = true,
  showDeleteAction = false,
  onDelete,
  renderActions,
  onRowClick,
  rowLink,
  rowClassName,
  linkFirstColumn = false,

  searchLabel,
  searchPlaceholder = "Search…",
  searchAriaLabel,
  searchLabelHidden = false,
  searchMaxLength,
  searchValue,
  searchId: externalSearchId,
  onSearchChange,
  onSearchInputChange,

  sortOptions,
  selectedSort: externalSort,
  sortId: externalSortId,
  onSortChange: externalOnSortChange,
  defaultSortKey,
  defaultSortDir = "asc",

  filterFields = EMPTY_FILTER_FIELDS,
  filterValues,
  onFilterChange,
  filterCount: externalFilterCount,
  activeChips: externalActiveChips,
  onClearFilters: externalOnClearFilters,
  onOpenFilterDialog: externalOnOpenFilterDialog,
  customFilterModal,

  pageNumber: externalPageNumber,
  pageSize: externalPageSize,
  defaultPageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showPagination = true,
  onPageChange: externalOnPageChange,
  onPageSizeChange: externalOnPageSizeChange,

  containerClassName,
  itemName = "items",
  emptyMessage,
  noMatchMessage,
  renderEmptyState,
  renderLoading,
  linkFirstColumnLabel,
  tableTopContent,
  statusMessage,
  emptyTestId = "empty-users",
  refreshTrigger = 0,
}: IDataTableProps<T>) {
  const navigate = useNavigate();
  const generatedSearchId = useId();
  const generatedSortId = useId();
  const searchId = externalSearchId || generatedSearchId;
  const sortId = externalSortId || generatedSortId;

  // Internal data state (when fetchData is provided)
  const [internalData, setInternalData] = useState<T[]>([]);
  const [internalTotal, setInternalTotal] = useState(0);
  const [internalLoading, setInternalLoading] = useState(Boolean(fetchData));
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchState, setSearchState] = useState(searchValue ?? "");
  const [searchInput, setSearchInput] = useState(searchValue ?? "");
  const [appliedSearch, setAppliedSearch] = useState(searchValue ?? "");

  // Sort state
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSortDir);
  const [internalSelectedSort, setInternalSelectedSort] = useState<string>(
    externalSort ?? (defaultSortKey ? `${defaultSortKey}:${defaultSortDir}` : ""),
  );

  // Pagination state
  const [internalPageNumber, setInternalPageNumber] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(defaultPageSize);

  // Filter state
  const [filterState, setFilterState] = useState<Record<string, string>>(() =>
    normalizeFilterValues(filterFields, filterValues),
  );
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>(() =>
    normalizeFilterValues(filterFields, filterValues),
  );
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const generation = useRef(0);

  // Resolve controlled vs uncontrolled states
  const data = externalData !== undefined ? externalData : internalData;
  const total = externalTotal !== undefined ? externalTotal : internalTotal;
  const loading = externalLoading !== undefined ? externalLoading : internalLoading;
  const currentPage = externalPageNumber !== undefined ? externalPageNumber : internalPageNumber;
  const currentPageSize = externalPageSize !== undefined ? externalPageSize : internalPageSize;
  const currentSort = externalSort !== undefined ? externalSort : internalSelectedSort;

  const shouldShowDetailLinks = Boolean(basePath);
  const shouldShowCreateAction =
    showCreateButton && (shouldShowDetailLinks || Boolean(createButtonTo));
  const shouldShowViewRowAction =
    showViewAction && (shouldShowDetailLinks || Boolean(onView) || Boolean(viewButtonTo));
  const shouldShowEditRowAction = showEditAction && shouldShowDetailLinks;
  const shouldShowDeleteRowAction = showDeleteAction && onDelete !== undefined;
  const shouldShowActionsColumn =
    Boolean(renderActions) ||
    shouldShowViewRowAction ||
    shouldShowEditRowAction ||
    shouldShowDeleteRowAction;

  const filters = useMemo(() => {
    if (filterValues !== undefined) {
      return normalizeFilterValues(filterFields, filterValues);
    }
    return normalizeFilterValues(filterFields, filterState);
  }, [filterFields, filterState, filterValues]);

  const internalActiveFilters = useMemo(
    () =>
      filterFields
        .filter((field) => hasActiveFilterValue(filters[field.key]))
        .map((field) => ({
          field,
          displayValue: getFilterDisplayValue(field, filters[field.key]),
        })),
    [filterFields, filters],
  );

  const resolvedChips: IActiveFilterChip[] = useMemo(() => {
    if (externalActiveChips !== undefined) {
      return externalActiveChips;
    }
    return internalActiveFilters.map(({ field, displayValue }) => ({
      key: field.key,
      label: `${field.label}: ${displayValue}`,
      onRemove: () => {
        const next = { ...filters, [field.key]: "" };
        if (filterValues !== undefined) {
          onFilterChange?.(next);
        } else {
          setFilterState(next);
          setResolvedCurrentPage(1);
        }
      },
    }));
  }, [externalActiveChips, internalActiveFilters, filters, filterValues, onFilterChange]);

  const activeFilterCount =
    externalFilterCount !== undefined
      ? externalFilterCount
      : externalActiveChips !== undefined
      ? externalActiveChips.length
      : internalActiveFilters.length;

  const setResolvedCurrentPage = useCallback(
    (nextPage: number) => {
      const normalizedPage = Math.max(1, nextPage);
      if (externalOnPageChange) {
        externalOnPageChange(normalizedPage);
      } else {
        setInternalPageNumber(normalizedPage);
      }
    },
    [externalOnPageChange],
  );

  const setResolvedPageSize = useCallback(
    (nextSize: number) => {
      if (externalOnPageSizeChange) {
        externalOnPageSizeChange(nextSize);
        return;
      }
      setInternalPageSize(nextSize);
      setResolvedCurrentPage(1);
    },
    [externalOnPageSizeChange, setResolvedCurrentPage],
  );

  // Sync external search prop
  useEffect(() => {
    if (searchValue !== undefined && searchValue !== searchInput) {
      setSearchInput(searchValue);
      setAppliedSearch(searchValue);
    }
  }, [searchValue, searchInput]);

  // Debounced search input sync
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed === appliedSearch) {
        return;
      }
      if (onSearchChange) {
        onSearchChange(trimmed);
      }
      setSearchState(trimmed);
      setAppliedSearch(trimmed);
      setResolvedCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [appliedSearch, onSearchChange, searchInput, setResolvedCurrentPage]);

  // Sync external sort prop
  useEffect(() => {
    if (externalSort !== undefined) {
      setInternalSelectedSort(externalSort);
    }
  }, [externalSort]);

  // Fetch data when self-contained
  const loadData = useCallback(async () => {
    if (!fetchData) return;
    const currentGen = ++generation.current;
    setInternalLoading(true);
    setError(null);

    const searchStr = searchValue !== undefined ? searchValue : appliedSearch;

    let activeSortKey = sortKey;
    let activeSortDir = sortDir;
    if (currentSort) {
      const [key, dir] = currentSort.split(":");
      if (key) {
        activeSortKey = key;
        activeSortDir = dir === "desc" ? "desc" : "asc";
      }
    }

    const params: IFetchParams = {
      searchTerm: searchStr,
      page: currentPage,
      limit: currentPageSize,
      search: filters,
    };

    if (activeSortKey) {
      params.sortBy = activeSortKey;
      params.sortDir = activeSortDir;
    }

    try {
      const result = await fetchData(params);
      if (currentGen === generation.current) {
        setInternalData(result.data ?? []);
        setInternalTotal(result.total ?? 0);
      }
    } catch (err) {
      if (currentGen === generation.current) {
        setError(
          errorMessage ||
            (err instanceof Error
              ? err.message
              : `Failed to load ${itemName}. Please check your connection and try again.`),
        );
      }
    } finally {
      if (currentGen === generation.current) {
        setInternalLoading(false);
      }
    }
  }, [
    appliedSearch,
    currentPage,
    currentPageSize,
    currentSort,
    errorMessage,
    fetchData,
    filters,
    itemName,
    searchValue,
    sortDir,
    sortKey,
  ]);

  useEffect(() => {
    if (fetchData) {
      void loadData();
    }
  }, [fetchData, loadData, refreshTrigger]);

  const handleSortChange = (newSort: string) => {
    if (externalOnSortChange) {
      externalOnSortChange(newSort);
    } else {
      setInternalSelectedSort(newSort);
      if (newSort.includes(":")) {
        const [k, d] = newSort.split(":");
        setSortKey(k);
        setSortDir(d === "desc" ? "desc" : "asc");
      } else {
        setSortKey(newSort || null);
        setSortDir("asc");
      }
      setResolvedCurrentPage(1);
    }
  };

  const handleColumnHeaderSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    const isCurrent = (sortKey === key) || (currentSort.startsWith(`${key}:`));
    const nextDir = isCurrent && (sortDir === "asc" || currentSort === `${key}:asc`) ? "desc" : "asc";
    const nextSortString = `${key}:${nextDir}`;

    handleSortChange(nextSortString);
    setSortKey(key);
    setSortDir(nextDir);
  };

  const getItemKey = (item: T): string | number => {
    const record = item as Record<string, unknown>;
    return (itemKey ? record[itemKey] : record.publicId ?? record.id) as string | number;
  };

  const handleDelete = (item: T) => {
    onDelete?.(getItemKey(item));
  };

  const getRowTarget = useCallback(
    (item: T, keyVal: string | number): string | null => {
      if (rowLink) return rowLink(item);
      if (shouldShowDetailLinks) {
        const pathSegment =
          typeof keyVal === "string" ? encodeURIComponent(keyVal) : String(keyVal);
        return `${basePath}/${pathSegment}`;
      }
      return null;
    },
    [basePath, rowLink, shouldShowDetailLinks],
  );

  const handleRowClick = (
    item: T,
    keyVal: string | number,
    event: React.MouseEvent<HTMLTableRowElement>,
  ) => {
    if (
      (event.target as HTMLElement).closest(
        "a, button, input, select, textarea, label, [role='button']",
      )
    ) {
      return;
    }
    if (onRowClick) {
      onRowClick(item, event);
      return;
    }
    const target = getRowTarget(item, keyVal);
    if (target) {
      navigate(target);
    }
  };

  const handleRowKeyDown = (
    item: T,
    keyVal: string | number,
    event: React.KeyboardEvent<HTMLTableRowElement>,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      if (
        (event.target as HTMLElement).closest(
          "a, button, input, select, textarea, label, [role='button']",
        )
      ) {
        return;
      }
      event.preventDefault();
      if (onRowClick) {
        onRowClick(item, event as unknown as React.MouseEvent<HTMLTableRowElement>);
        return;
      }
      const target = getRowTarget(item, keyVal);
      if (target) {
        navigate(target);
      }
    }
  };

  const handleFilterDialogOpen = () => {
    if (externalOnOpenFilterDialog) {
      externalOnOpenFilterDialog();
      return;
    }
    setFilterDraft(filters);
    setIsFilterDialogOpen(true);
  };

  const handleFilterDraftChange = (fieldKey: string, value: string) => {
    setFilterDraft((current) => ({ ...current, [fieldKey]: value }));
  };

  const handleFilterDraftMultiSelectChange = (fieldKey: string, values: string[]) => {
    setFilterDraft((current) => ({
      ...current,
      [fieldKey]: joinMultiSelectValues(values),
    }));
  };

  const handleApplyFilters = () => {
    const normalized = normalizeFilterValues(filterFields, filterDraft);
    if (filterValues !== undefined) {
      onFilterChange?.(normalized);
    } else {
      setFilterState(normalized);
      setResolvedCurrentPage(1);
    }
    setIsFilterDialogOpen(false);
  };

  const handleResetFilters = () => {
    const empty = normalizeFilterValues(filterFields, {});
    setFilterDraft(empty);
    if (filterValues !== undefined) {
      onFilterChange?.(empty);
    } else {
      setFilterState(empty);
      setResolvedCurrentPage(1);
    }
    setIsFilterDialogOpen(false);
  };

  const handleClearAllFilters = () => {
    if (externalOnClearFilters) {
      externalOnClearFilters();
    } else {
      handleResetFilters();
      setSearchInput("");
      setSearchState("");
      setAppliedSearch("");
      if (onSearchChange) onSearchChange("");
      setResolvedCurrentPage(1);
    }
  };

  const handleSearchSubmit = () => {
    const trimmed = searchInput.trim();
    if (onSearchChange) {
      onSearchChange(trimmed);
    }
    setSearchState(trimmed);
    setAppliedSearch(trimmed);
    setResolvedCurrentPage(1);
  };

  const handleResetQueryClick = () => {
    if (onResetQuery) {
      onResetQuery();
    } else {
      handleClearAllFilters();
      handleSortChange(defaultSortKey ? `${defaultSortKey}:${defaultSortDir}` : "");
      setResolvedPageSize(defaultPageSize);
    }
  };

  const defaultCreateLink = createButtonTo || (basePath ? `${basePath}/new` : "");
  const hasFilterControls =
    Boolean(customFilterModal) ||
    Boolean(externalOnOpenFilterDialog) ||
    filterFields.length > 0;
  const isSearchActive = Boolean(searchInput && searchInput.trim().length > 0);
  const resolvedSearchLabel = searchLabel || `Search ${title || itemName}`;

  return (
    <div className={`tt-data-table ${containerClassName || ""}`}>
      {/* Optional Page Header */}
      {title ? (
        <PageHeader
          title={title}
          subtitle={subtitle}
          eyebrow={eyebrow}
          actions={
            headerActions ||
            (shouldShowCreateAction && defaultCreateLink ? (
              <Link
                to={defaultCreateLink}
                className="btn btn-primary d-inline-flex align-items-center gap-1"
                aria-label={createButtonAriaLabel}
              >
                <Plus size={16} aria-hidden="true" focusable="false" />
                <span>{createButtonLabel.replace(/^\+\s*/, "")}</span>
              </Link>
            ) : null)
          }
        />
      ) : null}

      <Card className={cardClassName}>
        {/* Unified Toolbar matching Tickets layout: row g-3 mb-3 align-items-end */}
        <div className="row g-3 mb-3 align-items-end">
          <div className="col-12 col-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSubmit();
              }}
            >
              <label htmlFor={searchId} className={`form-label${searchLabelHidden ? " visually-hidden" : ""}`}>
                {resolvedSearchLabel}
              </label>
              <input
                id={searchId}
                type="search"
                className="form-control"
                autoComplete="off"
                spellCheck={false}
                maxLength={searchMaxLength}
                placeholder={searchPlaceholder}
                aria-label={searchAriaLabel || resolvedSearchLabel}
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  onSearchInputChange?.(e.target.value);
                }}
              />
              <button type="submit" className="visually-hidden">
                Search
              </button>
            </form>
          </div>

          {hasFilterControls && (
            <div className="col-auto">
              <Button
                className={activeFilterCount > 0 ? "tt-filters--applied" : undefined}
                onClick={handleFilterDialogOpen}
              >
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </Button>
            </div>
          )}

          {sortOptions && sortOptions.length > 0 && (
            <div className="col-12 col-sm-auto">
              <label htmlFor={sortId} className="form-label">
                Sort by
              </label>
              <select
                id={sortId}
                className="form-select"
                aria-label="Sort by"
                value={currentSort}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                {sortOptions.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Active Filter Chips & Clear Filters row */}
        {(resolvedChips.length > 0 || isSearchActive) && (
          <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
            {resolvedChips.map((chip) => (
              <FilterChip
                key={chip.key}
                label={chip.label}
                onRemove={chip.onRemove}
              />
            ))}
            {(resolvedChips.length > 0 || isSearchActive) && (
              <Button variant="tertiary" onClick={handleClearAllFilters}>
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {tableTopContent}
        {statusMessage !== undefined ? (
          <p role="status" className="visually-hidden">{statusMessage}</p>
        ) : null}

        {/* Invalid Search State (e.g. 400 validation error) */}
        {invalidState ? (
          <ErrorState
            title="This search could not be run."
            description="Reset the search, filters, sorting, and page size, then try again."
            onRetry={handleResetQueryClick}
            retryLabel="Reset Search"
          />
        ) : loading ? (
          /* Placeholder glow loading state matching Ticket Queue */
          renderLoading ? renderLoading() : (
            <div
              role="status"
              aria-label={`Loading ${itemName || title || "items"}`}
              className="placeholder-glow"
            >
              <div className="placeholder col-12 mb-3" />
              <div className="placeholder col-12 mb-3" />
              <div className="placeholder col-12" />
            </div>
          )
        ) : error ? (
          /* Error State with Retry button */
          <div className="alert alert-danger" role="alert">
            <p className="mb-2">{error}</p>
            <Button variant="secondary" onClick={() => void loadData()}>
              Retry
            </Button>
          </div>
        ) : data.length === 0 ? (
          /* Empty / No-results State */
          renderEmptyState ? renderEmptyState({ hasQuery: isSearchActive || activeFilterCount > 0 }) : (
            <p role="status" className="text-secondary py-4 text-center" data-testid={emptyTestId}>
              {isSearchActive || activeFilterCount > 0
                ? noMatchMessage || `No ${itemName || title || "items"} match your search or filters. Try changing the current query.`
                : emptyMessage || `No ${itemName || title || "items"} are currently available.`}
            </p>
          )
        ) : (
          /* Table View & Responsive Card Grid */
          <>
            {renderMobileCard ? (
              <>
                <table
                  className={`table table-hover align-middle mb-0 d-none d-xl-table ${tableClassName || ""}`}
                  data-testid={tableTestId}
                >
                  {tableCaption && <caption className="visually-hidden">{tableCaption}</caption>}
                  <thead>
                    <tr>
                      {columns.map((col) => {
                        const isSortable = col.sortable !== false;
                        const isSorted =
                          sortKey === col.key ||
                          currentSort.startsWith(`${col.key}:`);
                        const isDesc =
                          (isSorted && sortDir === "desc") ||
                          currentSort === `${col.key}:desc`;

                        return (
                          <th
                            key={col.key}
                            scope="col"
                            role="columnheader"
                            className={[col.className, col.align === "right" ? "text-end" : col.align === "center" ? "text-center" : ""]
                              .filter(Boolean)
                              .join(" ")}
                            style={{
                              cursor: isSortable ? "pointer" : "default",
                              userSelect: "none",
                              ...col.style,
                            }}
                            onClick={() => isSortable && handleColumnHeaderSort(col.key, isSortable)}
                            tabIndex={isSortable ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (isSortable && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                handleColumnHeaderSort(col.key, isSortable);
                              }
                            }}
                            aria-sort={
                              isSortable
                                ? isSorted
                                  ? isDesc
                                    ? "descending"
                                    : "ascending"
                                  : "none"
                                : undefined
                            }
                          >
                            <div
                              className={`d-inline-flex align-items-center gap-1 ${
                                col.align === "right"
                                  ? "justify-content-end"
                                  : col.align === "center"
                                  ? "justify-content-center"
                                  : ""
                              }`}
                            >
                              <span>{col.label}</span>
                              {isSortable && sortOptions && sortOptions.length === 0 && (
                                <span
                                  className="text-secondary d-inline-flex"
                                  style={{ opacity: isSorted ? 1 : 0.35 }}
                                >
                                  {isDesc ? (
                                    <ChevronDown size={14} aria-hidden="true" focusable="false" />
                                  ) : (
                                    <ChevronUp size={14} aria-hidden="true" focusable="false" />
                                  )}
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      {shouldShowActionsColumn && (
                        <th scope="col" role="columnheader" className="text-end">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => {
                      const keyVal = getItemKey(item);
                      const pathSegment =
                        typeof keyVal === "string" ? encodeURIComponent(keyVal) : String(keyVal);
                      const target = getRowTarget(item, keyVal);
                      const isClickable = Boolean(onRowClick || target);
                      const customClass =
                        typeof rowClassName === "function" ? rowClassName(item) : rowClassName || "";

                      return (
                        <tr
                          key={String(keyVal)}
                          data-testid={rowTestIdPrefix ? `${rowTestIdPrefix}-${keyVal}` : undefined}
                          className={`tt-row ${isClickable ? "tt-row--clickable" : ""} ${customClass}`.trim()}
                          style={isClickable ? { cursor: "pointer" } : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={isClickable ? (e) => handleRowClick(item, keyVal, e) : undefined}
                          onKeyDown={isClickable ? (e) => handleRowKeyDown(item, keyVal, e) : undefined}
                        >
                          {columns.map((col, idx) => (
                            <td
                              key={col.key}
                              className={[col.className, col.align === "right" ? "text-end" : col.align === "center" ? "text-center" : ""].filter(Boolean).join(" ")}
                              style={col.style}
                            >
                              {idx === 0 && linkFirstColumn && shouldShowDetailLinks ? (
                                <Link
                                  to={getRowTarget(item, keyVal) ?? `${basePath}/${pathSegment}`}
                                  className="fw-medium text-decoration-none"
                                  aria-label={linkFirstColumnLabel?.(item)}
                                >
                                  {col.render
                                    ? col.render((item as Record<string, unknown>)[col.key], item)
                                    : String((item as Record<string, unknown>)[col.key] ?? "")}
                                </Link>
                              ) : col.render ? (
                                col.render((item as Record<string, unknown>)[col.key], item)
                              ) : (
                                String((item as Record<string, unknown>)[col.key] ?? "")
                              )}
                            </td>
                          ))}
                          {shouldShowActionsColumn && (
                            <td className="text-end">
                              {renderActions ? (
                                renderActions(item)
                              ) : (
                                <div className="d-inline-flex align-items-center justify-content-end gap-1">
                                  {shouldShowViewRowAction && (
                                    <Link
                                      to={viewButtonTo ? viewButtonTo(item) : `${basePath}/${pathSegment}`}
                                      className="tt-row-action"
                                      title="View"
                                      aria-label="View"
                                      onClick={onView ? () => onView(item) : undefined}
                                    >
                                      <Eye size={16} aria-hidden="true" focusable="false" />
                                    </Link>
                                  )}
                                  {shouldShowEditRowAction && (
                                    <Link
                                      to={`${basePath}/${pathSegment}/edit`}
                                      className="tt-row-action"
                                      title="Edit"
                                      aria-label="Edit"
                                    >
                                      <Pencil size={16} aria-hidden="true" focusable="false" />
                                    </Link>
                                  )}
                                  {shouldShowDeleteRowAction && (
                                    <button
                                      type="button"
                                      className="tt-row-action tt-row-action--danger"
                                      title="Delete"
                                      aria-label="Delete"
                                      onClick={() => handleDelete(item)}
                                    >
                                      <Trash2 size={16} aria-hidden="true" focusable="false" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="d-xl-none d-grid gap-3">
                  {data.map((item, idx) => (
                    <React.Fragment key={String(getItemKey(item))}>
                      {renderMobileCard(item, idx)}
                    </React.Fragment>
                  ))}
                </div>
              </>
            ) : (
              <div className="table-responsive">
                <table
                  className={`table table-hover align-middle mb-0 ${tableClassName || ""}`}
                  data-testid={tableTestId}
                >
                  {tableCaption && <caption className="visually-hidden">{tableCaption}</caption>}
                  <thead>
                    <tr>
                      {columns.map((col) => {
                        const isSortable = col.sortable !== false;
                        const isSorted =
                          sortKey === col.key ||
                          currentSort.startsWith(`${col.key}:`);
                        const isDesc =
                          (isSorted && sortDir === "desc") ||
                          currentSort === `${col.key}:desc`;

                        return (
                          <th
                            key={col.key}
                            scope="col"
                            role="columnheader"
                            className={[col.className, col.align === "right" ? "text-end" : col.align === "center" ? "text-center" : ""]
                              .filter(Boolean)
                              .join(" ")}
                            style={{
                              cursor: isSortable ? "pointer" : "default",
                              userSelect: "none",
                              ...col.style,
                            }}
                            onClick={() => isSortable && handleColumnHeaderSort(col.key, isSortable)}
                            tabIndex={isSortable ? 0 : undefined}
                            onKeyDown={(e) => {
                              if (isSortable && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                handleColumnHeaderSort(col.key, isSortable);
                              }
                            }}
                            aria-sort={
                              isSortable
                                ? isSorted
                                  ? isDesc
                                    ? "descending"
                                    : "ascending"
                                  : "none"
                                : undefined
                            }
                          >
                            <div
                              className={`d-inline-flex align-items-center gap-1 ${
                                col.align === "right"
                                  ? "justify-content-end"
                                  : col.align === "center"
                                  ? "justify-content-center"
                                  : ""
                              }`}
                            >
                              <span>{col.label}</span>
                              {isSortable && (
                                <span
                                  className="text-secondary d-inline-flex"
                                  style={{ opacity: isSorted ? 1 : 0.35 }}
                                >
                                  {isDesc ? (
                                    <ChevronDown size={14} aria-hidden="true" focusable="false" />
                                  ) : (
                                    <ChevronUp size={14} aria-hidden="true" focusable="false" />
                                  )}
                                </span>
                              )}
                            </div>
                          </th>
                        );
                      })}
                      {shouldShowActionsColumn && (
                        <th scope="col" role="columnheader" className="text-end">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item) => {
                      const keyVal = getItemKey(item);
                      const pathSegment =
                        typeof keyVal === "string" ? encodeURIComponent(keyVal) : String(keyVal);
                      const target = getRowTarget(item, keyVal);
                      const isClickable = Boolean(onRowClick || target);
                      const customClass =
                        typeof rowClassName === "function" ? rowClassName(item) : rowClassName || "";

                      return (
                        <tr
                          key={String(keyVal)}
                          data-testid={rowTestIdPrefix ? `${rowTestIdPrefix}-${keyVal}` : undefined}
                          className={`tt-row ${isClickable ? "tt-row--clickable" : ""} ${customClass}`.trim()}
                          style={isClickable ? { cursor: "pointer" } : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={isClickable ? (e) => handleRowClick(item, keyVal, e) : undefined}
                          onKeyDown={isClickable ? (e) => handleRowKeyDown(item, keyVal, e) : undefined}
                        >
                          {columns.map((col, idx) => (
                            <td
                              key={col.key}
                              className={[col.className, col.align === "right" ? "text-end" : col.align === "center" ? "text-center" : ""].filter(Boolean).join(" ")}
                              style={col.style}
                            >
                              {idx === 0 && linkFirstColumn && shouldShowDetailLinks ? (
                                <Link
                                  to={getRowTarget(item, keyVal) ?? `${basePath}/${pathSegment}`}
                                  className="fw-medium text-decoration-none"
                                  aria-label={linkFirstColumnLabel?.(item)}
                                >
                                  {col.render
                                    ? col.render((item as Record<string, unknown>)[col.key], item)
                                    : String((item as Record<string, unknown>)[col.key] ?? "")}
                                </Link>
                              ) : col.render ? (
                                col.render((item as Record<string, unknown>)[col.key], item)
                              ) : (
                                String((item as Record<string, unknown>)[col.key] ?? "")
                              )}
                            </td>
                          ))}
                          {shouldShowActionsColumn && (
                            <td className="text-end">
                              {renderActions ? (
                                renderActions(item)
                              ) : (
                                <div className="d-inline-flex align-items-center justify-content-end gap-1">
                                  {shouldShowViewRowAction && (
                                    <Link
                                      to={viewButtonTo ? viewButtonTo(item) : `${basePath}/${pathSegment}`}
                                      className="tt-row-action"
                                      title="View"
                                      aria-label="View"
                                      onClick={onView ? () => onView(item) : undefined}
                                    >
                                      <Eye size={16} aria-hidden="true" focusable="false" />
                                    </Link>
                                  )}
                                  {shouldShowEditRowAction && (
                                    <Link
                                      to={`${basePath}/${pathSegment}/edit`}
                                      className="tt-row-action"
                                      title="Edit"
                                      aria-label="Edit"
                                    >
                                      <Pencil size={16} aria-hidden="true" focusable="false" />
                                    </Link>
                                  )}
                                  {shouldShowDeleteRowAction && (
                                    <button
                                      type="button"
                                      className="tt-row-action tt-row-action--danger"
                                      title="Delete"
                                      aria-label="Delete"
                                      onClick={() => handleDelete(item)}
                                    >
                                      <Trash2 size={16} aria-hidden="true" focusable="false" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {!invalidState && showPagination && (
          <div className="mt-4">
            <Pagination
              pageNumber={currentPage}
              pageSize={currentPageSize}
              totalItems={total}
              pageSizeOptions={pageSizeOptions}
              pending={loading}
              onPageChange={setResolvedCurrentPage}
              onPageSizeChange={setResolvedPageSize}
            />
          </div>
        )}
      </Card>

      {/* Custom Filter Modal if provided */}
      {customFilterModal}

      {/* Auto-generated Filter Modal Dialog when filterFields provided and no custom modal */}
      {!customFilterModal && filterFields.length > 0 && (
        <Modal
          open={isFilterDialogOpen}
          title={`Filter ${title || itemName}`}
          onClose={() => setIsFilterDialogOpen(false)}
          footer={
            <>
              <Button variant="tertiary" onClick={handleResetFilters}>
                Reset
              </Button>
              <Button variant="secondary" onClick={() => setIsFilterDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleApplyFilters}>
                Apply
              </Button>
            </>
          }
        >
          <div className="row g-3">
            {filterFields.map((field) => (
              <div className="col-12 col-sm-6" key={field.key}>
                <label className="form-label" htmlFor={`filter-${field.key}`}>
                  {field.label}
                </label>
                {field.type === "select" ? (
                  <select
                    id={`filter-${field.key}`}
                    className="form-select"
                    aria-label={field.ariaLabel || field.label}
                    value={filterDraft[field.key] ?? ""}
                    onChange={(e) => handleFilterDraftChange(field.key, e.target.value)}
                  >
                    <option value="">All</option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === "multi-select" ? (
                  <MultiSelect
                    label={field.label}
                    placeholder={field.placeholder || `Any ${field.label}`}
                    options={field.options || []}
                    selected={splitMultiSelectValues(filterDraft[field.key])}
                    onChange={(values) => handleFilterDraftMultiSelectChange(field.key, values)}
                  />
                ) : (
                  <input
                    id={`filter-${field.key}`}
                    type={field.type === "date" ? "date" : "text"}
                    className="form-control"
                    aria-label={field.ariaLabel || field.label}
                    placeholder={field.placeholder}
                    value={filterDraft[field.key] ?? ""}
                    onChange={(e) => handleFilterDraftChange(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default DataTable;
