import { CompanyMemberStatus, CompanyRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Whether this person runs this company's page: an active owner or admin,
 * the same people who may post in its name. They see what readers do not —
 * the scheduled queue and the page's numbers.
 */
export async function runsCompanyPage(
  prisma: Pick<PrismaService, 'companyMember'>,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const seat = await prisma.companyMember.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { role: true, status: true, user: { select: { status: true } } },
  });
  return (
    seat?.status === CompanyMemberStatus.ACTIVE &&
    seat.user.status === 'ACTIVE' &&
    (seat.role === CompanyRole.OWNER || seat.role === CompanyRole.ADMIN)
  );
}
