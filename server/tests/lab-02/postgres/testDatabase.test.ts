import { afterEach, describe, expect, it } from "vitest";

import { assertLab2TestDatabase, resetTestSchema } from "./testDatabase.js";

const originalEnvironment = {
  NODE_ENV: process.env.NODE_ENV,
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
};

function restoreEnvironmentVariable(
  name: keyof typeof originalEnvironment,
): void {
  const value = originalEnvironment[name];
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

describe("Lab 2 PostgreSQL test-database guard", () => {
  afterEach(() => {
    restoreEnvironmentVariable("NODE_ENV");
    restoreEnvironmentVariable("TEST_DATABASE_URL");
    restoreEnvironmentVariable("DATABASE_URL");
    restoreEnvironmentVariable("DIRECT_URL");
  });

  it("rejects when NODE_ENV is not test", () => {
    process.env.NODE_ENV = "development";
    process.env.TEST_DATABASE_URL =
      "postgresql://lab2_test@127.0.0.1:55432/toktickit_lab2_test";
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;

    expect(() => assertLab2TestDatabase()).toThrow(
      "Lab 2 PostgreSQL tests require NODE_ENV=test",
    );
  });

  it("rejects when TEST_DATABASE_URL is missing instead of falling back", () => {
    process.env.NODE_ENV = "test";
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://development@127.0.0.1:5432/toktickit_dev";
    delete process.env.DIRECT_URL;

    expect(() => assertLab2TestDatabase()).toThrow(
      "Lab 2 PostgreSQL tests require TEST_DATABASE_URL",
    );
  });

  it("rejects a non-PostgreSQL TEST_DATABASE_URL", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL =
      "mysql://lab2_test@127.0.0.1/toktickit_lab2_test";
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;

    expect(() => assertLab2TestDatabase()).toThrow(
      "TEST_DATABASE_URL must use the PostgreSQL protocol",
    );
  });

  it("rejects the development database through a different hostname alias", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL =
      "postgresql://lab2_test@127.0.0.1:55432/toktickit_lab2_test";
    process.env.DATABASE_URL =
      "postgresql://development@localhost:55432/toktickit_lab2_test";

    expect(() => assertLab2TestDatabase()).toThrow(
      "TEST_DATABASE_URL must identify a database different from DATABASE_URL",
    );
  });

  it("rejects database names without an explicit test marker", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL =
      "postgresql://lab2_test@127.0.0.1:55432/contest";
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;

    expect(() => assertLab2TestDatabase()).toThrow(
      "TEST_DATABASE_URL database name must contain an explicit test marker",
    );
  });

  it("rejects a reset target that is not the guarded TEST_DATABASE_URL", async () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL =
      "postgresql://lab2_test@127.0.0.1:55432/toktickit_lab2_test";
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;
    const unrelatedTarget = {
      url: "postgresql://development@127.0.0.1:55432/toktickit_dev",
      databaseName: "toktickit_dev",
    };

    await expect(resetTestSchema(unrelatedTarget)).rejects.toThrow(
      "Test database target must match the guarded TEST_DATABASE_URL",
    );
  });

  it("rejects a test-marked database that is not identified as the Lab 2 target", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL =
      "postgresql://lab2_test@127.0.0.1:55432/toktickit_other_test";
    delete process.env.DATABASE_URL;
    delete process.env.DIRECT_URL;

    expect(() => assertLab2TestDatabase()).toThrow(
      "TEST_DATABASE_URL database name must identify the dedicated Lab 2 test database",
    );
  });

  it("rejects the direct migration database even when DATABASE_URL differs", () => {
    process.env.NODE_ENV = "test";
    process.env.TEST_DATABASE_URL =
      "postgresql://lab2_test@127.0.0.1:55432/toktickit_lab2_test";
    process.env.DATABASE_URL =
      "postgresql://development@localhost:55432/toktickit_development";
    process.env.DIRECT_URL =
      "postgresql://development@localhost:55432/toktickit_lab2_test";

    expect(() => assertLab2TestDatabase()).toThrow(
      "TEST_DATABASE_URL must identify a database different from DIRECT_URL",
    );
  });
});
