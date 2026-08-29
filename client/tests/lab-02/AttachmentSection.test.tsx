import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import App from "../../src/App.js";
import { REQUESTER_STORAGE_KEY, StoredRequester } from "../../src/requester/requesterStorage.js";
import {
  ATTACHMENT_TIMEOUT_MS,
  MAX_ATTACHMENT_BYTES,
} from "../../src/attachments/attachmentRules.js";

/*
 * UI-25 to UI-30, UI-34, and the Attachment halves of UI-36 and UI-37.
 *
 * The card is shared, so both screens are driven here: Create Ticket for the
 * client-local upload states and the submit gate, Ticket Detail for the
 * persisted lifecycle, selection, and batch removal. Ownership and the
 * all-or-nothing guarantee itself are server contracts and are proved in
 * `server/tests/lab-02/attachments.api.test.ts`; what the UI owes is that it
 * never draws an outcome the backend did not commit.
 */

const ALICE: StoredRequester = { id: 1, name: "Alice Example" };
const PUBLIC_ID = "0f0e8a9f-6d9e-4a1a-9f0e-1b2c3d4e5f60";
const PENDING_ID = "eb87467e-b209-4a18-bbc6-c8c5a4dccf95";
const DIRECT_ID = "33333333-3333-4333-8333-333333333333";

function attachment(overrides: Record<string, unknown> = {}) {
  return {
    attachmentId: PENDING_ID,
    ticketPublicId: null,
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
    ...overrides,
  };
}

const ACTIVE = attachment({ ticketPublicId: PUBLIC_ID });
const SECOND_ACTIVE = attachment({
  attachmentId: "22222222-2222-4222-8222-222222222222",
  ticketPublicId: PUBLIC_ID,
  originalName: "router-log.pdf",
  extension: "pdf",
  mimeType: "application/pdf",
  sizeBytes: 20480,
});
const REMOVED = attachment({
  attachmentId: "11111111-1111-4111-8111-111111111111",
  ticketPublicId: PUBLIC_ID,
  originalName: "superseded-log.pdf",
  extension: "pdf",
  mimeType: "application/pdf",
  sizeBytes: 4096,
  removalReason: "Replaced by a newer capture.",
  deleted: true,
});

function ticket(attachments: unknown[] = [ACTIVE, REMOVED]) {
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
    attachments,
    createdBy: "alice@example.com",
    createdAt: "2026-08-20T02:00:00.000Z",
    updatedBy: "alice@example.com",
    updatedAt: "2026-08-21T02:00:00.000Z",
    deleted: false,
  };
}

interface StubbedCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

interface StubOptions {
  detailAttachments?: unknown[];
  upload?: () => { ok?: boolean; status?: number; body?: unknown };
  /* Non-2xx status for the collection endpoint; omitted means 204. */
  collectionStatus?: number;
  /* Non-2xx status for POST /api/tickets; omitted means a created Ticket. */
  createStatus?: number;
  binaryOk?: boolean;
  /* Held pre-uploads: every POST /api/attachments waits on this before it answers. */
  uploadGate?: Promise<void>;
}

const MASTER_DATA = [{ id: 1, name: "Network", isActive: true, deleted: false }];

/*
 * One hand-rolled fetch double, as every other lab-02 UI suite uses: the repo
 * has no MSW, and routing on the URL keeps the calls inspectable for the header
 * and body assertions the contract actually turns on.
 */
function stubApi(options: StubOptions = {}) {
  const calls: StubbedCall[] = [];
  const blobReads: string[] = [];
  const directAttachments: unknown[] = [];
  let uploadCount = 0;

  const fetchMock = vi.fn(
    async (url: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body, headers: init?.headers ?? {} });

      const ok = (body: unknown, status = 200) => ({
        ok: true,
        status,
        headers: new Headers(),
        json: async () => body,
        blob: async () => {
          blobReads.push(url);
          return new Blob(["bytes"]);
        },
      });

      const failure = (status: number, code: string) => ({
        ok: false,
        status,
        headers: new Headers(),
        json: async () => ({ statusCode: status, code, message: "Never rendered.", error: code }),
        /* Reading this would mean the response was not checked first. */
        blob: async () => {
          blobReads.push(url);
          return new Blob([]);
        },
      });

      if (url.includes("/api/categories") || url.includes("/api/related-systems")) {
        return ok(MASTER_DATA);
      }

      if (url.includes("/api/requesters") || url.includes("/api/tickets?")) {
        return ok([]);
      }

      if (url.includes("/api/attachments/collection")) {
        return options.collectionStatus === undefined
          ? { ok: true, status: 204, headers: new Headers(), json: async () => ({}) }
          : failure(
              options.collectionStatus,
              options.collectionStatus === 400 ? "VALIDATION_ERROR" : "CONFLICT",
            );
      }

      if (url.includes("/preview") || url.includes("/download")) {
        return options.binaryOk === false ? failure(410, "GONE") : ok({});
      }

      if (method === "POST" && url.includes("/attachments")) {
        if (options.uploadGate !== undefined) {
          await options.uploadGate;
        }

        const result = options.upload?.() ?? {};

        if (result.ok === false) {
          return failure(result.status ?? 500, "INTERNAL_SERVER_ERROR");
        }

        /*
         * Echo the uploaded file, the way the backend does. A stub that always
         * answered with one fixture name would rename every row to it, and the
         * per-file assertions would silently be about the same row.
         */
        const uploaded = init?.body instanceof FormData ? init.body.get("file") : null;
        const originalName = uploaded instanceof File ? uploaded.name : "vpn-error.png";
        const sizeBytes = uploaded instanceof File ? uploaded.size : 12;

        uploadCount += 1;

        const responseAttachment =
          result.body ??
          attachment({
              attachmentId:
                url.includes("/api/tickets/")
                  ? DIRECT_ID
                  : uploadCount === 1
                  ? PENDING_ID
                  : `0000000${uploadCount}-0000-4000-8000-00000000000${uploadCount}`,
              ticketPublicId: url.includes("/api/tickets/") ? PUBLIC_ID : null,
              originalName,
              sizeBytes,
              extension: originalName.split(".").pop() ?? "png",
            });

        if (url.includes("/api/tickets/")) {
          directAttachments.push(responseAttachment);
        }

        return ok(responseAttachment, 201);
      }

      if (method === "POST" && url.includes("/api/tickets")) {
        return options.createStatus === undefined
          ? ok(ticket(), 201)
          : failure(options.createStatus, "INTERNAL_SERVER_ERROR");
      }

      return ok(ticket([...(options.detailAttachments ?? [ACTIVE, REMOVED]), ...directAttachments]));
    },
  );

  vi.stubGlobal("fetch", fetchMock);
  return { calls, blobReads };
}

function pngFile(name = "vpn-error.png", size = 12): File {
  const file = new File([new Uint8Array(size)], name, { type: "image/png" });

  /* jsdom sizes a File from its parts; the boundary cases need exact sizes. */
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function renderAt(path: string) {
  sessionStorage.setItem(REQUESTER_STORAGE_KEY, JSON.stringify(ALICE));

  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function rowFor(name: string): HTMLElement {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

const createdUrls: string[] = [];
const revokedUrls: string[] = [];

/*
 * jsdom implements neither object-URL method, and the Blob URL lifecycle is
 * exactly what UI-34 is about. They are added to the real `URL` rather than
 * swapped for a stand-in object: replacing `URL` wholesale also replaces the
 * constructor the router and the API client use.
 */
type ObjectUrlMethods = {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
};

(URL as ObjectUrlMethods).createObjectURL = (): string => {
  const url = `blob:mock/${createdUrls.length}`;
  createdUrls.push(url);
  return url;
};
(URL as ObjectUrlMethods).revokeObjectURL = (url: string) => {
  revokedUrls.push(url);
};

beforeEach(() => {
  createdUrls.length = 0;
  revokedUrls.length = 0;
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("UI-25 per-file Attachment lifecycle on Create Ticket", () => {
  it("takes a valid selection from Uploading to Pending", async () => {
    stubApi();
    renderAt("/tickets/new");

    const input = await screen.findByLabelText("Add Attachment");
    await userEvent.upload(input, pngFile());

    const row = rowFor("vpn-error.png");
    await waitFor(() => expect(within(row).getByText("Pending")).toBeInTheDocument());
  });

  it.each([
    ["4,999,999 bytes", MAX_ATTACHMENT_BYTES - 1, "Pending"],
    ["5,000,000 bytes", MAX_ATTACHMENT_BYTES, "Pending"],
    ["5,000,001 bytes", MAX_ATTACHMENT_BYTES + 1, "Invalid"],
  ])("treats %s as %s", async (_label, size, state) => {
    const { calls } = stubApi();
    renderAt("/tickets/new");

    const input = await screen.findByLabelText("Add Attachment");
    await userEvent.upload(input, pngFile("boundary.png", size));

    const row = rowFor("boundary.png");
    await waitFor(() => expect(within(row).getByText(state)).toBeInTheDocument());

    /* An Invalid file never leaves the browser. */
    const uploads = calls.filter((call) => call.method === "POST" && call.url.endsWith("/api/attachments"));
    expect(uploads).toHaveLength(state === "Invalid" ? 0 : 1);
  });

  it("marks an unsupported file Invalid without holding back its valid sibling", async () => {
    stubApi();
    renderAt("/tickets/new");

    const input = await screen.findByLabelText("Add Attachment");
    /* `applyAccept` off: the point is what the card does with a file the accept
     * filter would have hidden, and a real picker can be bypassed. */
    await userEvent.upload(input, [pngFile("good.png"), pngFile("malware.exe")], {
      applyAccept: false,
    });

    await waitFor(() => expect(within(rowFor("good.png")).getByText("Pending")).toBeInTheDocument());
    expect(within(rowFor("malware.exe")).getByText("Invalid")).toBeInTheDocument();
    expect(
      within(rowFor("malware.exe")).getByText(/Unsupported file type/i),
    ).toBeInTheDocument();
  });

  it("offers Retry on a failed upload and reaches Pending on the second attempt", async () => {
    let attempt = 0;
    stubApi({
      upload: () => {
        attempt += 1;
        return attempt === 1 ? { ok: false, status: 500 } : {};
      },
    });
    renderAt("/tickets/new");

    const input = await screen.findByLabelText("Add Attachment");
    await userEvent.upload(input, pngFile());

    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Failed")).toBeInTheDocument());

    await userEvent.click(within(rowFor("vpn-error.png")).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());
  });

  it("blocks Submit while a file is unresolved and releases it once it is removed", async () => {
    stubApi({ upload: () => ({ ok: false, status: 500 }) });
    renderAt("/tickets/new");

    const submit = await screen.findByRole("button", { name: "Submit Ticket" });
    expect(submit).toBeEnabled();

    const input = screen.getByLabelText("Add Attachment");
    await userEvent.upload(input, pngFile());

    await waitFor(() => expect(submit).toBeDisabled());

    await userEvent.click(
      within(rowFor("vpn-error.png")).getByRole("button", { name: "Remove vpn-error.png" }),
    );

    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("sends the prepared Pending IDs with the Ticket-create payload", async () => {
    const { calls } = stubApi();
    renderAt("/tickets/new");

    await userEvent.upload(await screen.findByLabelText("Add Attachment"), pngFile());
    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Requested Priority/), "HIGH");
    await userEvent.type(screen.getByLabelText(/^Summary/), "VPN keeps dropping");
    await userEvent.type(
      screen.getByLabelText(/^Description/),
      "The VPN tunnel drops about ten minutes after it connects.",
    );

    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await waitFor(() => {
      const create = calls.find((call) => call.method === "POST" && call.url.endsWith("/api/tickets"));
      expect(JSON.parse(String(create?.body)).attachmentIds).toEqual([PENDING_ID]);
    });
  });
});

describe("UI-10 Pending rows survive a Ticket-create 4xx", () => {
  it("keeps the prepared rows and their IDs on the form after a rejected submit", async () => {
    const { calls } = stubApi();
    /* The create call is the only one that fails; the pre-upload still works. */
    const realFetch = globalThis.fetch as unknown as (...args: unknown[]) => Promise<unknown>;
    vi.stubGlobal("fetch", async (url: string, init?: { method?: string }) => {
      if (init?.method === "POST" && String(url).endsWith("/api/tickets")) {
        calls.push({ url: String(url), method: "POST", body: undefined, headers: {} });
        return {
          ok: false,
          status: 400,
          headers: new Headers(),
          json: async () => ({
            statusCode: 400,
            code: "VALIDATION_ERROR",
            message: "Never rendered.",
            error: "Bad Request",
            details: [{ field: "summary", message: "Summary must contain 3-150 characters." }],
          }),
        };
      }

      return realFetch(url, init);
    });

    renderAt("/tickets/new");

    await userEvent.upload(await screen.findByLabelText("Add Attachment"), pngFile());
    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Requested Priority/), "HIGH");
    await userEvent.type(screen.getByLabelText(/^Summary/), "VPN keeps dropping");
    await userEvent.type(
      screen.getByLabelText(/^Description/),
      "The VPN tunnel drops about ten minutes after it connects.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await waitFor(() =>
      expect(calls.some((call) => call.method === "POST" && call.url.endsWith("/api/tickets"))).toBe(
        true,
      ),
    );

    /*
     * A 4xx is a confirmed failure with nothing committed, so the prepared rows
     * are still the user's: they must not be dropped, re-uploaded, or cleaned up.
     */
    expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments 1/5" })).toBeInTheDocument();
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
    expect(
      calls.filter((call) => call.method === "POST" && call.url.endsWith("/api/attachments")),
    ).toHaveLength(1);
  });
});

describe("UI-11 compensation after an ambiguous Ticket-create 5xx", () => {
  async function submitWith(options: StubOptions) {
    const { calls } = stubApi(options);
    renderAt("/tickets/new");

    await userEvent.upload(await screen.findByLabelText("Add Attachment"), pngFile());
    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText(/^Category/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Related System/), "1");
    await userEvent.selectOptions(screen.getByLabelText(/^Requested Priority/), "HIGH");
    await userEvent.type(screen.getByLabelText(/^Summary/), "VPN keeps dropping");
    await userEvent.type(
      screen.getByLabelText(/^Description/),
      "The VPN tunnel drops about ten minutes after it connects.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit Ticket" }));

    return calls;
  }

  function cleanupCall(calls: StubbedCall[]) {
    return calls.find((call) => call.method === "DELETE");
  }

  it("releases the prepared rows with an empty reason each and never invents one", async () => {
    const calls = await submitWith({ createStatus: 500 });

    await waitFor(() => expect(cleanupCall(calls)).toBeDefined());

    /*
     * The empty reason is the safety mechanism: the backend ignores it for a
     * Pending row and refuses it for an Active one, so the client never has to
     * guess a lifecycle state or invent an Active-removal reason.
     */
    const items = JSON.parse(String(cleanupCall(calls)?.body)).items as {
      attachmentId: string;
      reason: string;
    }[];
    expect(items).toEqual([{ attachmentId: PENDING_ID, reason: "" }]);
  });

  it("offers Retry Upload and drops the recovery record when the release is confirmed", async () => {
    await submitWith({ createStatus: 500 });

    const row = await waitFor(() => {
      const found = rowFor("vpn-error.png");
      expect(within(found).getByText("Failed")).toBeInTheDocument();
      return found;
    });

    expect(within(row).getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(within(row).getByText(/Retry Upload to attach it again/)).toBeInTheDocument();

    /*
     * A confirmed release means the rows were still Pending, so the create never
     * bound them and nothing is left to resume.
     */
    expect(screen.queryByRole("button", { name: "Resume Submission Recovery" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The Ticket was not created. Retry the uploads shown below, then submit again.",
    );

    /* Submit stays blocked until the released file is retried or removed. */
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toBeDisabled();
  });

  it("keeps the rows Pending and the recovery record when the release is refused", async () => {
    /* 400: at least one row is Active, so the create did commit after all. */
    const calls = await submitWith({ createStatus: 500, collectionStatus: 400 });

    await waitFor(() => expect(cleanupCall(calls)).toBeDefined());

    expect(
      await screen.findByRole("button", { name: "Resume Submission Recovery" }),
    ).toBeInTheDocument();
    expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The Ticket submission did not complete. Use Resume Submission Recovery to retry it.",
    );
  });

  it("keeps the non-file fields either way", async () => {
    await submitWith({ createStatus: 500 });

    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Failed")).toBeInTheDocument());

    expect(screen.getByLabelText(/^Summary/)).toHaveValue("VPN keeps dropping");
    expect(screen.getByLabelText(/^Description/)).toHaveValue(
      "The VPN tunnel drops about ten minutes after it connects.",
    );
  });
});

describe("UI-26 the x/5 count and the Add control", () => {
  it("counts only Active Attachments and excludes Removed ones", async () => {
    stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    expect(await screen.findByRole("heading", { name: "Attachments 1/5" })).toBeInTheDocument();
  });

  it("disables Add at 5/5 and adds no explanatory paragraph", async () => {
    const active = [0, 1, 2, 3, 4].map((index) =>
      attachment({
        attachmentId: `0000000${index}-0000-4000-8000-00000000000${index}`,
        ticketPublicId: PUBLIC_ID,
        originalName: `evidence-${index}.png`,
      }),
    );
    stubApi({ detailAttachments: [...active, REMOVED] });
    renderAt(`/tickets/${PUBLIC_ID}`);

    expect(await screen.findByRole("heading", { name: "Attachments 5/5" })).toBeInTheDocument();
    expect(screen.getByLabelText("Add Attachment")).toBeDisabled();
    expect(screen.queryByText(/maximum of 5 active attachments reached/i)).not.toBeInTheDocument();
  });

  it("re-reads the Ticket after a successful direct upload", async () => {
    const { calls } = stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.upload(screen.getByLabelText("Add Attachment"), pngFile("added.png"));

    await waitFor(() => {
      expect(
        calls.some(
          (call) => call.method === "POST" && call.url.endsWith(`/api/tickets/${PUBLIC_ID}/attachments`),
        ),
      ).toBe(true);
    });

    /* Two detail reads: the initial load and the re-read after the upload. */
    await waitFor(() => {
      const detailReads = calls.filter(
        (call) => call.method === "GET" && call.url.endsWith(`/api/tickets/${PUBLIC_ID}`),
      );
      expect(detailReads.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows a direct upload as a per-file Uploading row", async () => {
    let releaseUpload: (() => void) | undefined;
    const uploadGate = new Promise<void>((resolve) => {
      releaseUpload = resolve;
    });

    stubApi({ uploadGate });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.upload(screen.getByLabelText("Add Attachment"), pngFile("added.png"));

    expect(within(rowFor("added.png")).getByText("Uploading")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments 1/5" })).toBeInTheDocument();

    releaseUpload?.();
    await waitFor(() => expect(within(rowFor("added.png")).getByText("Active")).toBeInTheDocument());
  });

  it("keeps a failed direct upload as a retryable per-file row", async () => {
    let attempt = 0;
    stubApi({
      upload: () => {
        attempt += 1;
        return attempt === 1 ? { ok: false, status: 500 } : {};
      },
    });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.upload(screen.getByLabelText("Add Attachment"), pngFile("added.png"));

    const failedRow = rowFor("added.png");
    await waitFor(() => expect(within(failedRow).getByText("Failed")).toBeInTheDocument());

    await userEvent.click(within(failedRow).getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(within(rowFor("added.png")).getByText("Active")).toBeInTheDocument());
  });

  it("keeps an invalid direct selection as a removable per-file row", async () => {
    stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.upload(screen.getByLabelText("Add Attachment"), pngFile("malware.exe"), {
      applyAccept: false,
    });

    const invalidRow = rowFor("malware.exe");
    expect(within(invalidRow).getByText("Invalid")).toBeInTheDocument();
    await userEvent.click(
      within(invalidRow).getByRole("button", { name: "Remove malware.exe" }),
    );
    expect(screen.queryByText("malware.exe")).not.toBeInTheDocument();
  });
});

describe("UI-27 and UI-34 preview, download, and the Blob URL lifecycle", () => {
  it("opens the preview in a modal built from a fetched Blob", async () => {
    const { calls } = stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.click(screen.getByRole("button", { name: "Preview vpn-error.png" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "vpn-error.png" })).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByAltText("Preview of vpn-error.png")).toHaveAttribute(
        "src",
        createdUrls[0],
      ),
    );
    expect(within(dialog).getByRole("button", { name: "Download" })).toBeInTheDocument();

    const preview = calls.find((call) => call.url.includes("/preview"));
    expect(preview?.headers["X-Requester-Id"]).toBe(String(ALICE.id));
    /* Never a direct navigation to the protected URL. */
    expect(document.querySelector(`a[href*="/api/attachments"]`)).toBeNull();
  });

  it("revokes the Blob URL when the preview closes, and returns focus", async () => {
    stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    const invoker = screen.getByRole("button", { name: "Preview vpn-error.png" });
    await userEvent.click(invoker);

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(createdUrls).toHaveLength(1));

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(revokedUrls).toContain(createdUrls[0]);
    expect(invoker).toHaveFocus();
  });

  it("downloads under the known original name and revokes its URL once the click is handled", async () => {
    const { calls } = stubApi();
    const clicked: { download: string; href: string }[] = [];
    const realClick = HTMLAnchorElement.prototype.click;

    HTMLAnchorElement.prototype.click = function recordClick(this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    };

    try {
      renderAt(`/tickets/${PUBLIC_ID}`);
      await screen.findByRole("heading", { name: "Attachments 1/5" });

      await userEvent.click(within(rowFor("vpn-error.png")).getByRole("button", { name: "Download vpn-error.png" }));

      await waitFor(() => expect(clicked).toHaveLength(1));
      /* The filename comes from the DTO, never from Content-Disposition. */
      expect(clicked[0].download).toBe("vpn-error.png");
      /*
       * Revoked on the next task, not inside the click handler: Firefox and
       * Safari resolve the href after the handler returns, so a synchronous
       * revoke cancels the download there without raising anything.
       */
      await waitFor(() => expect(revokedUrls).toContain(createdUrls[0]));

      const download = calls.find((call) => call.url.includes("/download"));
      expect(download?.headers["X-Requester-Id"]).toBe(String(ALICE.id));
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }
  });

  it("checks the response before reading the body", async () => {
    const { blobReads } = stubApi({ binaryOk: false });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.click(screen.getByRole("button", { name: "Preview vpn-error.png" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This attachment could not be opened.",
    );
    expect(blobReads).toHaveLength(0);
    expect(createdUrls).toHaveLength(0);
  });
});

describe("UI-28 selection for batch removal", () => {
  it("offers a checkbox on Active rows only", async () => {
    stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });

    expect(within(rowFor("vpn-error.png")).getByRole("checkbox")).toBeInTheDocument();
    expect(within(rowFor("superseded-log.pdf")).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("reports the selected count and offers Remove Selected", async () => {
    stubApi({ detailAttachments: [ACTIVE, SECOND_ACTIVE, REMOVED] });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 2/5" });

    await userEvent.click(screen.getByRole("checkbox", { name: "Select vpn-error.png" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Select router-log.pdf" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Selected" })).toBeInTheDocument();
  });

  it("never offers Active removal for a Create Ticket Pending row", async () => {
    stubApi();
    renderAt("/tickets/new");

    await userEvent.upload(await screen.findByLabelText("Add Attachment"), pngFile());
    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove Selected" })).not.toBeInTheDocument();
  });
});

describe("UI-29 a required reason per selected Attachment", () => {
  async function openRemoval(names: string[]) {
    stubApi({ detailAttachments: [ACTIVE, SECOND_ACTIVE, REMOVED] });
    renderAt(`/tickets/${PUBLIC_ID}`);
    await screen.findByRole("heading", { name: "Attachments 2/5" });

    for (const name of names) {
      await userEvent.click(screen.getByRole("checkbox", { name: `Select ${name}` }));
    }

    await userEvent.click(screen.getByRole("button", { name: "Remove Selected" }));
    return screen.findByRole("dialog");
  }

  it("asks for one reason per selected file", async () => {
    const dialog = await openRemoval(["vpn-error.png", "router-log.pdf"]);

    expect(within(dialog).getByRole("heading", { name: "Remove 2 Attachments" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/vpn-error\.png/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/router-log\.pdf/)).toBeInTheDocument();
  });

  it.each([
    ["an empty reason", ""],
    ["a two-character reason", "no"],
    ["a whitespace-only reason", "   "],
  ])("blocks the request on %s", async (_label, reason) => {
    const dialog = await openRemoval(["vpn-error.png"]);
    const field = within(dialog).getByLabelText(/vpn-error\.png/);

    if (reason !== "") {
      await userEvent.type(field, reason);
    }

    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    expect(within(dialog).getByText(/Reason must contain 3-200 characters/)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(
      (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.some(
        (call) => (call[1] as { method?: string })?.method === "DELETE",
      ),
    ).toBe(false);
  });

  it("sends a trimmed reason for each selected file", async () => {
    const dialog = await openRemoval(["vpn-error.png"]);

    await userEvent.type(within(dialog).getByLabelText(/vpn-error\.png/), "  Wrong screenshot.  ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      const remove = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.find(
        (call) => (call[1] as { method?: string })?.method === "DELETE",
      );
      expect(JSON.parse(String((remove?.[1] as { body?: unknown })?.body))).toEqual({
        items: [{ attachmentId: ACTIVE.attachmentId, reason: "Wrong screenshot." }],
      });
    });
  });
});

describe("UI-30 an all-or-nothing removal failure", () => {
  it("leaves every selected row in its previous state", async () => {
    stubApi({ detailAttachments: [ACTIVE, SECOND_ACTIVE], collectionStatus: 409 });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 2/5" });
    await userEvent.click(screen.getByRole("checkbox", { name: "Select vpn-error.png" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Select router-log.pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove Selected" }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/vpn-error\.png/), "Wrong screenshot.");
    await userEvent.type(within(dialog).getByLabelText(/router-log\.pdf/), "Duplicate document.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));

    /* The failure has to be inside the dialog the user is still looking at. */
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The attachments could not be removed. Nothing was changed.",
    );

    /* No row may be redrawn as Removed on a failure the backend rolled back. */
    expect(within(rowFor("vpn-error.png")).getByText("Active")).toBeInTheDocument();
    expect(within(rowFor("router-log.pdf")).getByText("Active")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Attachments 2/5" })).toBeInTheDocument();
  });
});

describe("UI-36 and UI-37 Attachment presentation and icon-only labels", () => {
  it("names every state in visible text rather than by colour", async () => {
    stubApi({ detailAttachments: [ACTIVE, REMOVED] });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });

    expect(within(rowFor("vpn-error.png")).getByText("Active")).toBeInTheDocument();
    expect(within(rowFor("superseded-log.pdf")).getByText("Removed")).toBeInTheDocument();
    expect(
      within(rowFor("superseded-log.pdf")).getByText("Removal reason: Replaced by a newer capture."),
    ).toBeInTheDocument();
  });

  it("gives a Removed row no controls at all", async () => {
    stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });

    const removed = rowFor("superseded-log.pdf");
    expect(within(removed).queryByRole("button")).not.toBeInTheDocument();
    expect(within(removed).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("gives each icon-only control an accessible name and a focus tooltip", async () => {
    stubApi();
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });

    for (const label of ["Preview vpn-error.png", "Remove vpn-error.png"]) {
      const control = screen.getByRole("button", { name: label });
      control.focus();

      const tooltip = await screen.findByRole("tooltip");
      expect(tooltip).toHaveTextContent(label);

      control.blur();
      await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    }
  });
});

describe("Create Ticket discard cleanup", () => {
  it("releases the prepared Pending rows with an empty reason each", async () => {
    const { calls } = stubApi();
    renderAt("/tickets/new");

    await userEvent.upload(await screen.findByLabelText("Add Attachment"), pngFile());
    await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));

    await waitFor(() => {
      const cleanup = calls.find((call) => call.method === "DELETE");
      expect(JSON.parse(String(cleanup?.body))).toEqual({
        items: [{ attachmentId: PENDING_ID, reason: "" }],
      });
    });
  });
});

describe("UI-26 the x/5 bound holds while uploads are in flight", () => {
  it("counts in-flight uploads so a second selection cannot prepare more than five", async () => {
    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { calls } = stubApi({ uploadGate: gate });

    renderAt("/tickets/new");
    const input = await screen.findByLabelText("Add Attachment");

    await userEvent.upload(input, [0, 1, 2, 3].map((index) => pngFile(`evidence-${index}.png`)));

    /*
     * Nothing has answered yet, so all four rows are still Uploading. They have
     * to count: reading the room from the settled rows alone would leave it at
     * five here, take all three files below, and prepare seven Pending rows the
     * Ticket-create would reject with a 400 the Requester has to unpick by hand.
     */
    expect(await screen.findByRole("heading", { name: "Attachments 4/5" })).toBeInTheDocument();

    await userEvent.upload(input, [pngFile("extra-a.png"), pngFile("extra-b.png"), pngFile("extra-c.png")]);

    expect(
      await screen.findByText("Only 5 attachments can be prepared for a new Ticket."),
    ).toBeInTheDocument();
    expect(screen.getByText("extra-a.png")).toBeInTheDocument();
    expect(screen.queryByText("extra-b.png")).not.toBeInTheDocument();
    expect(screen.queryByText("extra-c.png")).not.toBeInTheDocument();

    /* Full now, so the control is out of reach rather than merely refusing. */
    expect(await screen.findByRole("heading", { name: "Attachments 5/5" })).toBeInTheDocument();
    expect(input).toBeDisabled();

    release();

    await waitFor(() =>
      expect(within(rowFor("extra-a.png")).getByText("Pending")).toBeInTheDocument(),
    );

    const uploads = calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/api/attachments"),
    );
    expect(uploads).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Attachments 5/5" })).toBeInTheDocument();
  });
});

describe("UI-26 Retry Upload answers to the same x/5 bound", () => {
  it("cannot prepare a sixth row by retrying a Failed one at the limit", async () => {
    /* The first two pre-uploads fail; every later one settles Pending. */
    let attempt = 0;
    stubApi({
      upload: () => {
        attempt += 1;
        return attempt <= 2 ? { ok: false, status: 500 } : {};
      },
    });

    renderAt("/tickets/new");
    const input = await screen.findByLabelText("Add Attachment");

    await userEvent.upload(input, [0, 1, 2, 3, 4].map((index) => pngFile(`f-${index}.png`)));
    expect(await screen.findByRole("heading", { name: "Attachments 3/5" })).toBeInTheDocument();

    /* Failed rows free their slots, so two more selections fill the counter. */
    await userEvent.upload(input, [pngFile("g-0.png"), pngFile("g-1.png")]);
    expect(await screen.findByRole("heading", { name: "Attachments 5/5" })).toBeInTheDocument();

    /*
     * Retry is an add path like the file input. Without the bound it would take
     * the two Failed rows to seven prepared Pending IDs, and the Ticket-create
     * would answer 400 for a set the card itself had drawn as valid.
     */
    expect(within(rowFor("f-0.png")).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(within(rowFor("f-1.png")).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Attachments 5/5" })).toBeInTheDocument();
  });

  it("offers Retry again once a slot is freed", async () => {
    let attempt = 0;
    stubApi({
      upload: () => {
        attempt += 1;
        return attempt === 1 ? { ok: false, status: 500 } : {};
      },
    });

    renderAt("/tickets/new");
    const input = await screen.findByLabelText("Add Attachment");

    await userEvent.upload(input, [0, 1, 2, 3, 4].map((index) => pngFile(`f-${index}.png`)));
    expect(await screen.findByRole("heading", { name: "Attachments 4/5" })).toBeInTheDocument();

    /* One slot is open, so the Failed row can still be retried into it. */
    await userEvent.click(within(rowFor("f-0.png")).getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(within(rowFor("f-0.png")).getByText("Pending")).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "Attachments 5/5" })).toBeInTheDocument();
  });
});

/*
 * The Attachment deadline, which is the one place the 5,000,000-byte limit and
 * the API client's 8-second default meet. A `fetch` AbortSignal covers the
 * request body too, so the default budget would cap a max-size upload at
 * whatever fits in 8 seconds and report the abort as "The upload did not
 * complete" -- after the server had usually already committed the row.
 */
/*
 * Both upload endpoints answer 409, and they mean different things: on Ticket
 * Detail it is the five-Active limit on that Ticket, on Create Ticket it is the
 * ceiling on prepared files this Requester holds across every draft. One shared
 * message would tell half the users to fix the wrong thing.
 */
describe("a 409 upload refusal names the limit it actually hit", () => {
  it("blames the Ticket's five-Active limit on Ticket Detail", async () => {
    stubApi({ upload: () => ({ ok: false, status: 409 }) });
    renderAt(`/tickets/${PUBLIC_ID}`);

    const input = await screen.findByLabelText("Add Attachment");
    await userEvent.upload(input, pngFile("extra.png"));

    expect(await screen.findByText(/at most 5 active attachments/i)).toBeInTheDocument();
  });

});

describe("Attachment requests carry their own deadline", () => {
  it.each([
    ["the Pending pre-upload", "/tickets/new"],
    ["the binary paths", `/tickets/${PUBLIC_ID}`],
  ])("uses the Attachment timeout for %s", async (_label, path) => {
    const deadlines: number[] = [];
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);

    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds: number) => {
      deadlines.push(milliseconds);
      return realTimeout(milliseconds);
    });

    try {
      stubApi();
      renderAt(path);

      if (path === "/tickets/new") {
        const input = await screen.findByLabelText("Add Attachment");
        deadlines.length = 0;
        await userEvent.upload(input, pngFile());
        await waitFor(() => expect(within(rowFor("vpn-error.png")).getByText("Pending")).toBeInTheDocument());
      } else {
        await screen.findByRole("heading", { name: "Attachments 1/5" });
        deadlines.length = 0;
        await userEvent.click(screen.getByRole("button", { name: "Preview vpn-error.png" }));
        await waitFor(() => expect(createdUrls).toHaveLength(1));
      }

      expect(deadlines).toContain(ATTACHMENT_TIMEOUT_MS);
      expect(deadlines).not.toContain(8000);
    } finally {
      vi.mocked(AbortSignal.timeout).mockRestore();
    }
  });
});

describe("UI-27 a failed download is reported", () => {
  it("shows an alert instead of failing silently when the binary cannot be read", async () => {
    stubApi({ binaryOk: false });
    renderAt(`/tickets/${PUBLIC_ID}`);

    await screen.findByRole("heading", { name: "Attachments 1/5" });
    await userEvent.click(within(rowFor("vpn-error.png")).getByRole("button", { name: "Download vpn-error.png" }));

    expect(
      await within(rowFor("vpn-error.png")).findByRole("alert"),
    ).toHaveTextContent("vpn-error.png could not be downloaded.");
  });
});
