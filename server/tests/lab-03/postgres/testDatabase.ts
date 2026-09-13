import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../../src/generated/prisma/client.js";
import { assertLab3TargetEnvironment } from "../../../src/databaseTargetGuard.js";

config({ path: [".env.local", ".env"] });

export interface Lab3TestTarget {
  url: string;
  databaseName: string;
}

export function assertLab3TestDatabase(): Lab3TestTarget {
  const url = assertLab3TargetEnvironment();
  const databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  return { url, databaseName };
}

export function createTestPrisma(target: Lab3TestTarget): PrismaClient {
  if (target.url !== process.env.TEST_DATABASE_URL) {
    throw new Error("PostgreSQL target must match TEST_DATABASE_URL");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: target.url }) });
}
