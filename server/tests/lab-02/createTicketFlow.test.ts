import { describe, expect, it, vi } from "vitest";

import { runCreateTicket } from "../../src/services/createTicketFlow.js";
import { parseCreateTicketRequest } from "../../src/services/ticketCreateRequest.js";
import { KEY, ticketRow, VALID_BODY } from "./support/ticketPrismaMock.js";

describe("Ticket-create migration compatibility", () => {
  it("replays the preserved Lab 2 body-only claim at the canonical Ticket path", async () => {
    const prisma = {
      idempotencyRecord: {
        findUnique: vi.fn().mockResolvedValue({
          id: 7,
          userId: 3,
          method: "POST",
          resourcePath: "/api/users/me/tickets",
          key: KEY,
          requestHash: "9bb94f65a373c130fa9f8137256557120961dcf714c23788230353ef76397480",
          status: "COMPLETED",
          processingStartedAt: new Date("2026-08-20T07:00:00.000Z"),
          ticketId: 42,
          actionTakenId: null,
          completedAt: new Date("2026-08-20T07:00:00.000Z"),
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      ticket: { findUnique: vi.fn().mockResolvedValue(ticketRow()) },
    };

    const result = await runCreateTicket(prisma as never, {
      requesterId: 3,
      actor: "alice@example.com",
      key: KEY,
      payload: parseCreateTicketRequest(VALID_BODY).payload,
    });

    expect(result.status).toBe(200);
    expect(result.ticket.publicId).toBe("05a214b4-b957-4ed7-a58e-73f4392b35ec");
    expect(prisma.idempotencyRecord.findUnique).toHaveBeenCalledWith({
      where: {
        userId_method_resourcePath_key: {
          userId: 3,
          method: "POST",
          resourcePath: "/api/users/me/tickets",
          key: KEY,
        },
      },
    });
    expect(prisma.ticket.findUnique).toHaveBeenCalledOnce();
  });
});
