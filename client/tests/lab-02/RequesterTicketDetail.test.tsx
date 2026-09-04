import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useNavigate } from "react-router-dom";

import App from "../../src/App.js";
import { REQUESTER_STORAGE_KEY, StoredRequester } from "../../src/requester/requesterStorage.js";

/*
 * UI-23, UI-24, UI-32, UI-36, and UI-37 (FR-21-23, AC-22, AC-38-39, AC-66).
 *
 * Ownership itself is a server contract and is covered by
 * `server/tests/lab-02/ticket-detail.api.test.ts`; what the page owes is the
 * read-only presentation and the page-level failure routing.
 */

const ALICE: StoredRequester = { id: 1, name: "Alice Example" };
const PUBLIC_ID = "0f0e8a9f-6d9e-4a1a-9f0e-1b2c3d4e5f60";

const ACTIVE_ATTACHMENT = {
  attachmentId: "eb87467e-b209-4a18-bbc6-c8c5a4dccf95",
  ticketPublicId: PUBLIC_ID,
  originalName: "vpn-error.png",
  extension: "png",
  mimeType: "image/png",
  sizeBytes: 281304,
  removalReason: null,
  createdBy: "alice@example.com",
  createdAt: "2026-08-20T02:00:00.000Z",
  updatedBy: "alice@example.com",
  updatedAt: "2026-08-20T02:00:00.000Z",
  deleted: false,
};

const REMOVED_ATTACHMENT = {
  ...ACTIVE_ATTACHMENT,
  attachmentId: "11111111-1111-4111-8111-111111111111",
  originalName: "superseded-log.txt",
  extension: "txt",
  mimeType: "text/plain",
  sizeBytes: 4096,
  removalReason: "Replaced by a newer capture.",
  deleted: true,
};

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    publicId: PUBLIC_ID,
    ticketNumber: "TKT-20260820-A81F3C9D7B21",
    requesterId: ALICE.id,
    requesterName: "Alice Example",
    requesterEmail: "alice@example.com",
    categoryId: 1,
    categoryName: "Network",
    relatedSystemId: 5,
    relatedSystemName: "VPN",
    summary: "VPN disconnects every ten minutes",
    description: "The VPN client drops the tunnel roughly ten minutes after connecting.",
    requestedPriority: "HIGH",
    currentStatus: "NEW",
    attachments: [ACTIVE_ATTACHMENT, REMOVED_ATTACHMENT],
    createdBy: "alice@example.com",
    createdAt: "2026-08-20T02:00:00.000Z",
    updatedBy: "alice@example.com",
    updatedAt: "2026-08-21T02:00:00.000Z",
    deleted: false,
  };
}

interface DetailResult {
  ok?: boolean;
  status?: number;
  body?: unknown;
}

interface StubbedCall {
  url: string;
  init?: { headers?: Record<string, string> };
}

function stubApi(detail: () => DetailResult = () => ({ body: ticket() })) {
  const calls: StubbedCall[] = [];

  const fetchMock = vi.fn(async (url: string, init?: StubbedCall["init"]) => {
    calls.push({ url, init });

    /* My Tickets is the route creation navigates away from, and it loads these. */
    if (
      url.includes("/api/requesters") ||
      url.includes("/api/categories") ||
      url.includes("/api/related-systems") ||
      url.includes("/api/tickets?")
    ) {
      return { ok: true, status: 200, headers: new Headers(), json: async () => [] };
    }

    const result = detail();

    return {
      ok: result.ok ?? true,
      status: result.status ?? 200,
      headers: new Headers(),
      json: async () => result.body ?? {},
    };
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls };
}

function errorBody(statusCode: number, code: string) {
  return { statusCode, code, message: "Backend detail that must never reach the screen.", error: code };
}

function renderDetail(requester: StoredRequester | null = ALICE) {
  if (requester) {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(requester));
  }

  return render(
    <MemoryRouter initialEntries={[`/tickets/${PUBLIC_ID}`]}>
      <App />
    </MemoryRouter>,
  );
}

/* Creation navigates with router state, so the test has to arrive the same way. */
function CreationNavigationButton({ ticketNumber }: { ticketNumber: string }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/tickets/${PUBLIC_ID}`, { state: { created: true, ticketNumber } })}
    >
      Finish creation
    </button>
  );
}

async function renderAfterCreation(ticketNumber = "TKT-20260820-A81F3C9D7B21") {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(ALICE));

  render(
    <MemoryRouter initialEntries={["/tickets"]}>
      <CreationNavigationButton ticketNumber={ticketNumber} />
      <App />
    </MemoryRouter>,
  );

  await userEvent.click(screen.getByRole("button", { name: "Finish creation" }));
}

function fieldValue(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

beforeEach(() => {
  stubApi();
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("UI-23 read-only Ticket Detail", () => {
  it("renders every required field with its value", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" })).toBeInTheDocument();

    expect(fieldValue("Ticket Number")).toHaveValue("TKT-20260820-A81F3C9D7B21");
    /* `createdAt` is the authoritative Ticket Date, on the Asia/Bangkok calendar. */
    expect(fieldValue("Ticket Date")).toHaveValue("2026-08-20");
    expect(fieldValue("Current Status")).toHaveValue("NEW");
    expect(fieldValue("Requested Priority")).toHaveValue("HIGH");
    expect(fieldValue("Requester Name")).toHaveValue("Alice Example");
    expect(fieldValue("Requester Email")).toHaveValue("alice@example.com");
    expect(fieldValue("Category")).toHaveValue("Network");
    expect(fieldValue("Related System")).toHaveValue("VPN");
    expect(fieldValue("Summary")).toHaveValue("VPN disconnects every ten minutes");
    expect(fieldValue("Description")).toHaveValue(
      "The VPN client drops the tunnel roughly ten minutes after connecting.",
    );
    expect(fieldValue("Created By")).toHaveValue("alice@example.com");
    expect(fieldValue("Updated By")).toHaveValue("alice@example.com");
    /* An audit instant keeps its time of day; the Ticket Date does not. */
    expect(fieldValue("Last Updated")).toHaveValue("2026-08-21, 09:00");
  });

  it("sends the Requester context with the detail request", async () => {
    const { calls } = stubApi();
    renderDetail();

    await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" });

    const detail = calls.find((call) => call.url.includes(`/api/tickets/${PUBLIC_ID}`));
    expect(detail?.init?.headers?.["X-Requester-Id"]).toBe("1");
  });

  it("keeps every value read-only rather than disabled, so it stays reachable", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" });

    for (const label of ["Ticket Number", "Current Status", "Summary", "Description"]) {
      const field = fieldValue(label);
      expect(field).toHaveAttribute("readonly");
      expect(field).not.toBeDisabled();
    }
  });

  it("announces the loaded Ticket and offers a real Back link", async () => {
    renderDetail();

    expect(screen.getByRole("status")).toHaveTextContent("Loading ticket…");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Ticket TKT-20260820-A81F3C9D7B21 loaded."),
    );

    expect(screen.getByRole("link", { name: "Back to My Tickets" })).toHaveAttribute("href", "/tickets");
  });

  it("exposes no workflow, assignment, or deletion control", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" });

    for (const forbidden of [/comment/i, /internal note/i, /action taken/i, /assign/i, /resolve/i, /close/i, /reopen/i, /cancel/i, /delete/i, /^save$/i, /^edit$/i]) {
      expect(screen.queryByRole("button", { name: forbidden })).not.toBeInTheDocument();
    }
  });
});

describe("Ticket Detail after creation", () => {
  it("shows the generated Ticket Number and a non-intrusive confirmation", async () => {
    await renderAfterCreation();

    const confirmations = await screen.findAllByRole("status");
    expect(
      confirmations.some((node) => node.textContent?.includes("Ticket TKT-20260820-A81F3C9D7B21 was created.")),
    ).toBe(true);

    expect(screen.getByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" })).toBeInTheDocument();
  });

  /*
   * `location.state` lives in the history entry, so a reload or a Back into it
   * hands the creation state back long after the creation (ui-spec Section
   * 27.1 applies the same rule to `/error`).
   */
  it("shows no confirmation when the entry is restored rather than navigated to", async () => {
    sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(ALICE));

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: `/tickets/${PUBLIC_ID}`,
            state: { created: true, ticketNumber: "TKT-20260820-A81F3C9D7B21" },
          },
        ]}
      >
        <App />
      </MemoryRouter>,
    );

    await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" });

    expect(screen.queryByText(/was created/)).not.toBeInTheDocument();
  });

  it("rejects creation state whose Ticket Number does not match the loaded Ticket", async () => {
    await renderAfterCreation("TKT-20260820-FFFFFFFFFFFF");

    expect(await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" })).toBeInTheDocument();
    expect(screen.queryByText(/was created/)).not.toBeInTheDocument();
    expect(screen.queryByText(/FFFFFFFFFFFF/)).not.toBeInTheDocument();
  });

  it("shows no confirmation on a plain visit", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" });

    expect(screen.queryByText(/was created/)).not.toBeInTheDocument();
  });
});

describe("UI-36 Attachment metadata on Ticket Detail", () => {
  it("counts only active Attachments against the limit", async () => {
    renderDetail();

    expect(await screen.findByRole("heading", { name: "Attachments 1/5" })).toBeInTheDocument();
  });

  it("distinguishes Active from Removed by visible text", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Attachments 1/5" });

    const active = screen.getByText("vpn-error.png").closest("tr") as HTMLElement;
    const removed = screen.getByText("superseded-log.txt").closest("tr") as HTMLElement;

    expect(within(active).getByText("Active")).toBeInTheDocument();
    /* Decimal units: ui-spec Section 22.3 states the 5,000,000-byte limit as 5 MB. */
    expect(within(active).getByText("281.3 KB")).toBeInTheDocument();
    expect(within(active).getByText("2026-08-20, 09:00")).toBeInTheDocument();
    expect(within(removed).getByText("Removed")).toBeInTheDocument();
    expect(within(removed).getByText("4.1 KB")).toBeInTheDocument();
  });

  /* ui-spec Section 26: a Removed row keeps its metadata and loses its controls. */
  it("shows the removal reason and no controls on a Removed row", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Attachments 1/5" });

    const removed = screen.getByText("superseded-log.txt").closest("tr") as HTMLElement;

    expect(within(removed).getByText("Removal reason: Replaced by a newer capture.")).toBeInTheDocument();
    expect(within(removed).queryByRole("button")).not.toBeInTheDocument();
    expect(within(removed).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  /*
   * Issue #24 landed the behavior this case used to assert was absent. The page
   * now mounts the shared Attachment card, so what it owes is the wiring: the
   * Add control, and controls on the Active row only. The behavior itself is
   * `AttachmentSection.test.tsx`.
   */
  it("mounts the Attachment controls on the Active row only", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Attachments 1/5" });

    expect(screen.getByLabelText("Add Attachment")).toBeEnabled();

    const active = screen.getByText("vpn-error.png").closest("tr") as HTMLElement;
    expect(within(active).getByRole("button", { name: "Preview vpn-error.png" })).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Download vpn-error.png" })).toBeInTheDocument();
    expect(within(active).getByRole("checkbox", { name: "Select vpn-error.png" })).toBeInTheDocument();

    /* Still read-only in every other respect (FR-22). */
    expect(screen.queryByRole("button", { name: /edit|assign|transition|comment/i })).not.toBeInTheDocument();
  });
});

describe("UI-24 Ticket Detail page-level failures", () => {
  it.each([
    [404, "NOT_FOUND", "Page not found.", "The requested resource could not be found."],
    [403, "FORBIDDEN", "Unable to open this page.", "You do not have access to the requested resource."],
    [500, "INTERNAL_SERVER_ERROR", "Something went wrong.", "Please try again later."],
  ])("routes a %s to the standalone error page", async (status, code, title, message) => {
    stubApi(() => ({ ok: false, status, body: errorBody(status, code) }));
    renderDetail();

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByText(String(status))).toBeInTheDocument();

    /* Section 27: standalone, and never carrying backend text. */
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText(/Backend detail/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });

  it("treats a transport failure as the generic 500 page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/requesters")) {
          return { ok: true, status: 200, headers: new Headers(), json: async () => [] };
        }

        throw new TypeError("Failed to fetch");
      }),
    );

    renderDetail();

    expect(await screen.findByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/tickets");
  });
});

describe("UI-23 the Ticket Detail header (ui-spec 11.1, 20.1)", () => {
  /*
   * The Ticket Number is the heading and carries the data treatment; "Ticket
   * Detail" moves above it as an eyebrow rather than below it as a subtitle, so
   * the page states what it is before it states which Ticket.
   */
  it("puts the Ticket Detail eyebrow above the ticket-number heading", async () => {
    renderDetail();

    const heading = await screen.findByRole("heading", { name: "TKT-20260820-A81F3C9D7B21" });
    const eyebrow = screen.getByText("Ticket Detail");

    expect(heading).toHaveClass("tt-ticket-no");
    expect(eyebrow.tagName).toBe("P");
    expect(
      eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
