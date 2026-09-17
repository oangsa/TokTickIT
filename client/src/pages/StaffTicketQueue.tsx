import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiResponseError, readPaginationHeader, type MasterDataItem } from "../api.js";
import { useAuth } from "../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../auth/useAuthenticatedApi.js";
import { Badge } from "../components/Badge.js";
import { Button } from "../components/Button.js";
import { Card } from "../components/Card.js";
import { ErrorState } from "../components/ErrorState.js";
import { FilterChip } from "../components/FilterChip.js";
import { Modal } from "../components/Modal.js";
import { PageHeader } from "../components/PageHeader.js";
import { Pagination } from "../components/Pagination.js";
import { ticketDate } from "../tickets/ticketDate.js";
import { DEFAULT_QUEUE_FILTERS, PRIORITIES, STATUSES, statusLabel, type QueueFilter, type StaffTicketListItemDTO, type TicketOwnerDTO } from "../tickets/staffTickets.js";

const SORTS = [["", "Operational Priority"], ["createdAt:desc", "Newest"], ["createdAt:asc", "Oldest"], ["updatedAt:desc", "Recently Updated"], ["itPriority:desc", "IT Priority High to Low"], ["itPriority:asc", "IT Priority Low to High"], ["currentStatus:asc", "Status"], ["ticketNumber:asc", "Ticket Number A-Z"], ["ticketNumber:desc", "Ticket Number Z-A"]];
const FILTER_LABELS: Record<string, string> = { currentStatus: "Status", itPriority: "IT Priority", requestedPriority: "Requested Priority", ownerPublicId: "Owner", categoryId: "Category", relatedSystemId: "Related System", createdAt: "Created" };
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
  const [result, setResult] = useState<{ key: string; rows: StaffTicketListItemDTO[]; total: number } | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [owners, setOwners] = useState<TicketOwnerDTO[]>([]);
  const [categories, setCategories] = useState<MasterDataItem[]>([]);
  const [systems, setSystems] = useState<MasterDataItem[]>([]);
  const [lookupError, setLookupError] = useState(false);
  const params = new URLSearchParams({ pageNumber: String(pageNumber), pageSize: String(pageSize), filters: JSON.stringify(filters) });
  if (sort) params.set("sort", sort);
  if (search) { params.set("search", search); params.set("searchFields", "ticketNumber,summary,description,requesterName"); }
  const queryKey = params.toString();
  const pending = loadState === "loading" || (loadState !== "invalid" && result?.key !== queryKey);
  const rows = !pending && result ? result.rows : [];

  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => { setSearch(searchInput.trim()); setPageNumber(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    async function load() {
      setLoadState("loading");
      try {
        let total = 0;
        const items = await callApi<StaffTicketListItemDTO[]>(`/api/tickets?${queryKey}`, { signal: controller.signal, onResponse: (response) => { total = readPaginationHeader(response.headers.get("X-Pagination"))?.totalItems ?? 0; } });
        if (!ignore) { setResult({ key: queryKey, rows: items, total }); setLoadState("loaded"); }
      } catch (error) {
        if (!ignore) {
          if (error instanceof ApiResponseError && error.status === 400) { setLoadState("invalid"); return; }
          navigate("/error", { state: { status: error instanceof ApiResponseError && error.status === 403 ? 403 : 500 } });
        }
      }
    }
    void load();
    return () => { ignore = true; controller.abort(); };
  }, [callApi, queryKey, navigate]);
  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const [users, categoryRows, systemRows] = await Promise.all([callApi<TicketOwnerDTO[]>("/api/users/assignable"), callApi<MasterDataItem[]>("/api/categories"), callApi<MasterDataItem[]>("/api/related-systems")]);
        if (!ignore) { setOwners(users); setCategories(categoryRows); setSystems(systemRows); }
      } catch { if (!ignore) setLookupError(true); }
    }
    void load();
    return () => { ignore = true; };
  }, [callApi]);
  function commit(next: QueueFilter[]) { setFilters(next); setPageNumber(1); }
  function resetQuery() { setSearchInput(""); setSearch(""); setFilters(DEFAULT_QUEUE_FILTERS); setSort(""); setPageNumber(1); setPageSize(10); }
  function changeDraft(field: string, value: string, condition = "EQUAL") {
    setDraft((current) => [...current.filter((filter) => filter.field !== field || (field === "createdAt" && filter.condition !== condition)), ...(value ? [{ field, condition: value === "unassigned" ? "ISNULL" : condition, value: value === "unassigned" ? "" : value }] : [])]);
  }
  function selectFilter(field: string, options: { value: string; label: string }[]) {
    return <div className="col-12 col-sm-6" key={field}><label className="form-label" htmlFor={`queue-${field}`}>{FILTER_LABELS[field]}</label><select id={`queue-${field}`} className="form-select" value={draft.find((filter) => filter.field === field && ["EQUAL", "ISNULL"].includes(filter.condition))?.value || (draft.some((filter) => filter.field === field && filter.condition === "ISNULL") ? "unassigned" : "")} onChange={(event) => changeDraft(field, event.target.value)}><option value="">All</option>{options.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></div>;
  }
  function chipValue(filter: QueueFilter): string {
    const value = String(filter.value);
    if (filter.condition === "ISNULL") return "Unassigned";
    if (filter.field === "ownerPublicId") return owners.find((owner) => owner.publicId === value)?.name ?? "Selected owner";
    if (filter.field === "categoryId") return categories.find((category) => category.id === Number(value))?.name ?? value;
    if (filter.field === "relatedSystemId") return systems.find((system) => system.id === Number(value))?.name ?? value;
    return statusLabel(value);
  }
  return <div className="tt-staff-page">
    <PageHeader title="Ticket Queue" subtitle="Find and prioritize support work." />
    <Card>
      <div className="row g-3 mb-3 align-items-end">
        <div className="col-12 col-lg"><label htmlFor="queue-search" className="form-label">Search Tickets</label><input id="queue-search" className="form-control" placeholder="Search ticket number, summary, description, or requester..." value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
        <div className="col-auto"><Button onClick={() => { setDraft(filters.map((filter) => ({ ...filter }))); setFilterOpen(true); }}>Filters ({filters.length})</Button></div>
        <div className="col-12 col-sm-auto"><label htmlFor="queue-sort" className="form-label">Sort</label><select id="queue-sort" className="form-select" value={sort} onChange={(event) => { setSort(event.target.value); setPageNumber(1); }}>{SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {filters.map((filter, index) => <FilterChip key={`${filter.field}-${index}`} label={`${FILTER_LABELS[filter.field]}: ${filter.condition === "NOTEQUAL" ? "Exclude " : ""}${chipValue(filter)}`} onRemove={() => commit(filters.filter((_, position) => position !== index))} />)}
        {(filters.length > 0 || searchInput) && <Button variant="tertiary" onClick={() => { setSearchInput(""); setSearch(""); commit([]); }}>Clear Filters</Button>}
      </div>
      {loadState === "invalid" ? <ErrorState title="This search could not be run." description="Reset the search, filters, sorting, and page size, then try again." onRetry={resetQuery} retryLabel="Reset Search" /> : pending ? <div role="status" aria-label="Loading Tickets" className="placeholder-glow"><div className="placeholder col-12 mb-3" /><div className="placeholder col-12 mb-3" /><div className="placeholder col-12" /></div> : rows.length === 0 ? <p role="status">{search || filters.length ? "No Tickets match your search or filters. Try changing the current query." : "No Tickets are currently available."}</p> : <>
        <table className="table d-none d-xl-table tt-staff-table"><caption className="visually-hidden">Ticket Queue</caption><thead><tr>{["Ticket Number", "Summary / Category", "IT Priority", "Status", "Owner", "Created"].map((heading) => <th scope="col" key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((ticket) => <tr key={ticket.publicId}><td><Link to={`${detailPath}/${ticket.publicId}`}>{ticket.ticketNumber}</Link></td><td>{ticket.summary}<small className="d-block text-secondary">{ticket.categoryName}</small></td><td><Badge>{ticket.itPriority}</Badge></td><td><Badge>{statusLabel(ticket.currentStatus)}</Badge></td><td>{ticket.owner?.name ?? "Unassigned"}</td><td>{ticketDate(ticket.createdAt)}</td></tr>)}</tbody></table>
        <div className="d-xl-none d-grid gap-3">{rows.map((ticket) => <article className="border rounded p-3" key={ticket.publicId}><h2 className="h6 text-break">{ticket.ticketNumber}</h2><p>{ticket.summary}</p><div className="d-flex flex-wrap gap-2 mb-2"><Badge>{ticket.itPriority}</Badge><Badge>{statusLabel(ticket.currentStatus)}</Badge></div><p className="mb-1">Owner: {ticket.owner?.name ?? "Unassigned"}</p><p className="mb-1">Category: {ticket.categoryName}</p><p>Created: {ticketDate(ticket.createdAt)}</p><Link to={`${detailPath}/${ticket.publicId}`} aria-label={`Open Ticket ${ticket.ticketNumber}`}>Open Ticket</Link></article>)}</div>
      </>}
      {loadState !== "invalid" && <Pagination pageNumber={pageNumber} pageSize={pageSize} totalItems={result?.total ?? 0} pending={pending} onPageChange={setPageNumber} onPageSizeChange={(size) => { setPageSize(size); setPageNumber(1); }} />}
    </Card>
    <Modal open={filterOpen} title="Filter Tickets" onClose={() => setFilterOpen(false)} footer={<><Button onClick={() => setDraft([])}>Reset</Button><Button onClick={() => setFilterOpen(false)}>Cancel</Button><Button variant="primary" onClick={() => { commit(draft); setFilterOpen(false); }}>Apply</Button></>}>
      {lookupError && <p role="alert">Some filter options could not be loaded. Reload this page to retry.</p>}
      {draft.some((filter) => filter.field === "currentStatus" && filter.condition === "NOTEQUAL") && <p>Closed and cancelled Tickets excluded. <Button variant="tertiary" onClick={() => setDraft((current) => current.filter((filter) => filter.field !== "currentStatus"))}>Include all statuses</Button></p>}
      <div className="row g-3">
        {selectFilter("currentStatus", STATUSES.map((value) => ({ value, label: statusLabel(value) })))}
        {selectFilter("itPriority", PRIORITIES.map((value) => ({ value, label: value })))}
        {selectFilter("ownerPublicId", [{ value: "unassigned", label: "Unassigned" }, ...owners.map((owner) => ({ value: owner.publicId, label: `${owner.name} (${statusLabel(owner.role)})` }))])}
        {selectFilter("categoryId", categories.map((category) => ({ value: String(category.id), label: category.name })))}
      </div>
      <details className="mt-3"><summary>More Filters</summary><div className="row g-3 mt-1">
        {selectFilter("requestedPriority", PRIORITIES.map((value) => ({ value, label: value })))}
        {selectFilter("relatedSystemId", systems.map((system) => ({ value: String(system.id), label: system.name })))}
        {(["GREATEROREQUAL", "LESSEROREQUAL"] as const).map((condition, index) => <div className="col-12 col-sm-6" key={condition}><label className="form-label" htmlFor={`queue-date-${index}`}>Created {index ? "To" : "From"} (UTC)</label><input id={`queue-date-${index}`} type="date" className="form-control" value={String(draft.find((filter) => filter.field === "createdAt" && filter.condition === condition)?.value ?? "").slice(0, 10)} onChange={(event) => changeDraft("createdAt", event.target.value ? `${event.target.value}T${index ? "23:59:59.999" : "00:00:00.000"}Z` : "", condition)} /></div>)}
      </div></details>
    </Modal>
  </div>;
}
