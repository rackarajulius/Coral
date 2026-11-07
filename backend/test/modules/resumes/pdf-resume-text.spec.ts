import { JobSeekersService } from '../../../src/job-seekers/job-seekers.service';
import { JobFitService } from '../../../src/jobs/job-fit.service';

/**
 * PDF resumes are read for their text: when one is uploaded to fill in a
 * profile, and when the stored one is tailored toward a job.
 *
 * Neither used to pass on a word the person wrote. pdf-parse was imported in a
 * way that is undefined at run time, so the upload failed outright and
 * tailoring sent the file's raw bytes to the AI as the resume.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const SEEKER = '11111111-1111-4111-8111-111111111111';
const JOB = '22222222-2222-4222-8222-222222222222';

const PAGES = ['Ada Lovelace, Senior Platform Engineer', 'Kubernetes, Terraform and Go since 2019'];

/** A file that starts like a PDF and is nothing after that. */
const BROKEN = Buffer.from('%PDF-1.7 and then nothing at all');

/** A PDF with one line of text on each page, set in a font every reader has. */
function pdf(lines: string[]): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${lines.map((_, i) => `${4 + 2 * i} 0 R`).join(' ')}] /Count ${lines.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...lines.flatMap((line, i) => {
      const content = `BT /F1 12 Tf 20 100 Td (${line}) Tj ET`;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * i} 0 R >>`,
        `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
      ];
    }),
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

describe('Uploading a PDF resume to fill in a profile', () => {
  function seekers() {
    const ai = {
      parseResume: jest.fn().mockResolvedValue({
        name: '', headline: '', summary: '', skills: [], languages: [], experiences: [], educations: [],
      }),
    };
    const service = new JobSeekersService(
      collaborator({}),
      collaborator(ai),
      collaborator({}),
      collaborator({}),
      collaborator({}),
      collaborator({}),
    );
    return { service, ai };
  }

  const upload = (buffer: Buffer) =>
    collaborator<Express.Multer.File>({ buffer, mimetype: 'application/pdf', originalname: 'cv.pdf', size: buffer.length });

  it('hands the AI the text of every page', async () => {
    const { service, ai } = seekers();
    await service.parseResume(upload(pdf(PAGES)));
    const text: string = ai.parseResume.mock.calls[0][0];
    for (const page of PAGES) expect(text).toContain(page);
  });

  it('turns away a PDF that will not open, without asking the AI', async () => {
    const { service, ai } = seekers();
    await expect(service.parseResume(upload(BROKEN))).rejects.toThrow('could not be opened');
    expect(ai.parseResume).not.toHaveBeenCalled();
  });
});

describe('Tailoring the stored PDF resume toward a job', () => {
  function fit(resume: Buffer) {
    const prisma = {
      job: {
        findUnique: jest.fn().mockResolvedValue({
          id: JOB, title: 'Platform Engineer', companyName: 'Acme', location: 'Toronto',
          description: 'Run our clusters.', skills: ['Kubernetes'], status: 'active',
        }),
      },
      jobSeekerProfile: {
        findUnique: jest.fn().mockResolvedValue({ resumePath: `resumes/${SEEKER}/cv.pdf`, resumeFileName: 'cv.pdf' }),
      },
    };
    const ai = {
      tailorResume: jest.fn().mockResolvedValue({ tailoredSummary: '', emphasizedSkills: [], suggestions: [], keywordsToAdd: [] }),
    };
    const storage = { downloadFile: jest.fn().mockResolvedValue(resume) };
    return { service: new JobFitService(collaborator(prisma), collaborator(ai), collaborator(storage)), ai };
  }

  const seeker = collaborator<Parameters<JobFitService['tailorForJob']>[0]>({ id: SEEKER, role: 'JOB_SEEKER' });

  it('works from the text of every page, not the bytes of the file', async () => {
    const { service, ai } = fit(pdf(PAGES));
    await service.tailorForJob(seeker, JOB);
    const text: string = ai.tailorResume.mock.calls[0][0];
    for (const page of PAGES) expect(text).toContain(page);
    expect(text).not.toContain('%PDF');
  });

  it('asks for a new upload when the stored PDF will not open, and does not ask the AI', async () => {
    const { service, ai } = fit(BROKEN);
    await expect(service.tailorForJob(seeker, JOB)).rejects.toThrow('No readable text');
    expect(ai.tailorResume).not.toHaveBeenCalled();
  });
});
