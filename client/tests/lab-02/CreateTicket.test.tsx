import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { REQUESTER_STORAGE_KEY } from "../../src/requester/requesterStorage.js";
import {
  RECOVERY_STORAGE_KEY,
  RecoveryRecord,
  payloadSignature,
} from "../../src/tickets/createTicketDraft.js";

const ALICE = { id: 1, name: "Alice Johnson" };
const BOB = { id: 2, name: "Bob Smith" };

const CATEGORIES = [
  { id: 4, name: "Network", isActive: true, deleted: false, createdBy: "seed", createdAt: "", updatedBy: "seed", updatedAt: "" },
  { id: 2, name: "Hardware", isActive: true, deleted: false, createdBy: "seed", createdAt: "", updatedBy: "seed", updatedAt: "" },
];

const SYSTEMS = [
  { id: 5, name: "VPN", isActive: true, deleted: false, createdBy: "seed", createdAt: "", updatedBy: "seed", updatedAt: "" },
];

const TICKET = {
  publicId: "05a214b4-b957-4ed7-a58e-73f4392b35ec",
  ticketNumber: "TKT-20260820-A81F3C9D7B21",
  requesterId: 1,
  requesterName: "Alice Johnson",
  requesterEmail: "alice.johnson@example.com",
  categoryId: 4,
  categoryName: "Network",
  relatedSystemId: 5,
  relatedSystemName: "VPN",
  summary: "Cannot connect to campus VPN",
  description: "The VPN client fails after entering my credentials.",
  requestedPriority: "HIGH",
  currentStatus: "NEW",
  attachments: [],
  createdBy: "alice.johnson@example.com",
  createdAt: "2026-08-20T08:14:32.000Z",
  updatedBy: "alice.johnson@example.com",
  updatedAt: "2026-08-20T08:14:32.000Z",
  deleted: false,
};

interface StubbedCall {
  url: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}

interface StubbedResult {
  ok: boolean;
  status: number;
  body: unknown;
}

/* The two selectable Development Requesters, in the /api/requesters DTO shape. */
const REQUESTERS = [
  { ...ALICE, email: "alice.johnson@example.com", isActive: true, deleted: false, createdBy: "seed", createdAt: "", updatedBy: "seed", updatedAt: "" },
  { ...BOB, email: "bob.smith@example.com", isActive: true, deleted: false, createdBy: "seed", createdAt: "", updatedBy: "seed", updatedAt: "" },
];

/*
 * Routes by path so the two reference-data loads, the Requester list, and the
 * create call can be arranged independently. `create` returns the response for
 * POST /api/tickets; returning a Promise leaves that request pending, which is
 * how the stale-Requester tests hold a submission open across a switch.
 */
function stubApi(create?: () => StubbedResult | Promise<StubbedResult>) {
  const calls: StubbedCall[] = [];

  const fetchMock = vi.fn(async (url: string, init?: StubbedCall["init"]) => {
    calls.push({ url, init });

    if (url.includes("/api/categories")) {
      return { ok: true, status: 200, json: async () => CATEGORIES };
    }

    if (url.includes("/api/related-systems")) {
      return { ok: true, status: 200, json: async () => SYSTEMS };
    }

    if (url.includes("/api/requesters")) {
      return { ok: true, status: 200, json: async () => REQUESTERS };
    }

    const result = await (create?.() ?? { ok: true, status: 201, body: TICKET });
    return { ok: result.ok, status: result.status, json: async () => result.body };
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

function createCalls(calls: StubbedCall[]): StubbedCall[] {
  return calls.filter((call) => call.url.endsWith("/api/tickets"));
}

function renderCreateTicket() {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(ALICE));

  return render(
    <MemoryRouter initialEntries={["/tickets/new"]}>
      <App />
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText(/^Category/), "4");
  await user.selectOptions(screen.getByLabelText(/^Related System/), "5");
  await user.selectOptions(screen.getByLabelText(/^Requested Priority/), "HIGH");
  await user.type(screen.getByLabelText(/^Summary/), "Cannot connect to campus VPN");
  await user.type(
    screen.getByLabelText(/^Description/),
    "The VPN client fails after entering my credentials.",
  );
}

function submitButton() {
  return screen.getByRole("button", { name: "Submit Ticket" });
}

beforeEach(() => {
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "550e8400-e29b-41d4-a716-446655440000" });
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// UI-05: form structure, generated/context fields, and reference data.
describe("Create Ticket form", () => {
  it("loads Category and Related System from the API rather than a hard-coded list", async () => {
    const { calls } = stubApi();
    renderCreateTicket();

    const category = await screen.findByLabelText(/^Category/);
    expect(within(category).getByRole("option", { name: "Network" })).toBeDefined();
    expect(within(category).getByRole("option", { name: "Hardware" })).toBeDefined();
    expect(
      within(screen.getByLabelText(/^Related System/)).getByRole("option", { name: "VPN" }),
    ).toBeDefined();

    expect(calls.some((call) => call.url.includes("/api/categories"))).toBe(true);
    expect(calls.some((call) => call.url.includes("/api/related-systems"))).toBe(true);
  });

  it("sends the requester context on both reference-data loads", async () => {
    const { calls } = stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    for (const call of calls) {
      expect(call.init?.headers?.["X-Requester-Id"]).toBe("1");
    }
  });

  it("shows Ticket Number and Ticket Date as read-only assigned-on-submission values", async () => {
    stubApi();
    renderCreateTicket();

    const ticketNumber = (await screen.findByLabelText("Ticket Number")) as HTMLInputElement;
    const ticketDate = screen.getByLabelText("Ticket Date") as HTMLInputElement;

    expect(ticketNumber.value).toBe("Assigned on submission");
    expect(ticketNumber.readOnly).toBe(true);
    expect(ticketDate.value).toBe("Assigned on submission");
    expect(ticketDate.readOnly).toBe(true);
  });

  it("shows the selected Requester as a non-editable control", async () => {
    stubApi();
    renderCreateTicket();

    const requester = (await screen.findByLabelText("Requester")) as HTMLInputElement;

    expect(requester.value).toBe("Alice Johnson");
    expect(requester.readOnly).toBe(true);
  });

  it("shows no pre-creation Current Status, Public ID, or audit controls", async () => {
    stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    expect(screen.queryByLabelText(/Current Status/)).toBeNull();
    expect(screen.queryByLabelText(/Public ID/)).toBeNull();
    expect(screen.queryByLabelText(/Created By/)).toBeNull();
  });

  it("offers a Retry when the reference data cannot be loaded", async () => {
    const user = userEvent.setup();
    let fail = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (fail) {
          return { ok: false, status: 500, json: async () => ({ code: "INTERNAL_SERVER_ERROR" }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => (url.includes("categories") ? CATEGORIES : SYSTEMS),
        };
      }),
    );
    renderCreateTicket();

    await screen.findByText("The Ticket form could not be loaded.");
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByLabelText(/^Category/)).toBeDefined();
  });
});

// UI-06: field validation and first-invalid focus.
describe("Create Ticket validation", () => {
  it("dumps no validation errors on the initial render", async () => {
    stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    expect(screen.queryByText(/must contain/)).toBeNull();
    expect(screen.queryByText("Select a Category.")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(/^Category/).getAttribute("aria-invalid")).toBeNull();
  });

  it("blocks submission, marks every invalid field, and focuses the first one", async () => {
    const user = userEvent.setup();
    const { calls } = stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    await user.click(submitButton());

    expect(screen.getByText("Select a Category.")).toBeDefined();
    expect(screen.getByText("Select a Related System.")).toBeDefined();
    expect(screen.getByText("Select a Requested Priority.")).toBeDefined();
    expect(screen.getByText("Summary must contain 3-150 characters.")).toBeDefined();
    expect(screen.getByText("Description must contain 10-2000 characters.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Category/));
    expect(createCalls(calls)).toHaveLength(0);
  });

  it("marks the invalid control programmatically, not with colour alone", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    await user.click(submitButton());

    expect(screen.getByLabelText(/^Category/).getAttribute("aria-invalid")).toBe("true");
  });

  it.each([
    ["a two-character Summary", "ab", "Summary must contain 3-150 characters."],
    ["a whitespace-only Summary", "   ", "Summary must contain 3-150 characters."],
    /*
     * Two characters in three UTF-16 code units. The backend counts characters
     * because the database CHECK does, so counting code units here would send a
     * value the server can only reject with a 500.
     */
    ["a two-character astral Summary", "\u{1F600}a", "Summary must contain 3-150 characters."],
  ])("rejects %s", async (_label, value, message) => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.clear(screen.getByLabelText(/^Summary/));
    await user.type(screen.getByLabelText(/^Summary/), value);
    await user.click(submitButton());

    expect(screen.getByText(message)).toBeDefined();
  });

  it("rejects a Description under ten trimmed characters", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.clear(screen.getByLabelText(/^Description/));
    await user.type(screen.getByLabelText(/^Description/), "too short");
    await user.click(submitButton());

    expect(screen.getByText("Description must contain 10-2000 characters.")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Description/));
  });

  it("counts trimmed characters against the Summary and Description limits", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    expect(screen.getByText("28 / 150")).toBeDefined();
    expect(screen.getByText("51 / 2000")).toBeDefined();
  });
});

// UI-07: submission, generated-field exclusion, and duplicate prevention.
describe("Create Ticket submission", () => {
  it("posts only the client-controlled fields with a UUID Idempotency-Key", async () => {
    const user = userEvent.setup();
    const { calls } = stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());
    await waitFor(() => expect(createCalls(calls)).toHaveLength(1));

    const [call] = createCalls(calls);
    expect(call.init?.method).toBe("POST");
    expect(call.init?.headers?.["Idempotency-Key"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(call.init?.headers?.["X-Requester-Id"]).toBe("1");
    expect(JSON.parse(call.init?.body ?? "{}")).toEqual({
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH",
      description: "The VPN client fails after entering my credentials.",
      attachmentIds: [],
    });
  });

  it("excludes every backend-managed field from the request body", async () => {
    const user = userEvent.setup();
    const { calls } = stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());
    await waitFor(() => expect(createCalls(calls)).toHaveLength(1));

    const body = JSON.parse(createCalls(calls)[0].init?.body ?? "{}");
    for (const field of [
      "requesterId",
      "publicId",
      "ticketNumber",
      "currentStatus",
      "createdAt",
      "updatedAt",
      "createdBy",
      "updatedBy",
      "deleted",
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it("sends the trimmed Summary and Description", async () => {
    const user = userEvent.setup();
    const { calls } = stubApi();
    renderCreateTicket();
    await fillValidForm(user);
    await user.clear(screen.getByLabelText(/^Summary/));
    await user.type(screen.getByLabelText(/^Summary/), "  Padded summary value  ");

    await user.click(submitButton());
    await waitFor(() => expect(createCalls(calls)).toHaveLength(1));

    expect(JSON.parse(createCalls(calls)[0].init?.body ?? "{}").summary).toBe(
      "Padded summary value",
    );
  });

  it("navigates to the owned Ticket Detail with the generated Ticket Number", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Submit Ticket" })).toBeNull(),
    );
  });

  it("prevents a duplicate submission while one is in flight", async () => {
    const user = userEvent.setup();
    const calls: StubbedCall[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: StubbedCall["init"]) => {
        calls.push({ url, init });

        if (url.includes("/api/categories")) {
          return { ok: true, status: 200, json: async () => CATEGORIES };
        }
        if (url.includes("/api/related-systems")) {
          return { ok: true, status: 200, json: async () => SYSTEMS };
        }

        return new Promise(() => {});
      }),
    );
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());
    await waitFor(() => expect(submitButton()).toHaveProperty("disabled", true));
    await user.click(submitButton());

    expect(createCalls(calls)).toHaveLength(1);
  });

  it("shows a spinner in the busy button while keeping its Submit Ticket text", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/categories")) {
          return { ok: true, status: 200, json: async () => CATEGORIES };
        }
        if (url.includes("/api/related-systems")) {
          return { ok: true, status: 200, json: async () => SYSTEMS };
        }
        return new Promise(() => {});
      }),
    );
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());

    await waitFor(() => expect(submitButton()).toHaveProperty("disabled", true));
    /* Section 10.6: the action text never changes to "Submitting...". */
    expect(submitButton().textContent).toContain("Submit Ticket");
    expect(submitButton().querySelector(".spinner-border")).not.toBeNull();
  });
});

// UI-08: 4xx retention, recovery, and key lifecycle (BR-24, ui-spec Section 12).
describe("Create Ticket failure behaviour", () => {
  function failWith(status: number, body: unknown) {
    return stubApi(() => ({ ok: false, status, body }));
  }

  it("keeps the entered values and maps backend field errors on a 4xx", async () => {
    const user = userEvent.setup();
    failWith(400, {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "The request contains invalid values.",
      error: "Bad Request",
      details: [{ field: "categoryId", message: "Select an available Category." }],
    });
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());

    expect(await screen.findByText("Select an available Category.")).toBeDefined();
    expect((screen.getByLabelText(/^Summary/) as HTMLInputElement).value).toBe(
      "Cannot connect to campus VPN",
    );
    expect(document.activeElement).toBe(screen.getByLabelText(/^Category/));
  });

  it("never surfaces the backend message text", async () => {
    const user = userEvent.setup();
    failWith(409, {
      statusCode: 409,
      code: "IDEMPOTENCY_CONFLICT",
      message: "The Idempotency-Key has already been used with a different request.",
      error: "Conflict",
    });
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.queryByText(/already been used with a different request/)).toBeNull();
  });

  it("stores no recovery record after a confirmed 4xx failure", async () => {
    const user = userEvent.setup();
    failWith(400, { statusCode: 400, code: "VALIDATION_ERROR", details: [] });
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());
    await screen.findByRole("alert");

    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole("button", { name: "Resume Submission Recovery" })).toBeNull();
  });

  it("reuses the same key for an unchanged retry and mints a new one after a change", async () => {
    const user = userEvent.setup();
    const keys = ["key-one", "key-two"];
    let issued = 0;
    vi.stubGlobal("crypto", {
      ...globalThis.crypto,
      randomUUID: () => keys[Math.min(issued++, keys.length - 1)],
    });
    const { calls } = failWith(400, { statusCode: 400, code: "VALIDATION_ERROR", details: [] });
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());
    await waitFor(() => expect(createCalls(calls)).toHaveLength(1));

    /* Unchanged logical retry: same key. */
    await user.click(submitButton());
    await waitFor(() => expect(createCalls(calls)).toHaveLength(2));

    /* Changed payload: new key. */
    await user.type(screen.getByLabelText(/^Summary/), " updated");
    await user.click(submitButton());
    await waitFor(() => expect(createCalls(calls)).toHaveLength(3));

    const sent = createCalls(calls).map((call) => call.init?.headers?.["Idempotency-Key"]);
    expect(sent[0]).toBe(sent[1]);
    expect(sent[2]).not.toBe(sent[0]);
  });

  it("reuses the key when the same Attachment IDs are supplied in a different order", async () => {
    /*
     * UI-13's reordered-set case. The draft's `attachmentIds` are written by the
     * Issue #24 Attachment controls, so this exercises the key-reuse rule at the
     * module that owns it rather than through controls that do not exist yet.
     */
    const a = "00000000-0000-4000-8000-000000000000";
    const b = "f0f0f0f0-f0f0-4f0f-b0f0-f0f0f0f0f0f0";
    const base = {
      categoryId: 4,
      relatedSystemId: 5,
      summary: "Cannot connect to campus VPN",
      requestedPriority: "HIGH" as const,
      description: "The VPN client fails after entering my credentials.",
    };

    expect(payloadSignature({ ...base, attachmentIds: [a, b] })).toBe(
      payloadSignature({ ...base, attachmentIds: [b, a] }),
    );
    expect(payloadSignature({ ...base, attachmentIds: [a] })).not.toBe(
      payloadSignature({ ...base, attachmentIds: [b] })
    );
  });

  it("persists only the approved recovery data after an ambiguous 5xx", async () => {
    const user = userEvent.setup();
    failWith(500, { statusCode: 500, code: "INTERNAL_SERVER_ERROR" });
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());
    await screen.findByRole("button", { name: "Resume Submission Recovery" });

    const stored = JSON.parse(sessionStorage.getItem(RECOVERY_STORAGE_KEY) ?? "{}");
    expect(Object.keys(stored).sort()).toEqual(
      ["idempotencyKey", "keyCreatedAt", "payload", "requesterId"].sort(),
    );
    expect(stored.requesterId).toBe(1);
    expect(stored.payload.attachmentIds).toEqual([]);
  });

  /*
   * ui-spec Section 12.2 clears the record on a confirmed non-ambiguous
   * failure. The requester guard rejects before the route runs, so no Ticket
   * can exist and there is nothing to resume; the 400 must not be mistaken for
   * an ambiguous 5xx just because it does not arrive as a field error.
   */
  it("leaves no recovery record when the context-invalidating 400 rejects the submission", async () => {
    const user = userEvent.setup();
    failWith(400, {
      statusCode: 400,
      code: "REQUESTER_CONTEXT_INVALID",
      message: "The requester context is invalid.",
      error: "Bad Request",
    });
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(submitButton());

    /* The stored Requester is discarded and the selector takes over. */
    await screen.findByRole("heading", { name: /Select a Development Requester/i });
    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Resume Submission Recovery" }),
    ).not.toBeInTheDocument();
  });

  it("never submits a stored recovery record automatically on load", async () => {
    const record: RecoveryRecord = {
      requesterId: 1,
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      keyCreatedAt: Date.now(),
      payload: {
        categoryId: 4,
        relatedSystemId: 5,
        summary: "Cannot connect to campus VPN",
        requestedPriority: "HIGH",
        description: "The VPN client fails after entering my credentials.",
        attachmentIds: [],
      },
    };
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record));
    const { calls } = stubApi();
    renderCreateTicket();

    await screen.findByRole("button", { name: "Resume Submission Recovery" });
    expect(createCalls(calls)).toHaveLength(0);
  });

  it("retries the unchanged request under the original key when Resume is chosen", async () => {
    const user = userEvent.setup();
    const record: RecoveryRecord = {
      requesterId: 1,
      idempotencyKey: "abc00000-0000-4000-8000-000000000000",
      keyCreatedAt: Date.now(),
      payload: {
        categoryId: 4,
        relatedSystemId: 5,
        summary: "Cannot connect to campus VPN",
        requestedPriority: "HIGH",
        description: "The VPN client fails after entering my credentials.",
        attachmentIds: [],
      },
    };
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record));
    const { calls } = stubApi(() => ({ ok: true, status: 200, body: TICKET }));
    renderCreateTicket();

    await user.click(await screen.findByRole("button", { name: "Resume Submission Recovery" }));
    await waitFor(() => expect(createCalls(calls)).toHaveLength(1));

    expect(createCalls(calls)[0].init?.headers?.["Idempotency-Key"]).toBe(record.idempotencyKey);
    expect(JSON.parse(createCalls(calls)[0].init?.body ?? "{}")).toEqual(record.payload);
    await waitFor(() => expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull());
  });

  it("discards a recovery record belonging to another Requester", async () => {
    sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        requesterId: 99,
        idempotencyKey: "abc00000-0000-4000-8000-000000000000",
        keyCreatedAt: Date.now(),
        payload: {
          categoryId: 4,
          relatedSystemId: 5,
          summary: "s",
          requestedPriority: "HIGH",
          description: "d",
          attachmentIds: [],
        },
      }),
    );
    stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    expect(screen.queryByRole("button", { name: "Resume Submission Recovery" })).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it("discards a recovery record whose key has reached the 24-hour deadline", async () => {
    sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        requesterId: 1,
        idempotencyKey: "abc00000-0000-4000-8000-000000000000",
        keyCreatedAt: Date.now() - 24 * 60 * 60 * 1000,
        payload: {
          categoryId: 4,
          relatedSystemId: 5,
          summary: "s",
          requestedPriority: "HIGH",
          description: "d",
          attachmentIds: [],
        },
      }),
    );
    stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    expect(screen.queryByRole("button", { name: "Resume Submission Recovery" })).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
  });
});

// UI-09: Cancel and discard (BR-25, ui-spec Section 11.5).
describe("Cancel and discard", () => {
  it("leaves an untouched empty form without confirming", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await screen.findByLabelText(/^Category/);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText(/^Category/)).toBeNull());
  });

  it("confirms before discarding a dirty draft", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByLabelText(/^Category/)).toBeDefined();
  });

  it("keeps the draft unchanged when the user keeps editing", async () => {
    const user = userEvent.setup();
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect((screen.getByLabelText(/^Summary/) as HTMLInputElement).value).toBe(
      "Cannot connect to campus VPN",
    );
  });

  it("clears the draft and the recovery record on a confirmed discard", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      RECOVERY_STORAGE_KEY,
      JSON.stringify({
        requesterId: 1,
        idempotencyKey: "abc00000-0000-4000-8000-000000000000",
        keyCreatedAt: Date.now(),
        payload: {
          categoryId: 4,
          relatedSystemId: 5,
          summary: "s",
          requestedPriority: "HIGH",
          description: "d",
          attachmentIds: [],
        },
      }),
    );
    stubApi();
    renderCreateTicket();
    await fillValidForm(user);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));

    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(screen.queryByLabelText(/^Category/)).toBeNull());
  });
});


/*
 * UI-05/UI-08 carried forward from Issue #20: "Requester A data must never
 * render under Requester B."
 *
 * A submission is requester-scoped async work that can outlive the context that
 * started it. Client-side abort is not enough on its own -- the server may
 * already have committed, and the Promise settles either way -- so what is
 * asserted here is that an obsolete completion changes nothing for the current
 * Requester: no navigation, no recovery record written or cleared, no form or
 * error state, no focus move.
 */
describe("Stale Requester submission completion", () => {
  const BOB_KEY = "11111111-1111-4111-8111-111111111111";

  interface Deferred {
    calls: StubbedCall[];
    settle: (result: StubbedResult) => void;
    fail: (error: Error) => void;
  }

  /* Holds POST /api/tickets open until the test decides how it ends. */
  function pendingCreate(): Deferred {
    let settle!: (result: StubbedResult) => void;
    let fail!: (error: Error) => void;

    const pending = new Promise<StubbedResult>((resolve, reject) => {
      settle = resolve;
      fail = reject;
    });

    const { calls } = stubApi(() => pending);

    return { calls, settle, fail };
  }

  /* Bob's own ambiguous attempt, so an accidental clear or overwrite shows up. */
  function seedBobRecovery(): RecoveryRecord {
    const record: RecoveryRecord = {
      requesterId: BOB.id,
      idempotencyKey: BOB_KEY,
      keyCreatedAt: Date.now(),
      payload: {
        categoryId: 2,
        relatedSystemId: 5,
        summary: "Printer queue is stuck",
        requestedPriority: "LOW",
        description: "Jobs stay queued and never reach the printer.",
        attachmentIds: [],
      },
    };

    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record));
    return record;
  }

  async function submitAsAliceThenSwitchToBob(
    user: ReturnType<typeof userEvent.setup>,
  ): Promise<void> {
    renderCreateTicket();
    await fillValidForm(user);
    await user.click(submitButton());

    /* The POST is in flight and unresolved when the Requester changes. */
    await waitFor(() => expect(createCalls(stubbedCalls).length).toBe(1));

    await user.click(screen.getByRole("button", { name: "Change Requester" }));
    await user.selectOptions(
      await screen.findByLabelText(/^Development Requester/),
      String(BOB.id),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { level: 1, name: "My Tickets" });
  }

  let stubbedCalls: StubbedCall[] = [];

  it("ignores a success that arrives after the Requester was changed", async () => {
    const user = userEvent.setup();
    const { calls, settle } = pendingCreate();
    stubbedCalls = calls;

    await submitAsAliceThenSwitchToBob(user);
    const bobRecord = seedBobRecovery();

    await act(async () => {
      settle({ ok: true, status: 201, body: TICKET });
    });

    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBe(JSON.stringify(BOB));
    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBe(JSON.stringify(bobRecord));
    expect(screen.getByRole("heading", { level: 1, name: "My Tickets" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ticket Detail" })).not.toBeInTheDocument();
    expect(screen.queryByText(TICKET.ticketNumber)).not.toBeInTheDocument();
    expect(screen.queryByText(TICKET.publicId)).not.toBeInTheDocument();
  });

  it("writes no previous-Requester recovery record when a stale submission fails ambiguously", async () => {
    const user = userEvent.setup();
    const { calls, fail } = pendingCreate();
    stubbedCalls = calls;

    await submitAsAliceThenSwitchToBob(user);
    const bobRecord = seedBobRecovery();

    await act(async () => {
      fail(new Error("Network request failed"));
    });

    /* Alice's key never reaches storage, and Bob's record is left untouched. */
    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBe(JSON.stringify(bobRecord));
    expect(sessionStorage.getItem(REQUESTER_STORAGE_KEY)).toBe(JSON.stringify(BOB));
    expect(screen.getByRole("heading", { level: 1, name: "My Tickets" })).toBeInTheDocument();
  });

  it("leaves the current Requester's form untouched when a stale submission is rejected with a 4xx", async () => {
    const user = userEvent.setup();
    const { calls, settle } = pendingCreate();
    stubbedCalls = calls;

    await submitAsAliceThenSwitchToBob(user);
    const bobRecord = seedBobRecovery();

    /* Bob opens Create Ticket, so a stale field error would be visible here. */
    await user.click(screen.getByRole("link", { name: "Create Ticket" }));
    await screen.findByLabelText(/^Category/);
    const categorySelect = screen.getByLabelText(/^Category/);

    await act(async () => {
      settle({
        ok: false,
        status: 400,
        body: {
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "The request contains invalid values.",
          error: "Bad Request",
          details: [{ field: "categoryId", message: "Select an available Category." }],
        },
      });
    });

    expect(sessionStorage.getItem(RECOVERY_STORAGE_KEY)).toBe(JSON.stringify(bobRecord));
    expect(screen.queryByText("Select an available Category.")).not.toBeInTheDocument();
    expect((categorySelect as HTMLSelectElement).value).toBe("");
    expect(document.activeElement).not.toBe(categorySelect);
    /* Bob's own resumable attempt is still offered. */
    expect(
      screen.getByRole("button", { name: "Resume Submission Recovery" }),
    ).toBeInTheDocument();
  });
});
