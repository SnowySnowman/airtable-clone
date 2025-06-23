// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@airtable.com" },
    update: {},
    create: {
      name: "Demo User",
      email: "demo@airtable.com",
    },
  });

  const base = await prisma.base.create({
    data: {
      name: "Demo Base",
      userId: user.id,
    },
  });

  const table = await prisma.table.create({
    data: {
      name: "Demo Table",
      baseId: base.id,
    },
  });

  const columns = await prisma.$transaction([
    prisma.column.create({
      data: {
        name: "Name",
        type: "TEXT",
        order: 0,
        tableId: table.id,
      },
    }),
    prisma.column.create({
      data: {
        name: "Age",
        type: "NUMBER",
        order: 1,
        tableId: table.id,
      },
    }),
  ]);

  await prisma.$transaction(
    Array.from({ length: 50 }).map(() =>
      prisma.row.create({
        data: {
          tableId: table.id,
          values: {
            Name: faker.person.firstName(),
            Age: faker.number.int({ min: 18, max: 65 }),
          },
        },
      })
    )
  );

  console.log("✅ Seeded base with table, columns, and 50 rows.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
