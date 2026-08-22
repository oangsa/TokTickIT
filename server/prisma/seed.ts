import { getPrisma } from "../src/prisma.js";

const CATEGORIES = ["Account and Access", "Hardware", "Software", "Network"];
const RELATED_SYSTEMS = [
  "Corporate Laptop",
  "Desktop Workstation",
  "Printer",
  "Campus Wi-Fi",
  "VPN",
  "Email",
  "Learning Management System",
];

const DEVELOPMENT_REQUESTERS = [
  { name: "Alice Johnson", email: "alice.johnson@example.com", isActive: true },
  { name: "Bob Smith", email: "bob.smith@example.com", isActive: true },
  { name: "Carol Lee", email: "carol.lee@example.com", isActive: true },
  { name: "David Brown", email: "david.brown@example.com", isActive: true },
  { name: "Eve Wilson", email: "eve.wilson@example.com", isActive: false },
];

async function main() {
  const prisma = getPrisma();

  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: {
        name,
        deleted: false,
        createdBy: "seed",
        updatedBy: "seed",
      },
    });
  }

  for (const name of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: {
        name,
        deleted: false,
        createdBy: "seed",
        updatedBy: "seed",
      },
    });
  }

  for (const requester of DEVELOPMENT_REQUESTERS) {
    await prisma.developmentRequester.upsert({
      where: { email: requester.email },
      update: {},
      create: {
        ...requester,
        deleted: false,
        createdBy: "seed",
        updatedBy: "seed",
      },
    });
  }

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${RELATED_SYSTEMS.length} related systems, and ${DEVELOPMENT_REQUESTERS.length} development requesters.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
