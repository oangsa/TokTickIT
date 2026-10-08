import type { ReactNode } from "react";
import type { IColumn, IFetchParams, IFetchResult, IDataTableFilterField } from "../../Maintain/DataTable.js";

// Method signatures keep resource definitions usable through the form renderer;
// rows always originate from the same definition's fetchData boundary.
interface LookupColumn<T> extends Omit<IColumn<T>, "render"> {
  render?(value: unknown, row: T): ReactNode;
}
export interface LookupDefinition<T extends object = object> {
  title: string;
  columns: LookupColumn<T>[];
  fetchData(params: IFetchParams): Promise<IFetchResult<T>>;
  getValue(row: T): string;
  getDisplayValue(row: T): string;
  searchPlaceholder: string;
  emptyMessage: string;
  noMatchMessage: string;
  defaultSortKey?: string;
  defaultSortDir?: "asc" | "desc";
  filterFields?: IDataTableFilterField[];
}
