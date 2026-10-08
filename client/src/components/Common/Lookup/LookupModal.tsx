import { useCallback } from "react";
import { Button } from "../Button.js";
import { Modal } from "../Modal.js";
import { DataTable, type IFetchParams } from "../../Maintain/DataTable.js";
import type { LookupDefinition } from "./types.js";

interface LookupModalProps<T extends object> {
  open: boolean;
  definition: LookupDefinition<T>;
  onSelect: (row: T) => void;
  onClose: () => void;
  disabled?: boolean;
}
export function LookupModal<T extends object>({ open, definition, onSelect, onClose, disabled }: LookupModalProps<T>) {
  const fetchData = useCallback(async (params: IFetchParams) => {
    const result = await definition.fetchData(params);
    return { ...result, data: result.data.map((row) => ({ ...row, lookupKey: definition.getValue(row) })) };
  }, [definition]);
  const selectAction = (row: T) => <Button variant="secondary" disabled={disabled} aria-label={`Select ${definition.getDisplayValue(row)}`} onClick={() => { if (!disabled) onSelect(row); }}>Select</Button>;
  const sortOptions: [string, string][] = definition.columns.filter((column) => column.sortable !== false).flatMap((column) => ([
    [`${column.key}:asc`, `${column.label} (ascending)`], [`${column.key}:desc`, `${column.label} (descending)`],
  ] as [string, string][]));
  return <Modal open={open} title={definition.title} size="lg" onClose={onClose} footer={<Button onClick={onClose}>Cancel</Button>}>
    {open && <DataTable columns={definition.columns} fetchData={fetchData} itemKey="lookupKey"
      tableCaption={definition.title} tableTestId="lookup-table" rowTestIdPrefix="lookup-row"
      showEditAction={false} showViewAction={false} showDeleteAction={false}
      searchPlaceholder={definition.searchPlaceholder} searchAriaLabel={definition.searchPlaceholder} searchMaxLength={200}
      defaultSortKey={definition.defaultSortKey} defaultSortDir={definition.defaultSortDir}
      sortOptions={sortOptions}
      filterFields={definition.filterFields} emptyMessage={definition.emptyMessage} noMatchMessage={definition.noMatchMessage}
      errorMessage="Lookup could not be loaded. Please retry." itemName="lookup results"
      renderActions={selectAction}
      renderMobileCard={(row) => <article aria-label={definition.getDisplayValue(row)} className="border-bottom pb-3">
        <dl className="mb-2">{definition.columns.map((column) => {
          const value = row[column.key as keyof T];
          return <div key={column.key}><dt className="small text-secondary">{column.label}</dt><dd className="text-break mb-2">{column.render ? column.render(value, row) : String(value ?? "")}</dd></div>;
        })}</dl>{selectAction(row)}
      </article>} />}
  </Modal>;
}
