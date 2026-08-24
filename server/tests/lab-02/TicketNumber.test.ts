import { describe, expect, it } from "vitest";

import {
  TICKET_NUMBER_PATTERN,
  bangkokBusinessDate,
  generateTicketNumber,
} from "../../src/services/ticketNumber.js";

// UNIT-04 (BR-01-03, AC-07).
describe("Ticket Number generation", () => {
  it("matches TKT-YYYYMMDD-RRRRRRRRRRRR and is 25 characters", () => {
    const value = generateTicketNumber(new Date("2026-08-20T04:00:00.000Z"));

    expect(value).toMatch(TICKET_NUMBER_PATTERN);
    expect(value).toHaveLength(25);
  });

  it("uses the Asia/Bangkok business date, not the UTC date", () => {
    // 2026-08-20T17:00Z is already 2026-08-21 in Bangkok (UTC+7). A UTC-based
    // implementation would emit 20260820 here.
    expect(bangkokBusinessDate(new Date("2026-08-20T17:00:00.000Z"))).toBe("20260821");
    expect(bangkokBusinessDate(new Date("2026-08-20T16:59:59.999Z"))).toBe("20260820");
  });

  it("keeps the Bangkok date across a year boundary", () => {
    expect(bangkokBusinessDate(new Date("2026-12-31T17:00:00.000Z"))).toBe("20270101");
  });

  it("uses the injected time and suffix deterministically", () => {
    const value = generateTicketNumber(
      new Date("2026-08-20T04:00:00.000Z"),
      () => "A81F3C9D7B21",
    );

    expect(value).toBe("TKT-20260820-A81F3C9D7B21");
  });

  it("produces a 12-character uppercase hexadecimal suffix by default", () => {
    const suffixes = new Set<string>();

    for (let attempt = 0; attempt < 200; attempt += 1) {
      const suffix = generateTicketNumber(new Date("2026-08-20T04:00:00.000Z")).slice(-12);
      expect(suffix).toMatch(/^[0-9A-F]{12}$/);
      suffixes.add(suffix);
    }

    // Not a uniqueness guarantee -- the database constraint and the bounded
    // create retry own that. This only proves the suffix is not a constant.
    expect(suffixes.size).toBeGreaterThan(190);
  });
});
