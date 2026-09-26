import { jsPDF } from 'jspdf';
import type { ProfileData } from '@/contexts/ProfileContext';

/**
 * The profile, as a resume PDF.
 *
 * Text only, and deliberately so: no photo, no logos. A face on a resume
 * invites judgements a resume should not carry, and this product is careful
 * about that everywhere else.
 *
 * Nothing here is invented. Sections with no content are skipped rather than
 * printed empty, so a thin profile produces a short resume instead of a
 * document full of headings with nothing under them.
 *
 * Built with jsPDF the same way the interview-coach report and the billing
 * invoices are, so there is one way this app makes a PDF.
 */

/** Everything the export needs that does not live on the profile itself. */
export interface ResumeContact {
  email?: string | null;
}

export function hasResumeContent(profile: ProfileData): boolean {
  return !!(
    profile.name.trim() ||
    profile.about.trim() ||
    profile.experiences.length ||
    profile.educations.length ||
    profile.skills.length ||
    profile.certifications.length
  );
}

/** A filename that survives every filesystem. */
function fileNameFor(name: string): string {
  const base = name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return `${base || 'profile'}-resume.pdf`.toLowerCase();
}

export function exportResumePdf(profile: ProfileData, contact: ResumeContact = {}): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureRoom = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const heading = (text: string) => {
    ensureRoom(46);
    y += 16;
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(30);
    doc.text(text.toUpperCase(), margin, y);
    y += 8;
    doc.setDrawColor(200).line(margin, y, pageW - margin, y);
    y += 14;
  };

  /** One wrapped block of text. Returns nothing; advances the cursor. */
  const para = (text: string, opts: { size?: number; bold?: boolean; color?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal').setFontSize(size).setTextColor(opts.color ?? 60);
    const lines = doc.splitTextToSize(text, maxW) as string[];
    ensureRoom(lines.length * (size + 3));
    doc.text(lines, margin, y);
    y += lines.length * (size + 3) + (opts.gap ?? 2);
  };

  /** A title on the left and its dates right-aligned on the same line. */
  const titleWithDates = (title: string, dates: string) => {
    ensureRoom(20);
    doc.setFont('helvetica', 'bold').setFontSize(10.5).setTextColor(30);
    const datesW = dates ? doc.getTextWidth(dates) : 0;
    const titleLines = doc.splitTextToSize(title, maxW - datesW - 12) as string[];
    doc.text(titleLines, margin, y);
    if (dates) {
      doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(110);
      doc.text(dates, pageW - margin, y, { align: 'right' });
    }
    y += titleLines.length * 13 + 2;
  };

  /* --------------------------------- header -------------------------------- */

  const name = profile.name.trim() || 'Profile';
  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(20);
  doc.text(name, margin, y);
  y += 24;

  if (profile.headline.trim()) {
    para(profile.headline.trim(), { size: 11, color: 70, gap: 4 });
  }

  // Contact line: only the parts that exist, so there are no empty separators.
  const contactBits = [
    profile.location.trim(),
    contact.email?.trim() || profile.contactLinks.email?.trim(),
    profile.phone.trim(),
    profile.contactLinks.linkedin?.trim(),
    profile.contactLinks.github?.trim(),
    profile.contactLinks.website?.trim(),
  ].filter(Boolean) as string[];

  if (contactBits.length) {
    para(contactBits.join('  ·  '), { size: 9, color: 110, gap: 2 });
  }

  /* -------------------------------- sections ------------------------------- */

  if (profile.about.trim()) {
    heading('Summary');
    para(profile.about.trim());
  }

  if (profile.experiences.length) {
    heading('Experience');
    profile.experiences.forEach((exp, i) => {
      titleWithDates(
        [exp.title, exp.company].filter(Boolean).join(' — '),
        [exp.period, exp.duration].filter(Boolean).join(' · '),
      );
      if (exp.location?.trim()) para(exp.location.trim(), { size: 9, color: 120, gap: 1 });
      if (exp.description?.trim()) para(exp.description.trim(), { size: 10 });
      if (i < profile.experiences.length - 1) y += 4;
    });
  }

  if (profile.educations.length) {
    heading('Education');
    profile.educations.forEach((edu) => {
      titleWithDates([edu.degree, edu.school].filter(Boolean).join(' — '), edu.period ?? '');
      const extras = [
        edu.location?.trim(),
        edu.gpa ? `GPA ${edu.gpa}` : '',
        edu.honors?.trim(),
      ].filter(Boolean) as string[];
      if (extras.length) para(extras.join('  ·  '), { size: 9, color: 120, gap: 1 });
      if (edu.description?.trim()) para(edu.description.trim());
    });
  }

  if (profile.certifications.length) {
    heading('Certifications');
    profile.certifications.forEach((cert) => {
      const validity = cert.noExpiry
        ? 'No expiry'
        : [cert.issueDate, cert.expiryDate].filter(Boolean).join(' – ');
      titleWithDates([cert.name, cert.issuer].filter(Boolean).join(' — '), validity);
      if (cert.credentialId) para(`Credential ID ${cert.credentialId}`, { size: 9, color: 120, gap: 1 });
    });
  }

  if (profile.skills.length) {
    heading('Skills');
    // Endorsement counts are left out: they mean something inside this product
    // and nothing on a page someone prints.
    para(profile.skills.map((s) => s.name).join(', '));
  }

  if (profile.languages.length) {
    heading('Languages');
    para(profile.languages.join(', '));
  }

  const portfolio = profile.portfolioItems.filter((item) => item.title?.trim());
  if (portfolio.length) {
    heading('Portfolio');
    portfolio.forEach((item) => {
      para(item.link?.trim() ? `${item.title} — ${item.link.trim()}` : item.title, { gap: 1 });
    });
  }

  /* --------------------------------- footer -------------------------------- */

  // Dated so an old copy is recognisable as one.
  const generated = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(150);
    doc.text(`Generated ${generated}`, margin, pageH - 24);
    if (pages > 1) {
      doc.text(`${page} of ${pages}`, pageW - margin, pageH - 24, { align: 'right' });
    }
  }

  doc.save(fileNameFor(profile.name));
}
