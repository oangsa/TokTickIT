import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";

// dotenv/config only reads ".env"; this repo keeps its values in ".env.local".
config({ path: [".env.local", ".env"] });

import { PrismaClient } from "./generated/prisma/client.js";

// Lazy singleton: the client is created on first use, not at import time.
// This keeps route modules and tests that don't touch the DB (e.g. /api/health)
// free of database side effects.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    // Without this, pg silently falls back to localhost:5432 and the failure
    // surfaces much later as an opaque ECONNREFUSED.
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set (checked .env.local, .env)");
    }
    const adapter = new PrismaPg({ connectionString });
    client = new PrismaClient({ adapter });
  }
  return client;
}
