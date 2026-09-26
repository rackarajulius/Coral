// Checks tags on the candidate board and the tags-vs-stages convention.
//
//   npm run verify:candidate-tags
//
// Rules are checked in memory. The board is checked against the real database
// inside ONE transaction that is always rolled back — nothing is committed and
// other connections never see it.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { PipelineService } from '../src/applications/pipeline.service';
import { CandidateNotesService } from '../src/ats/candidate-notes.service';
import { stageInsteadOfTag } from '../src/common/pipeline-stage';

const ROLLBACK = new Error('ROLLBACK');
let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

(async () => {
  // 1. The convention, as rules
  const refused = ['Interviewed', 'declined', 'Shortlist', '  OFFER ', 'interview', 'Rejected.', 'hired', 'short-listed'];
  const allowed = ['Strong referral', 'interview-ready', 'Offer negotiation', 'Not a fit', 'relocating', 'Visa needed'];
  check('stage words are refused as tags', refused.every((l) => stageInsteadOfTag(l) !== null), refused.map((l) => [l, !!stageInsteadOfTag(l)]));
  check('everything else is a fine tag', allowed.every((l) => stageInsteadOfTag(l) === null), allowed.map((l) => [l, stageInsteadOfTag(l)]));
  check('the refusal names the stage to use', /move them to Interview/.test(stageInsteadOfTag('Interviewed') ?? '') && /Rejected/.test(stageInsteadOfTag('declined') ?? ''), stageInsteadOfTag('Interviewed'));
  check('"shortlist" also points at projects', /project/.test(stageInsteadOfTag('Shortlist') ?? ''));

  // 2. The board, for real, rolled back
  const config = new ConfigService(process.env as any);
  const prisma = new (PrismaService as any)(config);
  try {
    await prisma.$transaction(
      async (tx: any) => {
        const app = await tx.application.findFirst({
          where: { status: { notIn: ['rejected', 'withdrawn'] } },
          select: { id: true, applicantId: true, job: { select: { postedById: true } } },
        });
        if (!app) throw new Error('No live application to test with');
        const employerId = app.job.postedById;

        // A company for the poster, if they have none — inside the transaction only.
        let member = await tx.companyMember.findFirst({ where: { userId: employerId, status: 'ACTIVE' } });
        if (!member) {
          const company = await tx.company.create({ data: { name: 'Tag test co (rolled back)' } });
          member = await tx.companyMember.create({ data: { companyId: company.id, userId: employerId, role: 'OWNER', status: 'ACTIVE' } });
        }
        const companyId = member.companyId;
        const ctx = new CompanyContextService(tx);
        const board = new PipelineService(tx, ctx);
        const notes = new CandidateNotesService(tx, ctx, { nameOf: async () => 'Tester', tell: async () => undefined, linkFor: async () => '' } as any);
        const employer = { id: employerId } as any;

        // A sourced candidate: someone other than the applicant, on one of the employer's projects.
        const other = await tx.user.findFirst({ where: { role: 'JOB_SEEKER', id: { not: app.applicantId } }, select: { id: true } });
        const list = await tx.shortlist.create({ data: { employerId, name: 'Tag test project' } });
        const item = await tx.shortlistItem.create({
          data: { shortlistId: list.id, candidateId: other.id, stage: 'CONTACTED', snapshot: { name: 'Sourced Person' } },
        });

        const all = await board.list(employer, {});
        check('board without a tag filter shows both people', all.candidates.some((c: any) => c.id === app.id) && all.candidates.some((c: any) => c.id === `sourced:${item.id}`), all.total);

        await tx.candidateTag.create({ data: { companyId, candidateId: app.applicantId, label: 'Strong referral' } });
        await tx.candidateTag.create({ data: { companyId, candidateId: other.id, label: 'Relocating' } });

        const referral = await board.list(employer, { tags: 'strong referral' });
        check('tag filter finds the tagged applicant (case-insensitive) and nobody else', referral.total === 1 && referral.candidates[0].id === app.id, referral.candidates.map((c: any) => c.id));
        check('the card carries its tags', JSON.stringify(referral.candidates[0].tags) === JSON.stringify(['Strong referral']));

        const relocating = await board.list(employer, { tags: 'RELOCATING' });
        check('tag filter works on sourced cards too', relocating.total === 1 && relocating.candidates[0].id === `sourced:${item.id}`, relocating.candidates.map((c: any) => c.id));

        const either = await board.list(employer, { tags: 'Strong referral,Relocating' });
        check('several tags widen (any of them)', either.total === 2, either.total);

        const combined = await board.list(employer, { tags: 'Relocating', source: 'applied' });
        check('tags combine with other filters (Relocating + applied only = nobody)', combined.total === 0, combined.total);

        const none = await board.list(employer, { tags: 'no such tag' });
        check('a tag nobody has finds nobody, not everybody', none.total === 0, none.total);

        const someoneElse = await board.list({ id: other.id } as any, { tags: 'strong referral' });
        check("another company cannot see this company's tagged candidates", someoneElse.total === 0, someoneElse.total);

        let refusedMsg = '';
        try {
          await notes.addTag(employer, app.applicantId, 'Interviewed');
        } catch (e) {
          refusedMsg = (e as Error).message;
        }
        check('the real tag service refuses "Interviewed" with the stage to use', /move them to Interview/.test(refusedMsg), refusedMsg);
        const ok = await notes.addTag(employer, app.applicantId, 'Visa needed');
        check('and accepts an ordinary tag', ok.label === 'Visa needed');

        throw ROLLBACK;
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
  } catch (e) {
    if (e !== ROLLBACK) {
      console.error('ERROR', e);
      fails++;
    }
  }
  const leftover = await prisma.candidateTag.count({ where: { label: { in: ['Strong referral', 'Relocating', 'Visa needed'] } } });
  check('rolled back: no test tags left behind', leftover === 0, leftover);
  await prisma.$disconnect();

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
