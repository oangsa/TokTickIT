import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, UserCheck, UserMinus } from "lucide-react";
import type { Ticket } from "../../api.js";
import { useAuth } from "../../auth/AuthProvider.js";
import { useAuthenticatedApi } from "../../auth/useAuthenticatedApi.js";
import { fetchCollection } from "../../collections/fetchCollection.js";
import { DataTable, type IFetchParams, type IColumn } from "../../components/Maintain/DataTable.js";
import { Button } from "../../components/Common/Button.js";
import { IconButton } from "../../components/Common/IconButton.js";
import { EmptyState } from "../../components/Common/Feedback/EmptyState.js";
import { StatusChip } from "../Tickets/components/StatusChip.js";
import { ticketDateTime } from "../Tickets/ticketDate.js";
import { ActionFilters, EMPTY_ACTION_FILTERS, actionFilterExpressions, type ActionFilterValues } from "./ActionFilters.js";
import { ActionForm } from "./ActionForm.js";
import { ActionAssigneeSelection } from "./ActionAssigneeSelection.js";
import { actionApiPath, canEdit, isTerminal, type ActionTaken, type ActionListItem, type UserSummary } from "./types.js";

interface ActionRow extends ActionListItem { editable: boolean }
const COLUMNS: IColumn<ActionRow>[] = [
  { key: "status", label: "Status", render: (_value, row) => <StatusChip value={row.status} /> },
  { key: "description", label: "Description", sortable: false, render: (_value, row) => <span className="text-break" title={row.description}>{row.description}{row.isMigrated && <span className="d-block small text-secondary">Migrated Record</span>}</span> },
  { key: "assignedTo", label: "Assigned To", sortable: false, render: (_value, row) => row.assignedTo?.name ?? "Unassigned" },
  { key: "performedBy", label: "Performed By", sortable: false, render: (_value, row) => row.performedBy?.name ?? "Unknown" },
  { key: "createdAt", label: "Created At", render: (_value, row) => ticketDateTime(row.createdAt) },
];
export function ActionsTaken({ ticket, onChanged }: { ticket: Ticket; onChanged?: () => void }) {
  const { user } = useAuth();
  const request = useAuthenticatedApi();
  const requester = user?.role === "REQUESTER";
  const rolePath = requester ? "/tickets" : user?.role === "ADMINISTRATOR" ? "/admin/tickets" : "/staff/tickets";
  const detailPath = (row: ActionListItem) => `${rolePath}/${encodeURIComponent(ticket.publicId)}/actions/${encodeURIComponent(row.publicId)}`;
  const [filters, setFilters] = useState<ActionFilterValues>(EMPTY_ACTION_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [references, setReferences] = useState<UserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<{ action: ActionTaken; mode: "edit" | "assign" | "unassign" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const createAllowed = !requester && ["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"].includes(ticket.currentStatus);
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    const add = (key: keyof ActionFilterValues, label: string, clear: Partial<ActionFilterValues>) => chips.push({ key, label, onRemove: () => { setFilters((current) => ({ ...current, ...clear })); setPage(1); } });
    if (filters.status) add("status", `Status: ${filters.status}`, { status: "" });
    if (filters.unassigned || filters.assignedToUserPublicId) add("assignedToUserPublicId", `Assigned To: ${filters.unassigned ? "Unassigned" : filters.assignedName || references.find((user) => user.publicId === filters.assignedToUserPublicId)?.name || "Selected User"}`, { assignedToUserPublicId: "", assignedName: "", unassigned: false });
    if (filters.unknownPerformer || filters.performedByUserPublicId) add("performedByUserPublicId", `Performed By: ${filters.unknownPerformer ? "Unknown" : filters.performedName || references.find((user) => user.publicId === filters.performedByUserPublicId)?.name || "Selected User"}`, { performedByUserPublicId: "", performedName: "", unknownPerformer: false });
    if (filters.followUpRequired) add("followUpRequired", `Follow-Up Required: ${filters.followUpRequired === "true" ? "Yes" : "No"}`, { followUpRequired: "" });
    if (filters.createdDate) add("createdDate", `Created Date: ${filters.createdDate} UTC`, { createdDate: "" });
    return chips;
  }, [filters, references]);
  const fetchData = useCallback(async (params: IFetchParams) => {
    const query = new URLSearchParams({ sort: `${params.sortBy ?? "createdAt"}:${params.sortDir ?? "desc"}`, pageNumber: String(params.page), pageSize: String(params.limit) });
    if (params.searchTerm.trim()) { query.set("search", params.searchTerm.trim()); query.set("searchFields", "description,result,followUpNote,attachmentNotes"); }
    const expressions = actionFilterExpressions(filters);
    if (expressions.length) query.set("filters", JSON.stringify(expressions));
    const result = await fetchCollection<ActionListItem>(request, `${actionApiPath(ticket.publicId, requester)}?${query}`);
    setReferences((existing) => [...new Map([...existing, ...result.data.flatMap((row) => [row.assignedTo, row.performedBy ? { ...row.performedBy, email: "" } : null].filter((value): value is UserSummary => value !== null))].map((value) => [value.publicId, value])).values()]);
    const data = await Promise.all(result.data.map(async (row): Promise<ActionRow> => {
      let editable = false;
      if (!requester && user && !isTerminal(row)) {
        editable = [row.assignedTo?.publicId, ticket.owner?.publicId].includes(user.publicId);
        if (!editable) {
          // The frozen list omits creator; read detail only when creator eligibility is unknown.
          try { editable = canEdit(await request<ActionTaken>(actionApiPath(ticket.publicId, false, row.publicId)), ticket, user); } catch { editable = false; }
        }
      }
      return { ...row, editable };
    }));
    return { ...result, data };
  }, [request, ticket.publicId, ticket.owner?.publicId, requester, user?.publicId, filters]);
  async function open(row: ActionRow, mode: "edit" | "assign" | "unassign") {
    if (lock.current || requester || isTerminal(row)) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const loaded = await request<ActionTaken>(actionApiPath(ticket.publicId, false, row.publicId));
      if (isTerminal(loaded) || (mode === "edit" && (!user || !canEdit(loaded, ticket, user)))) { setError("This Action changed. Refresh the list to see its current state."); return; }
      setSelected({ action: loaded, mode });
    } catch { setError("The Action could not be loaded. Refresh the list and retry."); }
    finally { lock.current = false; setBusy(false); }
  }
  function saved() { setSelected(null); setCreateOpen(false); setRefresh((value) => value + 1); onChanged?.(); }
  const rowActions = (row: ActionRow) => <div className="d-inline-flex flex-wrap gap-1 align-items-center">
    <Link className="tt-row-action" to={detailPath(row)} aria-label={`View ${row.description}`} title="View"><Eye size={16} aria-hidden="true" focusable="false" /></Link>
    {!requester && !isTerminal(row) && <>
      {row.editable && <IconButton label={`Edit ${row.description}`} disabled={busy} onClick={() => void open(row, "edit")}><Pencil size={16} aria-hidden="true" focusable="false" /></IconButton>}
      <IconButton label={`${row.assignedTo ? "Reassign" : "Assign"} ${row.description}`} disabled={busy} onClick={() => void open(row, "assign")}><UserCheck size={16} aria-hidden="true" focusable="false" /></IconButton>
      {row.assignedTo && <IconButton label={`Unassign ${row.description}`} disabled={busy} onClick={() => void open(row, "unassign")}><UserMinus size={16} aria-hidden="true" focusable="false" /></IconButton>}
    </>}
  </div>;
  return <>
    <DataTable cardTitle="Actions Taken" cardActions={createAllowed && <Button variant="primary" disabled={busy} onClick={() => setCreateOpen(true)}>Create Action</Button>}
      filterCount={activeChips.length} activeChips={activeChips} onOpenFilterDialog={() => setFilterOpen(true)}
      onClearFilters={() => { setFilters(EMPTY_ACTION_FILTERS); setSearch(""); setPage(1); }}
      customFilterModal={filterOpen && <ActionFilters values={filters} references={references} requester={Boolean(requester)} onClose={() => setFilterOpen(false)} onApply={(values) => { setFilters(values); setPage(1); setFilterOpen(false); }} />}
      pageNumber={page} onPageChange={setPage} searchValue={search} onSearchChange={(value) => { setSearch(value); setPage(1); }}
      sortOptions={[["createdAt:desc", "Newest"], ["createdAt:asc", "Oldest"], ["updatedAt:desc", "Recently updated"], ["status:asc", "Status"]]}
      columns={COLUMNS} fetchData={fetchData} itemKey="publicId" rowLink={detailPath} showEditAction={false} renderActions={rowActions}
      tableCaption="Actions Taken" tableTestId="actions-table" rowTestIdPrefix="action-row" refreshTrigger={refresh}
      defaultSortKey="createdAt" defaultSortDir="desc" searchPlaceholder="Search actions" searchAriaLabel="Search actions" searchMaxLength={200}
      errorMessage="Actions could not be loaded. Please retry." itemName="actions"
      tableTopContent={error && <div role="alert"><p>{error}</p><Button onClick={() => setRefresh((value) => value + 1)}>Refresh</Button></div>}
      renderEmptyState={({ hasQuery }) => <EmptyState title={hasQuery ? "No matching actions" : "No actions recorded yet"} description={hasQuery ? "Try changing your search or filters." : requester ? "Work recorded by IT Staff will appear here." : "Create an Action when work is ready to be planned or recorded."} action={hasQuery ? <Button onClick={() => { setFilters(EMPTY_ACTION_FILTERS); setSearch(""); setPage(1); }}>Clear Filters</Button> : createAllowed ? <Button variant="primary" onClick={() => setCreateOpen(true)}>Create Action</Button> : undefined} />}
      renderMobileCard={(row) => <article className="border-bottom pb-3"><StatusChip value={row.status} /><p className="text-break mt-2 mb-2">{row.description}{row.isMigrated && <span className="d-block small">Migrated Record</span>}</p><p className="small mb-2">Assigned To: {row.assignedTo?.name ?? "Unassigned"}<br />Performed By: {row.performedBy?.name ?? "Unknown"}<br />Created At: {ticketDateTime(row.createdAt)}</p>{rowActions(row)}</article>} />
    {createOpen && <ActionForm ticket={ticket} onClose={() => setCreateOpen(false)} onSaved={saved} />}
    {selected?.mode === "edit" && <ActionForm ticket={ticket} action={selected.action} onClose={() => setSelected(null)} onSaved={saved} />}
    {selected && selected.mode !== "edit" && <ActionAssigneeSelection action={selected.action} unassign={selected.mode === "unassign"} onClose={() => setSelected(null)} onSaved={saved} />}
  </>;
}
