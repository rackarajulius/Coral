import { NotFoundException } from '@nestjs/common';
import { CandidateSourcingService } from '../../../src/employer-hiring/candidate-sourcing.service';

function collaborator<T>(value: unknown): T { return value as T; }

function harness(opts: { discoverable: boolean; onProject?: number; applied?: number }) {
  const prisma = {
    jobSeekerProfile: {
      findUnique: jest.fn().mockResolvedValue({
        currentTitle: 'Backend Engineer',
        headline: null,
        skills: ['Go'],
        discoverable: opts.discoverable,
        privacySettings: null,
        user: { firstName: 'Synthetic', lastName: 'Candidate', displayName: null },
      }),
    },
    shortlistItem: { count: jest.fn().mockResolvedValue(opts.onProject ?? 0) },
    application: { count: jest.fn().mockResolvedValue(opts.applied ?? 0) },
  };
  const companyContext = { memberUserIds: jest.fn().mockResolvedValue(['employer-a', 'colleague-a']) };
  const service = new CandidateSourcingService(
    collaborator(prisma), collaborator({}), collaborator(companyContext),
  );
  return { service, prisma };
}

describe('Find similar: who can be a starting point', () => {
  it('anyone search would show', async () => {
    const { service, prisma } = harness({ discoverable: true });
    const similar = await service.similarTo('employer-a', 'cand-a');
    expect(similar).toMatchObject({ query: '"Backend Engineer" OR "Go"', name: 'Synthetic Candidate' });
    // No need to look further when search would show them anyway.
    expect(prisma.shortlistItem.count).not.toHaveBeenCalled();
  });

  it('someone hidden from search who is on the team’s project or applied to its job', async () => {
    await expect(harness({ discoverable: false, onProject: 1 }).service.similarTo('employer-a', 'cand-a'))
      .resolves.toMatchObject({ candidateId: 'cand-a' });
    await expect(harness({ discoverable: false, applied: 1 }).service.similarTo('employer-a', 'cand-a'))
      .resolves.toMatchObject({ candidateId: 'cand-a' });
  });

  it('not a stranger hidden from search — their title and skills would leak through the query', async () => {
    const { service, prisma } = harness({ discoverable: false });
    await expect(service.similarTo('employer-a', 'cand-a')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.shortlistItem.count.mock.calls[0][0].where.shortlist).toEqual({
      employerId: { in: ['employer-a', 'colleague-a'] },
    });
  });
});
