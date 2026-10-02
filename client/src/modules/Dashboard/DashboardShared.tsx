import { type ReactNode, useId } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/Maintain/PageHeader.js";
import { ErrorState } from "../../components/Common/Feedback/ErrorState.js";
import { EmptyState } from "../../components/Common/Feedback/EmptyState.js";
import { Skeleton } from "../../components/Common/Feedback/Skeleton.js";
import { Button } from "../../components/Common/Button.js";
import { Card } from "../../components/Common/Card.js";
import { DataTable, type IColumn } from "../../components/Maintain/DataTable.js";

export function useDashboardSizes(operational = false) {
  const [params, setParams] = useSearchParams();
  const { search } = useLocation();
  const fields = operational ? ["myActionsSize", "recentTicketsSize", "urgentTicketsSize"] : ["recentTicketsSize"];
  const query = new URLSearchParams();
  for (const field of fields) query.set(field, params.get(field) ?? "5");
  return { query: query.toString(), scope: search,
    size: (field: string) => Number(params.get(field) ?? 5),
    setSize: (field: string, size: number) => { const next = new URLSearchParams(params); next.set(field, String(size)); setParams(next); },
  };
}
export function DashboardFrame({ children, loadingContent, loading, error, hasData, updatedAt, refresh }: {
  children: ReactNode; loadingContent: ReactNode; loading: boolean; error: boolean; hasData: boolean; updatedAt?: number; refresh: () => void;
}) {
  return <div><PageHeader title="Dashboard" actions={<div className="d-flex flex-wrap align-items-center gap-2">
    {updatedAt !== undefined ? <span className="text-secondary">Last updated {new Date(updatedAt).toLocaleTimeString("en-GB", { hour12: false })}</span> : null}
    <Button variant="secondary" disabled={loading} onClick={refresh}>Refresh</Button>
  </div>} />
    {!hasData ? error ? <ErrorState title="Unable to load Dashboard" description="Please try again." onRetry={refresh} /> : loadingContent : <>
      {error ? <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2" role="alert">Unable to update Dashboard. Showing last successful data.<Button variant="secondary" disabled={loading} onClick={refresh}>Retry</Button></div> : null}
      {children}
    </>}
  </div>;
}
export function DashboardSkeleton({ requester = false, tables }: {
  requester?: boolean; tables: { title: string; columns: string[]; size: number }[];
}) {
  const labels = requester ? ["Active Tickets", "Waiting for Me", "Resolved", "Closed"] : ["Unassigned", "My Assigned", "In Progress", "Waiting for Requester", "High Priority"];
  return <div role="status" aria-label="Loading Dashboard" aria-busy="true">
    <div role="group" aria-label="Dashboard metrics" className={`row g-3 mb-4 ${requester ? "row-cols-1 row-cols-md-2 row-cols-xl-4" : "row-cols-1 row-cols-md-2 row-cols-xl-5"}`}>
      {labels.map((label) => <div className="col" key={label}><Card className="h-100">
        <span className="fw-medium">{label}</span><div className="my-2"><Skeleton height="3rem" width="4rem" /></div><Skeleton width="6rem" />
      </Card></div>)}
    </div>
    {tables.map((table) => {
      const rows = Array.from({ length: Math.min(20, Math.max(1, table.size || 5)) }, (_, index) => index);
      return <Card key={table.title} title={table.title} className="mb-4">
        <table className="table align-middle mb-0 d-none d-xl-table">
          <caption className="visually-hidden">{table.title}</caption>
          <thead><tr>{table.columns.map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row}>{table.columns.map((label) => <td key={label}><Skeleton /></td>)}</tr>)}</tbody>
        </table>
        <div className="d-xl-none">{rows.map((row) => <div className="border rounded p-3 mb-3" key={row}>
          {table.columns.map((label) => <div className="mb-2" key={label}><span className="text-secondary small d-block">{label}</span><Skeleton /></div>)}
        </div>)}</div>
      </Card>;
    })}
  </div>;
}
export function MetricCards({ cards, requester = false }: { cards: { label: string; count: number; to: string }[]; requester?: boolean }) {
  return <div className={`row g-3 mb-4 ${requester ? "row-cols-1 row-cols-md-2 row-cols-xl-4" : "row-cols-1 row-cols-md-2 row-cols-xl-5"}`}>
    {cards.map((card) => <div className="col" key={card.label}><Link to={card.to} className="card tt-card h-100 text-decoration-none text-body" aria-label={`${card.label}: ${card.count}. View tickets`}>
      <div className="card-body"><span className="fw-medium">{card.label}</span><strong className="d-block display-6 my-2">{card.count}</strong><span className="text-primary">View tickets</span></div>
    </Link></div>)}
  </div>;
}
export function CompactTable<T extends { publicId: string }>({ title, rows, columns, size, onSize, rowLink, basePath, empty, emptyDescription }: {
  title: string; rows: T[]; columns: IColumn<T>[]; size: number; onSize: (size: number) => void; rowLink: (row: T) => string; basePath: string; empty: string; emptyDescription?: string;
}) {
  const id = useId();
  return <DataTable data={rows} columns={columns.map((column) => ({ ...column, sortable: false }))} itemKey="publicId" itemName={title} cardTitle={title}
    basePath={basePath} showToolbar={false} showPagination={false} rowLink={rowLink} linkFirstColumn showViewAction={false} showEditAction={false} showDeleteAction={false}
    renderEmptyState={() => <EmptyState title={empty} description={emptyDescription} />}
    tableCaption={title} emptyMessage={empty} containerClassName="mb-4"
    cardActions={<div><label className="visually-hidden" htmlFor={id}>{title} list size</label><select id={id} className="form-select form-select-sm" value={size} onChange={(event) => onSize(Number(event.target.value))}>
      {[5, 10, 20].map((value) => <option key={value} value={value}>{value}</option>)}
    </select></div>}
    renderMobileCard={(row) => <div>{columns.map((column, index) => <div key={column.key} className="mb-2 text-break">
      <span className="text-secondary small d-block">{column.label}</span>{index === 0 ? <Link to={rowLink(row)}>{column.render ? column.render(undefined, row) : String(row[column.key as keyof T] ?? "")}</Link> : column.render ? column.render(undefined, row) : String(row[column.key as keyof T] ?? "")}
    </div>)}</div>} />;
}
