import { getPrisma } from "../src/prisma.js";

// Issue 3 — seed the four supported categories.
// upsert on the unique name keeps the seed idempotent: re-running it matches
// the existing row instead of inserting a duplicate.
const CATEGORIES = ["Account and Access", "Hardware", "Software", "Network"];

async function main() {
  const prisma = getPrisma();
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${CATEGORIES.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
