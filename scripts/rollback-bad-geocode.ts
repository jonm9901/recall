/**
 * One-time rollback: clears bad geocode data written by the aborted
 * forward-geocode run that incorrectly geocoded month names.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const BAD_NAMES = [
  "Dec", "April", "May", "June", "July", "Sep", "Oct", "Aug", "Nov",
  "March", "Apr", "Feb", "Jan", "Photos", "Mar",
];

async function main() {
  console.log("Rolling back bad geocode writes…");
  let total = 0;
  for (const name of BAD_NAMES) {
    const result = await prisma.photo.updateMany({
      where: { locationName: name, city: { not: null } },
      data: { city: null, region: null, country: null },
    });
    if (result.count > 0) {
      console.log(`  Cleared ${result.count} photos for "${name}"`);
      total += result.count;
    }
  }
  console.log(`Done. ${total} photos cleared.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
