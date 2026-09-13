import { describe, expect, it } from "vitest";

import { generateInitialPassword } from "../../src/services/initialPasswordGenerator.js";

describe("UNIT-02 InitialPasswordGenerator @issue-2", () => {
  it("generates a fresh 16-character password with all required classes", () => {
    const password = generateInitialPassword();
    expect([...password]).toHaveLength(16);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[^A-Za-z0-9\s]/);
  });
});
