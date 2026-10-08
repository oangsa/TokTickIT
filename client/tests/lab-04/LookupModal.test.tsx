import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { LookupModal } from "../../src/components/Common/Lookup/LookupModal.js";
import { userLookup } from "../../src/lookups/userLookup.js";
import type { ApiRequestInit } from "../../src/api.js";
import type { AuthContextValue } from "../../src/auth/AuthProvider.js";

it("User definition maps standard search/filter/sort/page and X-Pagination, exposes Select only", async () => {
  const request = vi.fn(async (_path: string, init?: ApiRequestInit) => {
    init?.onResponse?.(new Response(null, { headers: { "X-Pagination": JSON.stringify({ pageNumber: 2, pageSize: 20, totalItems: 41, totalPages: 3, hasPreviousPage: true, hasNextPage: true }) } }));
    return [{ publicId: "alex", name: "Alex", email: "alex@example.test", role: "IT_STAFF" }];
  });
  const definition = userLookup(request as AuthContextValue["request"]);
  const result = await definition.fetchData({ searchTerm: " Alex ", page: 2, limit: 20, sortBy: "email", sortDir: "desc", search: { role: "IT_STAFF" } });
  const url = new URL(request.mock.calls[0][0], "http://localhost");
  expect(url.pathname).toBe("/api/users/assignable");
  expect(Object.fromEntries(url.searchParams)).toEqual({ search: "Alex", searchFields: "name,email", filters: '[{"field":"role","condition":"EQUAL","value":"IT_STAFF"}]', sort: "email:desc", pageNumber: "2", pageSize: "20" });
  expect(result.total).toBe(41);
  render(<MemoryRouter><LookupModal open definition={definition} onSelect={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
  expect(await screen.findByRole("article", { name: "Alex" })).toBeInTheDocument();
  expect((await screen.findAllByRole("button", { name: "Select Alex" }))[0]).toBeInTheDocument();
  for (const name of ["Name", "Email", "Role", "Actions"]) expect(screen.getByRole("columnheader", { name })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /Edit|Delete|Create/ })).not.toBeInTheDocument();
});

it("Lookup loading, safe failure/Retry, initial empty and no-results stay distinct; retries preserve query", async () => {
  const user = userEvent.setup();
  let resolve!: (value: { data: { publicId: string; name: string }[]; total: number }) => void;
  const fetchData = vi.fn().mockImplementationOnce(() => new Promise((done) => { resolve = done; })).mockRejectedValueOnce(new Error("private database details")).mockResolvedValue({ data: [], total: 0 });
  const definition = { title: "Choose", columns: [{ key: "name", label: "Name" }], fetchData, getValue: (row: { publicId: string; name: string }) => row.publicId, getDisplayValue: (row: { publicId: string; name: string }) => row.name, searchPlaceholder: "Search records", emptyMessage: "No eligible users", noMatchMessage: "No matching users" };
  const { act } = await import("@testing-library/react");
  render(<MemoryRouter><LookupModal open definition={definition} onSelect={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole("status", { name: "Loading lookup results" })).toBeInTheDocument();
  await act(async () => resolve({ data: [], total: 0 }));
  expect(await screen.findByText("No eligible users")).toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"), "missing{Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("Lookup could not be loaded");
  expect(screen.queryByText("private database details")).not.toBeInTheDocument();
  expect(screen.queryByText("No matching users")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("No matching users")).toBeInTheDocument();
  expect(fetchData.mock.calls.at(-1)![0].searchTerm).toBe("missing");
});

it("Lookup DataTable sorts by keyboard, exposes page and page-size changes", async () => {
  const user = userEvent.setup();
  const fetchData = vi.fn().mockResolvedValue({ data: [{ publicId: "alex", name: "Alex" }], total: 41 });
  const definition = { title: "Choose", columns: [{ key: "name", label: "Name" }], fetchData, getValue: (row: { publicId: string; name: string }) => row.publicId, getDisplayValue: (row: { publicId: string; name: string }) => row.name, searchPlaceholder: "Search records", emptyMessage: "None", noMatchMessage: "No matches", defaultSortKey: "name" };
  const { waitFor } = await import("@testing-library/react");
  render(<MemoryRouter><LookupModal open definition={definition} onSelect={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
  const header = await screen.findByRole("columnheader", { name: "Name" });
  header.focus(); await user.keyboard("{Enter}");
  await waitFor(() => expect(fetchData.mock.calls.at(-1)![0].sortDir).toBe("desc"));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetchData.mock.calls.at(-1)![0].page).toBe(2));
  await user.selectOptions(screen.getByLabelText("Rows per page"), "20");
  await waitFor(() => expect(fetchData.mock.calls.at(-1)![0]).toMatchObject({ page: 1, limit: 20 }));
});

it("Lookup safe retry loads selectable rows without treating failure as empty", async () => {
  const user = userEvent.setup(); const select = vi.fn();
  const fetchData = vi.fn().mockRejectedValueOnce(new Error("unsafe details")).mockResolvedValue({ data: [{ publicId: "alex", name: "Alex" }], total: 1 });
  const definition = { title: "Retry lookup", columns: [{ key: "name", label: "Name" }], fetchData, getValue: (row: { publicId: string; name: string }) => row.publicId, getDisplayValue: (row: { publicId: string; name: string }) => row.name, searchPlaceholder: "Search", emptyMessage: "None", noMatchMessage: "No matches" };
  render(<MemoryRouter><LookupModal open definition={definition} onSelect={select} onClose={vi.fn()} /></MemoryRouter>);
  await screen.findByRole("alert"); expect(screen.queryByText("None")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
  await user.click((await screen.findAllByRole("button", { name: "Select Alex" }))[0]);
  expect(select).toHaveBeenCalledWith(expect.objectContaining({ publicId: "alex", name: "Alex" }));
});
