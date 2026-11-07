import { ConfigService } from '@nestjs/config';
import { JobAlertsService } from '../../../src/job-alerts/job-alerts.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

/** The location part of the query an alert runs, read through the private matcher. */
async function locationFilterFor(location: string | null) {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new JobAlertsService(
    { job: { findMany } } as unknown as PrismaService,
    {} as never,
    new ConfigService(),
    {} as never,
    {} as never,
    {} as never,
  );
  const alert = { name: 'Engineer', location, keywords: [], jobType: null, experienceLevel: null, salaryMin: null };
  await (service as unknown as { findMatches: (a: unknown, s: Date, l: number) => Promise<unknown> }).findMatches(
    alert,
    new Date(0),
    10,
  );
  const and = findMany.mock.calls[0][0].where.AND as Array<Record<string, unknown>>;
  // The date window is an OR too; only conditions about place or remote work.
  return and.filter((f) => /"(location|isRemote)"/.test(JSON.stringify(f)));
}

describe('where a job alert looks', () => {
  it('matches the city of a picked place, so "Toronto, ON" finds "Toronto, Ontario, Canada"', async () => {
    expect(await locationFilterFor('Toronto, ON')).toEqual([{ location: { contains: 'Toronto', mode: 'insensitive' } }]);
  });

  it('reads "Remote" as remote work, not a place name', async () => {
    expect(await locationFilterFor('Remote')).toEqual([
      { OR: [{ isRemote: true }, { location: { contains: 'remote', mode: 'insensitive' } }] },
    ]);
  });

  it('has no place filter without a location', async () => {
    expect(await locationFilterFor(null)).toEqual([]);
    expect(await locationFilterFor('   ')).toEqual([]);
  });
});
