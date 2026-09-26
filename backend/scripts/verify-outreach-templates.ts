// Checks saved templates in sourced-candidate outreach.
//
//   npm run verify:outreach-templates
//
// Runs against the real database inside ONE transaction that is always rolled
// back, with email and notifications stubbed — nothing is sent, nothing kept.
// The candidate is dev.candidate@coral.test, never a real account.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { CompanyContextService } from '../src/company/company-context.service';
import { OutreachService } from '../src/employer-hiring/outreach.service';
import { renderTemplate, unfilledTokens } from '../src/ats/email-templates.service';

const ROLLBACK = new Error('ROLLBACK');
let fails = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

(async () => {
  // Renderer — shared with bulk messages, so both fill the same way.
  check(
    'known tokens fill, unknown ones stay visible',
    renderTemplate('Hi {{candidate_name}}, {{ Company_Name }} — {{foo}}', { candidate_name: 'Ada', company_name: 'Acme' }) ===
      'Hi Ada, Acme — {{foo}}',
  );
  check('unfilled placeholders are found, once each', JSON.stringify(unfilledTokens('{{a}} {{b}} {{a}}')) === '["{{a}}","{{b}}"]');

  const config = new ConfigService(process.env as any);
  const prisma = new (PrismaService as any)(config);
  try {
    await prisma.$transaction(
      async (tx: any) => {
        const seeker = await tx.user.findUnique({ where: { email: 'dev.candidate@coral.test' }, select: { id: true } });
        if (!seeker) throw new Error('dev.candidate@coral.test not found');
        await tx.jobSeekerProfile.update({
          where: { userId: seeker.id },
          data: { discoverable: true, privacySettings: { profileVisible: true } },
        });

        // Two companies, each with an employer — inside the transaction only.
        const employers = await tx.user.findMany({ where: { role: 'EMPLOYER' }, select: { id: true }, take: 2 });
        const [a, b] = employers;
        const companyA = await tx.company.create({ data: { name: 'Acme (rolled back)' } });
        const companyB = await tx.company.create({ data: { name: 'Other Co (rolled back)' } });
        await tx.companyMember.deleteMany({ where: { userId: { in: [a.id, b.id] } } });
        await tx.companyMember.create({ data: { companyId: companyA.id, userId: a.id, role: 'OWNER', status: 'ACTIVE' } });
        await tx.companyMember.create({ data: { companyId: companyB.id, userId: b.id, role: 'OWNER', status: 'ACTIVE' } });

        const tpl = await tx.emailTemplate.create({
          data: {
            companyId: companyA.id,
            name: 'Intro',
            category: 'outreach',
            subject: '{{company_name}} — a {{job_title}} role',
            body: 'Hi {{candidate_name}},\n\nWe are hiring a {{job_title}} at {{company_name}}.',
          },
        });
        const foreign = await tx.emailTemplate.create({
          data: { companyId: companyB.id, name: 'Theirs', category: 'outreach', subject: 'x', body: 'y' },
        });

        const sentEmails: unknown[] = [];
        const notes: unknown[] = [];
        const outreach = new OutreachService(
          tx,
          {} as any,
          { create: async (n: unknown) => (notes.push(n), { id: 'n' }) } as any,
          { sendPlainText: async (m: unknown) => sentEmails.push(m) } as any,
          new CompanyContextService(tx),
        );
        const employer = { id: a.id } as any;

        const filled = await outreach.fromTemplate(employer, { templateId: tpl.id, candidateId: seeker.id, jobTitle: 'Backend Engineer' });
        check(
          'template fills name, company and the project role',
          filled.unfilled.length === 0 &&
            filled.subject === 'Acme (rolled back) — a Backend Engineer role' &&
            /We are hiring a Backend Engineer at Acme \(rolled back\)\./.test(filled.message) &&
            !/\{\{/.test(filled.message),
          { subject: filled.subject, message: filled.message },
        );

        const bare = await outreach.fromTemplate(employer, { templateId: tpl.id, candidateId: seeker.id });
        check('with no role, {{job_title}} stays visible and is reported', JSON.stringify(bare.unfilled) === '["{{job_title}}"]', bare.unfilled);

        let foreignErr = '';
        try {
          await outreach.fromTemplate(employer, { templateId: foreign.id, candidateId: seeker.id });
        } catch (e) {
          foreignErr = (e as Error).message;
        }
        check("another company's template reads as not found", foreignErr === 'Template not found', foreignErr);

        const before = await tx.outreachMessage.count();
        let refused = '';
        try {
          await outreach.send(employer, { candidateId: seeker.id, subject: bare.subject, message: bare.message });
        } catch (e) {
          refused = (e as Error).message;
        }
        check(
          'send refuses a message with a placeholder left, before anything is written or sent',
          /Replace \{\{job_title\}\} before sending/.test(refused) && (await tx.outreachMessage.count()) === before && notes.length === 0 && sentEmails.length === 0,
          refused,
        );

        const ok = await outreach.send(employer, { candidateId: seeker.id, subject: filled.subject, message: filled.message });
        check('a fully filled message sends', !!ok.id && notes.length === 1 && (await tx.outreachMessage.count()) === before + 1, { channel: ok.channel });

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
  const leftover = await prisma.company.count({ where: { name: { contains: '(rolled back)' } } });
  check('rolled back: nothing left behind', leftover === 0, leftover);
  await prisma.$disconnect();

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
