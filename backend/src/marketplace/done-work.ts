import { Prisma } from '@prisma/client';
import { personName } from '../common/person-name';
import { publicServiceWhere } from './marketplace-policy';

/**
 * Work done through Coral, as visitors see it: requests both sides confirmed
 * as finished. Measured, not described — Coral holds the request, the
 * conversation and both confirmations.
 */

/** As many as a page lists; the total is counted in full. */
const SHOWN = 12;

const DONE_SELECT = {
  id: true, confirmedAt: true, clientNamed: true,
  client: { select: { displayName: true, firstName: true, lastName: true } },
  request: {
    select: {
      kind: true, serviceListingId: true,
      serviceListing: { select: { title: true } },
      projectBrief: { select: { title: true } },
      requesterCompany: { select: { name: true } },
      recipientCompany: { select: { name: true } },
    },
  },
} satisfies Prisma.CompletedWorkSelect;

export interface DoneWork {
  id: string;
  kind: 'service' | 'project';
  /** The service's title; a project's only when the client agreed to be named. */
  title: string | null;
  /** The service, while its page is public. */
  serviceId: string | null;
  /** "2026-10": when both had confirmed. */
  month: string;
  /** The client's name, or their company's, only when the client agreed. */
  client: string | null;
}

/**
 * What a provider shows: confirmed, not hidden by them, and for a client
 * whose account is still active — a suspended or banned client's
 * confirmation stops counting, so a throwaway account can't vouch for work.
 */
export function doneWorkWhere(providerId: string, serviceListingId?: string): Prisma.CompletedWorkWhereInput {
  return {
    providerId, confirmedAt: { not: null }, shownByProvider: true, client: { status: 'ACTIVE' },
    ...(serviceListingId ? { request: { serviceListingId } } : {}),
  };
}

export async function doneWorkFor(
  prisma: Pick<Prisma.TransactionClient, 'completedWork' | 'serviceListing'>,
  providerId: string,
  serviceListingId?: string,
): Promise<{ total: number; items: DoneWork[] }> {
  const where = doneWorkWhere(providerId, serviceListingId);
  const [total, rows] = await Promise.all([
    prisma.completedWork.count({ where }),
    prisma.completedWork.findMany({ where, select: DONE_SELECT, orderBy: [{ confirmedAt: 'desc' }, { id: 'asc' }], take: SHOWN }),
  ]);
  const serviceIds = [...new Set(rows.flatMap((row) => (row.request.serviceListingId ? [row.request.serviceListingId] : [])))];
  const followable = new Set(serviceIds.length
    ? (await prisma.serviceListing.findMany({
        where: { AND: [{ id: { in: serviceIds } }, publicServiceWhere()] } as Prisma.ServiceListingWhereInput,
        select: { id: true },
      })).map((listing) => listing.id)
    : []);

  const items = rows.map((row): DoneWork => {
    const service = row.request.kind === 'service';
    // The client's side of the request: the enquirer of a service, the poster of a project.
    const company = service ? row.request.requesterCompany : row.request.recipientCompany;
    const serviceId = row.request.serviceListingId;
    return {
      id: row.id,
      kind: service ? 'service' : 'project',
      title: service ? row.request.serviceListing?.title ?? null : row.clientNamed ? row.request.projectBrief?.title ?? null : null,
      serviceId: service && serviceId && followable.has(serviceId) ? serviceId : null,
      month: row.confirmedAt!.toISOString().slice(0, 7),
      client: row.clientNamed ? company?.name ?? personName(row.client, 'a Coral member') : null,
    };
  });
  return { total, items };
}
