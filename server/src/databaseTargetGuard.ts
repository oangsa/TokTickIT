function parsePostgresUrl(value: string, variableName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL URL`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${variableName} must use the PostgreSQL protocol`);
  }
  if (!parsed.hostname) {
    throw new Error(`${variableName} must identify a PostgreSQL host`);
  }
  if (!parsed.pathname || parsed.pathname === "/") {
    throw new Error(`${variableName} must identify a database name`);
  }
  return parsed;
}

function databaseIdentity(value: string, variableName: string): string {
  const parsed = parsePostgresUrl(value, variableName);
  return `${parsed.hostname.toLowerCase()}:${parsed.port || "5432"}/${decodeURIComponent(parsed.pathname.slice(1))}`;
}

function sameTarget(left: string, leftName: string, right: string, rightName: string): boolean {
  return databaseIdentity(left, leftName) === databaseIdentity(right, rightName);
}

export function assertLab3TargetEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV !== "test") {
    throw new Error("Lab 3 PostgreSQL writes require NODE_ENV=test");
  }

  const testUrl = env.TEST_DATABASE_URL?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const directUrl = env.DIRECT_URL?.trim();
  const baselineDatabaseUrl = env.LAB3_BASELINE_DATABASE_URL?.trim();
  const baselineDirectUrl = env.LAB3_BASELINE_DIRECT_URL?.trim();
  if (!testUrl || !databaseUrl || !directUrl || !baselineDatabaseUrl || !baselineDirectUrl) {
    throw new Error("Lab 3 writes require TEST_DATABASE_URL, explicit overrides, and captured baselines");
  }

  const testDatabase = decodeURIComponent(parsePostgresUrl(testUrl, "TEST_DATABASE_URL").pathname.slice(1));
  if (!/(^|[_-])test([_-]|$)/i.test(testDatabase) || !/(^|[_-])lab3([_-]|$)/i.test(testDatabase)) {
    throw new Error("TEST_DATABASE_URL database name must contain explicit test and lab3 markers");
  }
  if (databaseUrl !== testUrl || directUrl !== testUrl) {
    throw new Error("DATABASE_URL and DIRECT_URL must explicitly equal TEST_DATABASE_URL for Lab 3 writes");
  }
  if (
    sameTarget(testUrl, "TEST_DATABASE_URL", baselineDatabaseUrl, "LAB3_BASELINE_DATABASE_URL") ||
    sameTarget(testUrl, "TEST_DATABASE_URL", baselineDirectUrl, "LAB3_BASELINE_DIRECT_URL")
  ) {
    throw new Error("Lab 3 test database must differ from captured baseline targets");
  }
  return testUrl;
}
