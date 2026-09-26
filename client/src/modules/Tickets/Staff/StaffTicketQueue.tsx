import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { ApiResponseError, readPaginationHeader, type MasterDataItem } from "../../../api.js";
import { useAuth } from "../../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../../auth/useAuthenticatedApi.js";
import { Button } from "../../../components/Common/Button.js";
import { DataTable, type IColumn } from "../../../components/Maintain/DataTable.js";
import { Modal } from "../../../components/Common/Modal.js";
import { PriorityChip } from "../components/PriorityChip.js";
import { Select } from "../../../components/Common/Form/Select.js";
import { StatusChip } from "../components/StatusChip.js";
import { TextInput } from "../../../components/Common/Form/TextInput.js";
import { ticketDate } from "../ticketDate.js";
import {
  DEFAULT_QUEUE_FILTERS,
  PRIORITIES,
  STATUSES,
  statusLabel,
  type QueueFilter,
  type StaffTicketListItemDTO,
  type TicketOwnerDTO,
} from "../staffTickets.js";

const SORTS: [string, string][] = [
  ["", "Operational Priority"],
  ["createdAt:desc", "Newest"],
  ["createdAt:asc", "Oldest"],
  ["updatedAt:desc", "Recently Updated"],
  ["itPriority:desc", "IT Priority High to Low"],
  ["itPriority:asc", "IT Priority Low to High"],
  ["currentStatus:asc", "Status"],
  ["ticketNumber:asc", "Ticket Number A-Z"],
  ["ticketNumber:desc", "Ticket Number Z-A"],
];

const FILTER_LABELS: Record<string, string> = {
  currentStatus: "Status",
  itPriority: "IT Priority",
  requestedPriority: "Requested Priority",
  ownerPublicId: "Owner",
  categoryId: "Category",
  relatedSystemId: "Related System",
  createdAt: "Created",
};

type LoadState = "loading" | "loaded" | "invalid";

export default function StaffTicketQueue() {
  const callApi = useAuthenticatedApi();
  const navigate = useNavigate();
  const { user } = useAuth();
  const detailPath = user?.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<QueueFilter[]>(DEFAULT_QUEUE_FILTERS);
  const [draft, setDraft] = useState<QueueFilter[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState<{
    key: string;
    rows: StaffTicketListItemDTO[];
    total: number;
  } | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [owners, setOwners] = useState<TicketOwnerDTO[]>([]);
  const [categories, setCategories] = useState<MasterDataItem[]>([]);
  const [systems, setSystems] = useState<MasterDataItem[]>([]);
  const [lookupError, setLookupError] = useState(false);

  const params = new URLSearchParams({
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
    filters: JSON.stringify(filters),
  });
  if (sort) params.set("sort", sort);
  if (search) {
    params.set("search", search);
    params.set("searchFields", "ticketNumber,summary,description,requesterName");
  }
  const queryKey = params.toString();
  const pending = loadState === "loading" || (loadState !== "invalid" && result?.key !== queryKey);
  const rows = !pending && result ? result.rows : [];

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPageNumber(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    async function load() {
      setLoadState("loading");
      try {
        let total = 0;
        const items = await callApi<StaffTicketListItemDTO[]>(`/api/tickets?${queryKey}`, {
          signal: controller.signal,
          onResponse: (response) => {
            total = readPaginationHeader(response.headers.get("X-Pagination"))?.totalItems ?? 0;
          },
        });
        if (!ignore) {
          setResult({ key: queryKey, rows: items, total });
          setLoadState("loaded");
        }
      } catch (error) {
        if (!ignore) {
          if (error instanceof ApiResponseError && error.status === 400) {
            setLoadState("invalid");
            return;
          }
          navigate("/error", {
            state: {
              status: error instanceof ApiResponseError && error.status === 403 ? 403 : 500,
            },
          });
        }
      }
    }
    void load();
    return () => {
      ignore = true;
      controller.abort();
    };
  }, [callApi, queryKey, navigate]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [users, categoryRows, systemRows] = await Promise.all([
          callApi<TicketOwnerDTO[]>("/api/users/assignable"),
          callApi<MasterDataItem[]>("/api/categories"),
          callApi<MasterDataItem[]>("/api/related-systems"),
        ]);
        if (!ignore) {
          setOwners(users);
          setCategories(categoryRows);
          setSystems(systemRows);
        }
      } catch {
        if (!ignore) setLookupError(true);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [callApi]);

  function commit(next: QueueFilter[]) {
    setFilters(next);
    setPageNumber(1);
  }

  function resetQuery() {
    setSearchInput("");
    setSearch("");
    setFilters(DEFAULT_QUEUE_FILTERS);
    setSort("");
    setPageNumber(1);
    setPageSize(10);
  }

  function changeDraft(field: string, value: string, condition = "EQUAL") {
    setDraft((current) => [
      ...current.filter(
        (filter) =>
          filter.field !== field || (field === "createdAt" && filter.condition !== condition),
      ),
      ...(value
        ? [
            {
              field,
              condition: value === "unassigned" ? "ISNULL" : condition,
              value: value === "unassigned" ? "" : value,
            },
          ]
        : []),
    ]);
  }

  function selectFilter(field: string, options: { value: string; label: string }[]) {
    return (
      <div className="col-12 col-sm-6" key={field}>
        <Select
          label={FILTER_LABELS[field]}
          id={`queue-${field}`}
          value={
            draft.find(
              (filter) => filter.field === field && ["EQUAL", "ISNULL"].includes(filter.condition),
            )?.value || (draft.some((filter) => filter.field === field && filter.condition === "ISNULL")
              ? "unassigned"
              : "")
          }
          onChange={(event) => changeDraft(field, event.target.value)}
        >
          <option value="">All</option>
          {options.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    );
  }

  function chipValue(filter: QueueFilter): string {
    const value = String(filter.value);
    if (filter.condition === "ISNULL") return "Unassigned";
    if (filter.field === "ownerPublicId")
      return owners.find((owner) => owner.publicId === value)?.name ?? "Selected owner";
    if (filter.field === "categoryId")
      return categories.find((category) => category.id === Number(value))?.name ?? value;
    if (filter.field === "relatedSystemId")
      return systems.find((system) => system.id === Number(value))?.name ?? value;
    return statusLabel(value);
  }

  const columns: IColumn<StaffTicketListItemDTO>[] = [
    {
      key: "ticketNumber",
      label: "Ticket Number",
      sortable: false,
      render: (_val, ticket) => (
        <Link to={`${detailPath}/${ticket.publicId}`}>{ticket.ticketNumber}</Link>
      ),
    },
    {
      key: "summary",
      label: "Summary / Category",
      sortable: false,
      render: (_val, ticket) => (
        <>
          {ticket.summary}
          <small className="d-block text-secondary">{ticket.categoryName}</small>
        </>
      ),
    },
    {
      key: "itPriority",
      label: "IT Priority",
      sortable: false,
      render: (_val, ticket) => <PriorityChip value={ticket.itPriority} />,
    },
    {
      key: "currentStatus",
      label: "Status",
      sortable: false,
      render: (_val, ticket) => <StatusChip value={ticket.currentStatus} />,
    },
    {
      key: "owner",
      label: "Owner",
      sortable: false,
      render: (_val, ticket) => ticket.owner?.name ?? "Unassigned",
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: false,
      render: (_val, ticket) => ticketDate(ticket.createdAt),
    },
  ];

  const renderMobileCard = (ticket: StaffTicketListItemDTO) => (
    <article className="border rounded p-3" key={ticket.publicId}>
      <h2 className="h6 text-break">{ticket.ticketNumber}</h2>
      <p>{ticket.summary}</p>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <PriorityChip value={ticket.itPriority} />
        <StatusChip value={ticket.currentStatus} />
      </div>
      <p className="mb-1">Owner: {ticket.owner?.name ?? "Unassigned"}</p>
      <p className="mb-1">Category: {ticket.categoryName}</p>
      <p>Created: {ticketDate(ticket.createdAt)}</p>
      <Link
        to={`${detailPath}/${ticket.publicId}`}
        aria-label={`Open Ticket ${ticket.ticketNumber}`}
        className="d-inline-flex align-items-center"
      >
        <Eye size={14} aria-hidden="true" focusable="false" className="me-1" />
        Open Ticket
      </Link>
    </article>
  );

  const filterModal = (
    <Modal
      open={filterOpen}
      title="Filter Tickets"
      onClose={() => setFilterOpen(false)}
      footer={
        <>
          <Button onClick={() => setDraft([])}>Reset</Button>
          <Button onClick={() => setFilterOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              commit(draft);
              setFilterOpen(false);
            }}
          >
            Apply
          </Button>
        </>
      }
    >
      {lookupError && (
        <p role="alert">Some filter options could not be loaded. Reload this page to retry.</p>
      )}
      {draft.some(
        (filter) => filter.field === "currentStatus" && filter.condition === "NOTEQUAL",
      ) && (
        <p>
          Closed and cancelled Tickets excluded.{" "}
          <Button
            variant="tertiary"
            onClick={() =>
              setDraft((current) =>
                current.filter((filter) => filter.field !== "currentStatus"),
              )
            }
          >
            Include all statuses
          </Button>
        </p>
      )}
      <div className="row g-3">
        {selectFilter(
          "currentStatus",
          STATUSES.map((value) => ({ value, label: statusLabel(value) })),
        )}
        {selectFilter(
          "itPriority",
          PRIORITIES.map((value) => ({ value, label: value })),
        )}
        {selectFilter("ownerPublicId", [
          { value: "unassigned", label: "Unassigned" },
          ...owners.map((owner) => ({
            value: owner.publicId,
            label: `${owner.name} (${statusLabel(owner.role)})`,
          })),
        ])}
        {selectFilter(
          "categoryId",
          categories.map((category) => ({
            value: String(category.id),
            label: category.name,
          })),
        )}
      </div>
      <details className="mt-3">
        <summary>More Filters</summary>
        <div className="row g-3 mt-1">
          {selectFilter(
            "requestedPriority",
            PRIORITIES.map((value) => ({ value, label: value })),
          )}
          {selectFilter(
            "relatedSystemId",
            systems.map((system) => ({
              value: String(system.id),
              label: system.name,
            })),
          )}
          {(["GREATEROREQUAL", "LESSEROREQUAL"] as const).map((condition, index) => (
            <div className="col-12 col-sm-6" key={condition}>
              <TextInput
                label={`Created ${index ? "To" : "From"} (UTC)`}
                id={`queue-date-${index}`}
                type="date"
                value={String(
                  draft.find(
                    (filter) =>
                      filter.field === "createdAt" && filter.condition === condition,
                  )?.value ?? "",
                ).slice(0, 10)}
                onChange={(event) =>
                  changeDraft(
                    "createdAt",
                    event.target.value
                      ? `${event.target.value}T${index ? "23:59:59.999" : "00:00:00.000"}Z`
                      : "",
                    condition,
                  )
                }
              />
            </div>
          ))}
        </div>
      </details>
    </Modal>
  );

  return (
    <DataTable<StaffTicketListItemDTO>
      containerClassName="tt-staff-page"
      title="Ticket Queue"
      itemName="Tickets"
      data={rows}
      total={result?.total ?? 0}
      loading={pending}
      invalidState={loadState === "invalid"}
      onResetQuery={resetQuery}
      columns={columns}
      renderMobileCard={renderMobileCard}
      tableClassName="tt-staff-table"
      tableCaption="Ticket Queue"
      basePath={detailPath}
      itemKey="publicId"
      showEditAction={false}
      showDeleteAction={false}
      searchId="queue-search"
      sortId="queue-sort"
      searchLabel="Search Tickets"
      searchPlaceholder="Search ticket number, summary, description, or requester..."
      searchValue={searchInput}
      onSearchInputChange={setSearchInput}
      sortOptions={SORTS}
      selectedSort={sort}
      onSortChange={(value) => {
        setSort(value);
        setPageNumber(1);
      }}
      filterCount={filters.length}
      onOpenFilterDialog={() => {
        setDraft(filters.map((filter) => ({ ...filter })));
        setFilterOpen(true);
      }}
      activeChips={filters.map((filter, index) => ({
        key: `${filter.field}-${index}`,
        label: `${FILTER_LABELS[filter.field]}: ${
          filter.condition === "NOTEQUAL" ? "Exclude " : ""
        }${chipValue(filter)}`,
        onRemove: () => commit(filters.filter((_, position) => position !== index)),
      }))}
      onClearFilters={() => {
        setSearchInput("");
        setSearch("");
        commit([]);
      }}
      customFilterModal={filterModal}
      pageNumber={pageNumber}
      pageSize={pageSize}
      onPageChange={setPageNumber}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPageNumber(1);
      }}
    />
  );
}
