import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  DataTable,
  type IColumn,
  type IDataTableFilterField,
  type IFetchParams,
  type IFetchResult,
} from "../../src/components/DataTable.js";

interface TestItem {
  id: string;
  name: string;
  category: string;
  score: number;
}

const mockData: TestItem[] = [
  { id: "item-1", name: "Alpha", category: "Hardware", score: 95 },
  { id: "item-2", name: "Beta", category: "Software", score: 80 },
  { id: "item-3", name: "Gamma", category: "Network", score: 88 },
];

const COLUMNS: IColumn<TestItem>[] = [
  { key: "name", label: "Item Name", sortable: true },
  { key: "category", label: "Category", sortable: false },
  {
    key: "score",
    label: "Score",
    sortable: true,
    align: "right",
    render: (val) => <span className="badge bg-success">{String(val)}</span>,
  },
];

const FILTER_FIELDS: IDataTableFilterField[] = [
  {
    key: "category",
    label: "Category",
    ariaLabel: "Filter by category",
    type: "select",
    options: [
      { label: "Hardware", value: "Hardware" },
      { label: "Software", value: "Software" },
      { label: "Network", value: "Network" },
    ],
  },
];

describe("DataTable Component @issue-6", () => {
  it("renders table with title, columns, and data rows", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 3,
      totalPages: 1,
    } as IFetchResult<TestItem>);

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          title="Assets Inventory"
          eyebrow="Operations"
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="assets"
          basePath="/assets"
          showCreateButton={true}
          createButtonLabel="New Asset"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Assets Inventory")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New Asset" })).toHaveAttribute(
      "href",
      "/assets/new",
    );

    // Headers
    expect(screen.getByRole("columnheader", { name: /item name/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /category/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /score/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();

    // Data rows & custom cell render
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();

    // Edit action link
    const editLinks = screen.getAllByRole("link", { name: "Edit" });
    expect(editLinks.length).toBe(3);
    expect(editLinks[0]).toHaveAttribute("href", "/assets/item-1/edit");
    expect(editLinks[0]).toHaveClass("tt-row-action");
    expect(editLinks[0].querySelector("svg")).toBeInTheDocument();
  });

  it("keeps create opt-in so list pages without a create route render no create link", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 3,
      totalPages: 1,
    } as IFetchResult<TestItem>);

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          title="Ticket Queue"
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="tickets"
          basePath="/admin/tickets"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create" })).not.toBeInTheDocument();
  });

  it("handles column sorting when clicking sortable header", async () => {
    const fetchData = vi.fn().mockImplementation(async (params: IFetchParams) => ({
      data: mockData,
      total: 3,
      totalPages: 1,
    }));

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="assets"
          defaultSortKey="name"
          defaultSortDir="asc"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: "name", sortDir: "asc" }),
    );

    const nameHeader = screen.getByRole("columnheader", { name: /item name/i });
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");

    // Click to toggle to descending
    await userEvent.click(nameHeader);
    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "name", sortDir: "desc" }),
      );
    });
    expect(nameHeader).toHaveAttribute("aria-sort", "descending");

    // Non-sortable header should not toggle
    const catHeader = screen.getByRole("columnheader", { name: /category/i });
    expect(catHeader).not.toHaveAttribute("aria-sort");
  });

  it("supports delete action callback when showDeleteAction is enabled", async () => {
    const onDelete = vi.fn();
    const fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 3,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="assets"
          basePath="/assets"
          showDeleteAction={true}
          onDelete={onDelete}
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    expect(deleteButtons.length).toBe(3);

    await userEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith("item-1");
  });

  it("filters data using filter modal dialog and displays active chips", async () => {
    const fetchData = vi.fn().mockImplementation(async (params: IFetchParams) => ({
      data: mockData.filter((i) => !params.search?.category || i.category === params.search.category),
      total: 1,
      totalPages: 1,
    }));

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          fetchData={fetchData}
          columns={COLUMNS}
          filterFields={FILTER_FIELDS}
          itemName="assets"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();

    // Open filter modal
    const filterBtn = screen.getByRole("button", { name: /filter/i });
    await userEvent.click(filterBtn);

    // Select category and apply
    const categorySelect = screen.getByLabelText(/filter by category/i);
    await userEvent.selectOptions(categorySelect, "Software");
    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({
          search: expect.objectContaining({ category: "Software" }),
        }),
      );
    });

    // Verify filter chip is displayed
    expect(screen.getByText(/category:\s*software/i)).toBeInTheDocument();

    // Remove filter chip
    const removeBtn = screen.getByRole("button", { name: /remove filter category/i });
    await userEvent.click(removeBtn);

    await waitFor(() => {
      expect(fetchData).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: expect.objectContaining({ category: "" }),
        }),
      );
    });
  });

  it("handles debounced search input and form submission", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 3,
      totalPages: 1,
    });

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          fetchData={fetchData}
          columns={COLUMNS}
          searchPlaceholder="Search assets…"
          searchAriaLabel="Search assets"
          itemName="assets"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Alpha")).toBeInTheDocument();

    const searchInput = screen.getByLabelText("Search assets");
    await userEvent.type(searchInput, "Beta");
    await userEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: "Beta" }),
      );
    });
  });

  it("renders empty state when no items exist", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      data: [],
      total: 0,
      totalPages: 0,
    });

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="assets"
          emptyMessage="No assets registered."
          emptyTestId="empty-assets"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId("empty-assets")).toHaveTextContent(
      "No assets registered.",
    );
  });

  it("renders error state with retry button on fetch failure", async () => {
    let shouldFail = true;
    const fetchData = vi.fn().mockImplementation(async () => {
      if (shouldFail) {
        throw new Error("Server timeout");
      }
      return { data: mockData, total: 3, totalPages: 1 };
    });

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="assets"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Server timeout")).toBeInTheDocument();

    shouldFail = false;
    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(await screen.findByText("Alpha")).toBeInTheDocument();
  });

  it("renders icon-only action buttons with title, aria-label, and supports showViewAction and renderActions", async () => {
    const onView = vi.fn();
    const onDelete = vi.fn();

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          data={mockData}
          total={3}
          columns={COLUMNS}
          itemName="assets"
          basePath="/assets"
          showViewAction={true}
          showEditAction={true}
          showDeleteAction={true}
          onView={onView}
          onDelete={onDelete}
        />
      </MemoryRouter>,
    );

    // View action links
    const viewLinks = screen.getAllByRole("link", { name: "View" });
    expect(viewLinks.length).toBe(3);
    expect(viewLinks[0]).toHaveAttribute("href", "/assets/item-1");
    expect(viewLinks[0]).toHaveAttribute("title", "View");

    // Edit action links
    const editLinks = screen.getAllByRole("link", { name: "Edit" });
    expect(editLinks.length).toBe(3);
    expect(editLinks[0]).toHaveAttribute("href", "/assets/item-1/edit");
    expect(editLinks[0]).toHaveAttribute("title", "Edit");

    // Delete buttons
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    expect(deleteButtons.length).toBe(3);
    expect(deleteButtons[0]).toHaveAttribute("title", "Delete");

    // Custom renderActions test
    render(
      <MemoryRouter>
        <DataTable<TestItem>
          data={mockData}
          total={3}
          columns={COLUMNS}
          itemName="assets"
          renderActions={(item) => (
            <button type="button" aria-label={`Inspect ${item.name}`}>
              Inspect
            </button>
          )}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Inspect Alpha" })).toBeInTheDocument();
  });

  it("adds table-hover and supports row click navigation and keyboard activation", async () => {
    const onRowClick = vi.fn();

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          data={mockData}
          total={3}
          columns={COLUMNS}
          itemName="assets"
          basePath="/assets"
          onRowClick={onRowClick}
          renderMobileCard={(item) => <div>{item.name}</div>}
        />
      </MemoryRouter>,
    );

    // Desktop table has table-hover
    const table = screen.getByTestId("user-table");
    expect(table).toHaveClass("table-hover");
    expect(table).toHaveClass("align-middle");

    // Rows have tt-row and tt-row--clickable
    const row = screen.getByTestId("user-row-item-1");
    expect(row).toHaveClass("tt-row");
    expect(row).toHaveClass("tt-row--clickable");
    expect(row).toHaveAttribute("tabindex", "0");

    // Click row triggers navigation / callback
    await userEvent.click(within(table).getByText("Alpha"));
    expect(onRowClick).toHaveBeenCalledTimes(1);

    // Keydown Enter triggers callback
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(onRowClick).toHaveBeenCalledTimes(2);

    // Keydown Space triggers callback
    await userEvent.keyboard(" ");
    expect(onRowClick).toHaveBeenCalledTimes(3);
  });

  it("normalizes createButtonLabel by removing redundant leading plus prefix", async () => {
    const fetchData = vi.fn().mockResolvedValue({
      data: mockData,
      total: 3,
      totalPages: 1,
    } as IFetchResult<TestItem>);

    render(
      <MemoryRouter>
        <DataTable<TestItem>
          title="Assets Inventory"
          fetchData={fetchData}
          columns={COLUMNS}
          itemName="assets"
          basePath="/assets"
          showCreateButton={true}
          createButtonLabel="+ With Plus"
        />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Assets Inventory")).toBeInTheDocument();
    // Link name should be "With Plus" without literal '+'
    expect(screen.getByRole("link", { name: "With Plus" })).toBeInTheDocument();
  });
});
