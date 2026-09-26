import { FileValidator } from '@nestjs/common';

/**
 * Accepts a resume, by looking at the bytes.
 *
 * Nest 11's own `FileTypeValidator` identifies files by magic number, which is
 * the right instinct — a client-declared mimetype is just a string the client
 * chose — but it means `text/plain` can never pass: plain text has no magic
 * number to find. The resume endpoints advertised TXT and rejected every TXT
 * file, and the service's own text-extraction branch was unreachable.
 *
 * So: binary formats are still identified by signature, and text is validated
 * the only way text can be — by checking it really is text. A file whose
 * declared type disagrees with its contents is refused either way, because the
 * extractor downstream picks its reader from the declared type: a PDF passed
 * off as text/plain would be read as mojibake rather than parsed.
 */
const SIGNATURES: { mime: string; matches: (buffer: Buffer) => boolean }[] = [
  {
    mime: 'application/pdf',
    matches: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  },
  {
    // DOCX is a zip container.
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    matches: (b) => b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07),
  },
  {
    // Legacy .doc: an OLE compound file.
    mime: 'application/msword',
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  },
];

/** How much of a text file to inspect. Enough to catch binary masquerading. */
const TEXT_SAMPLE_BYTES = 8192;

/**
 * Real text: decodes as UTF-8 and contains no NUL bytes.
 *
 * NUL is the giveaway — it appears constantly in binaries and essentially
 * never in a document someone typed.
 */
function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, TEXT_SAMPLE_BYTES);
  if (sample.includes(0)) return false;
  // A lone decode failure marker means the bytes were not valid UTF-8.
  return !sample.toString('utf8').includes('�');
}

export class ResumeFileValidator extends FileValidator<Record<string, never>> {
  constructor() {
    super({});
  }

  buildErrorMessage(): string {
    return 'Upload a PDF, DOC, DOCX or TXT resume. The file did not look like any of those.';
  }

  isValid(file?: Express.Multer.File): boolean {
    if (!file?.buffer?.length) return false;

    const declared = file.mimetype;
    const signature = SIGNATURES.find((s) => s.matches(file.buffer));

    if (signature) {
      // DOC and DOCX are both sometimes sent as the other, and some clients
      // send DOCX as a generic zip; trust the signature, but only within the
      // office family so a zip of anything else is still refused.
      const officeFamily = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (declared === signature.mime) return true;
      return officeFamily.includes(declared) && officeFamily.includes(signature.mime);
    }

    // No known signature: the only thing it may be is text, and only if it
    // was declared as text.
    return declared === 'text/plain' && looksLikeText(file.buffer);
  }
}
