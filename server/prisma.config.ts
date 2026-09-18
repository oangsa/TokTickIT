import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";
import { assertLab3TargetEnvironment } from "./src/databaseTargetGuard.js";

// dotenv/config only reads ".env"; this repo keeps its values in ".env.local".
config({ path: [".env.local", ".env"] });

const prismaCommand = process.argv[2];
const usesDatabase = prismaCommand === "migrate" || prismaCommand === "db" || prismaCommand === "studio";

if (usesDatabase && process.env.NODE_ENV === "test") {
  assertLab3TargetEnvironment(process.env);
}


// Prisma 7 reads the migration connection from here instead of schema.prisma.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma 7 dropped `directUrl`: this url is the migration connection only,
    // while PrismaClient gets its own (pooled) one via the adapter in
    // src/prisma.ts. Pooled connections cannot run migrations, so prefer
    // DIRECT_URL when it is set.
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
  },
});
