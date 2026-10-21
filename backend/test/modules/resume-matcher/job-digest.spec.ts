import { jobDigest } from '../../../src/resume-matcher/job-digest';

const blurb = 'Founded in 2019, Acme is building the most trusted platform in Canada. '.repeat(14);

describe('what the AI reads of a job', () => {
  it('leaves a short ad as it is', () => {
    expect(jobDigest('  Build React apps.\n\nNeeds TypeScript. ')).toBe('Build React apps. Needs TypeScript.');
    expect(jobDigest(undefined)).toBe('');
  });

  it('leads with what the job asks for, found by its heading, after a short look at the duties', () => {
    const ad = `${blurb}\nWhat You'll Do\nOwn the frontend architecture.\nShip features weekly.\nWho You Are\n5+ years of React and TypeScript.\nWhy Join Us\nPerks.`;
    const digest = jobDigest(ad);
    expect(digest.startsWith("What You'll Do Own the frontend architecture.")).toBe(true);
    expect(digest).toContain('… Who You Are 5+ years of React and TypeScript.');
    expect(digest).not.toContain('Founded in 2019');
    expect(digest.length).toBeLessThanOrEqual(900);
  });

  it('reads headings however they are written', () => {
    for (const heading of ['Must-Have Skills', 'WHO WE’RE LOOKING FOR:', 'YOU MAY BE A GOOD FIT IF:', 'To be successful, you should have:', '• Requirements', 'Anforderungen', 'Profil recherché']) {
      expect(jobDigest(`${blurb}\n${heading}\nFive years of React.`)).toMatch(/^\S.*Five years of React\.$/);
    }
  });

  it('finds a heading written into running text, as ads with no line breaks have', () => {
    const ad = `${blurb} What will help you succeed in the role: ~ Have 8+ years of programming. Have 5+ years in React.`;
    expect(jobDigest(ad)).toBe('help you succeed in the role: ~ Have 8+ years of programming. Have 5+ years in React.');
  });

  it('falls back to the first sentence that reads like a requirement', () => {
    const ad = `${blurb} You will join a small team. Candidates need 5+ years building web apps in React.`;
    expect(jobDigest(ad)).toBe('Candidates need 5+ years building web apps in React.');
  });

  it('keeps the start when it finds nothing better', () => {
    const ad = blurb + blurb;
    expect(jobDigest(ad)).toBe(ad.replace(/\s+/g, ' ').trim().slice(0, 900).trim());
  });
});
