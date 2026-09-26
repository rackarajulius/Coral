/**
 * Promote a user to ADMIN by email.
 *
 *   npm run make:admin -- someone@example.com
 *
 * Sets role = ADMIN and status = ACTIVE. Idempotent — safe to run again.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run make:admin -- <email>');
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  });

  if (!existing) {
    console.error(`✗ No user found with email: ${email}`);
    console.error('  The user must have signed in at least once before being promoted.');
    process.exit(1);
  }

  if (existing.role === 'ADMIN') {
    console.log(`• ${existing.email} is already an ADMIN — nothing to do.`);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { role: 'ADMIN', status: 'ACTIVE' },
  });

  console.log(`✓ ${existing.email} is now ADMIN (status ACTIVE).`);
}

main()
  .catch((err) => {
    console.error('Failed to promote user:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
