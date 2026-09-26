import { PrismaClient } from '@prisma/client';
import { categorySeeds } from '../prisma/seeds/categories';
import { industrySeeds } from '../prisma/seeds/industries';
import { skillSeeds } from '../prisma/seeds/skills';

const prisma = new PrismaClient();

async function runSeed() {
  console.log('Seed scaffold started');
  console.log(`Skills: ${skillSeeds.length}`);
  console.log(`Categories: ${categorySeeds.length}`);
  console.log(`Industries: ${industrySeeds.length}`);

  // Keep seed script non-destructive for now because supporting schema tables
  // are still being introduced incrementally.
  await prisma.$disconnect();
  console.log('Seed scaffold finished');
}

runSeed().catch(async (error) => {
  console.error('Seed scaffold failed', error);
  await prisma.$disconnect();
  process.exit(1);
});

