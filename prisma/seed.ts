import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create a test user
  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      name: "Test User",
      email: "test@example.com",
      password: passwordHash,
    },
  });
  console.log("Seeded user:", user.email);

  // Create a test gallery
  const gallery = await prisma.gallery.upsert({
    where: { smugmugId: "test-gallery-001" },
    update: {},
    create: {
      smugmugId: "test-gallery-001",
      title: "Paris 2019",
      locationName: "Paris",
      city: "Paris",
      country: "France",
      smugmugUrl: "https://example.smugmug.com/Paris-2019",
    },
  });
  console.log("Seeded gallery:", gallery.title);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
