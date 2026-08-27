import { getPrisma } from "../prisma.js";
import { MaintenanceService } from "../services/maintenanceService.js";

/*
 * `npm run maintenance:cleanup` (api-spec Section 17.1).
 *
 * The whole CLI is the scheduling boundary: it runs the two bounded cleanup
 * jobs once and exits. Lab 2 introduces no HTTP cleanup route and no in-process
 * timer, so how often this runs is an operational decision made outside the
 * application.
 *
 * The summary is one structured line, counts only -- no identifiers, no
 * filenames, no connection strings (BR-86).
 */
async function main(): Promise<void> {
  const prisma = getPrisma();

  try {
    const summary = await new MaintenanceService(prisma).run();

    console.log(JSON.stringify({ job: "maintenance:cleanup", ...summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  /* A sanitized class name only, for the same reason the error handler logs one. */
  console.error(
    JSON.stringify({
      job: "maintenance:cleanup",
      failed: true,
      errorClass: error instanceof Error ? error.constructor.name : typeof error,
    }),
  );
  process.exitCode = 1;
});
