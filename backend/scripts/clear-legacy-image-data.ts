import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function run() {
  const profiles = await prisma.employerProfile.findMany({
    where: {
      OR: [{ companyLogo: { startsWith: 'data:' } }, { companyBanner: { startsWith: 'data:' } }],
    },
    select: { id: true, companyName: true, companyLogo: true, companyBanner: true },
  });

  console.log(`Found ${profiles.length} profile(s) with legacy base64 image data`);

  for (const profile of profiles) {
    const data: { companyLogo?: null; companyBanner?: null } = {};
    if (profile.companyLogo?.startsWith('data:')) data.companyLogo = null;
    if (profile.companyBanner?.startsWith('data:')) data.companyBanner = null;

    await prisma.employerProfile.update({ where: { id: profile.id }, data });
    console.log(`Cleared ${Object.keys(data).join(', ')} for "${profile.companyName}" (${profile.id})`);
  }

  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error('Cleanup failed', error);
  await prisma.$disconnect();
  process.exit(1);
});
