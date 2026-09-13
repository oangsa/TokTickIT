import { describe, expect, it } from "vitest";

import { assertLab3TargetEnvironment } from "../../src/databaseTargetGuard.js";

describe("Lab 3 database target guard @issue-2", () => {
  const base = {
    NODE_ENV: "test",
    TEST_DATABASE_URL: "postgresql://test:test@localhost:5432/toktickit_lab3_test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/toktickit_lab3_test",
    DIRECT_URL: "postgresql://test:test@localhost:5432/toktickit_lab3_test",
    LAB3_BASELINE_DATABASE_URL: "postgresql://dev:dev@localhost:5432/toktickit_dev",
    LAB3_BASELINE_DIRECT_URL: "postgresql://dev:dev@localhost:5432/toktickit_dev",
  };

  it("accepts only explicit disposable Lab 3 overrides", () => {
    expect(assertLab3TargetEnvironment(base)).toContain("toktickit_lab3_test");
  });

  it("rejects missing Lab 3 marker and baseline collisions", () => {
    expect(() => assertLab3TargetEnvironment({ ...base, TEST_DATABASE_URL: base.TEST_DATABASE_URL.replace("lab3_", "") })).toThrow(/test and lab3/);
    expect(() => assertLab3TargetEnvironment({ ...base, LAB3_BASELINE_DATABASE_URL: base.TEST_DATABASE_URL })).toThrow(/differ/);
  });

  it("rejects missing, malformed, and inconsistent target inputs", () => {
    expect(() => assertLab3TargetEnvironment({ ...base, TEST_DATABASE_URL: "" })).toThrow(/require/);
    expect(() => assertLab3TargetEnvironment({ ...base, LAB3_BASELINE_DIRECT_URL: "not-a-database-url" })).toThrow(/valid PostgreSQL URL/);
    expect(() => assertLab3TargetEnvironment({ ...base, DATABASE_URL: "postgresql://test:test@localhost:5432/another_test" })).toThrow(/explicitly equal/);
  });
});
