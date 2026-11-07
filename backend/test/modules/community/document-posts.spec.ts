import { BadRequestException } from '@nestjs/common';
import { CommunityMediaService } from '../../../src/community/media.service';
import { PostsService } from '../../../src/community/posts/posts.service';
import { COMMUNITY_BUCKET } from '../../../src/storage/storage.service';

/**
 * Document posts: a PDF shared as the post, read page by page.
 */

function collaborator<T>(value: unknown): T { return value as T; }

const WRITER = '11111111-1111-4111-8111-111111111111';
const SOMEONE_ELSE = '22222222-2222-4222-8222-222222222222';
const FILE_ID = '33333333-3333-4333-8333-333333333333';
const STORAGE = `https://example.supabase.co/storage/v1/object/public/${COMMUNITY_BUCKET}`;
const documentUrl = (owner: string, pages: number) => `${STORAGE}/posts/${owner}/${FILE_ID}-${pages}p.pdf`;

/** The smallest PDF a reader will open: a catalog, a page tree, and empty pages. */
function pdf(pages: number): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i} 0 R`).join(' ')}] /Count ${pages} >>`,
    ...Array.from({ length: pages }, () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>'),
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

function upload(buffer: Buffer, originalname = 'Q3_Report.pdf', size = buffer.length) {
  return collaborator<Express.Multer.File>({ buffer, originalname, size });
}

function media(prisma: unknown = {}) {
  const storage = {
    uploadPublicFile: jest.fn().mockImplementation(async (path: string) => `${STORAGE}/${path}`),
    listFiles: jest.fn(),
    deletePublicFile: jest.fn(),
  };
  return { service: new CommunityMediaService(collaborator(storage), collaborator(prisma)), storage };
}

const writer = collaborator<Parameters<CommunityMediaService['uploadDocument']>[0]>({ id: WRITER });

describe('Uploading a document', () => {
  it('reads the page count from the file and keeps it in the name it is stored under', async () => {
    const { service, storage } = media();
    const result = await service.uploadDocument(writer, upload(pdf(3)));
    expect(result.pages).toBe(3);
    expect(result.title).toBe('Q3 Report');
    expect(result.path).toMatch(new RegExp(`^posts/${WRITER}/[0-9a-f-]{36}-3p\\.pdf$`));
    expect(storage.uploadPublicFile).toHaveBeenCalledWith(result.path, expect.any(Buffer), 'application/pdf', COMMUNITY_BUCKET);
  });

  it('goes by the bytes, not the name: a picture called .pdf is turned away', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    await expect(media().service.uploadDocument(writer, upload(png, 'deck.pdf')))
      .rejects.toThrow('Documents must be PDFs');
  });

  it('turns away a file that only starts like a PDF', async () => {
    const { service, storage } = media();
    await expect(service.uploadDocument(writer, upload(Buffer.from('%PDF-1.7 and then nothing at all'))))
      .rejects.toThrow('could not be opened');
    expect(storage.uploadPublicFile).not.toHaveBeenCalled();
  });

  it('turns away anything over 15MB before reading it', async () => {
    await expect(media().service.uploadDocument(writer, upload(pdf(1), 'big.pdf', 16 * 1024 * 1024)))
      .rejects.toThrow('15MB');
  });

  it('suggests a title from a file name sent as UTF-8', async () => {
    const name = Buffer.from('Résumé_2026.pdf', 'utf8').toString('latin1');
    await expect(media().service.uploadDocument(writer, upload(pdf(1), name)))
      .resolves.toEqual(expect.objectContaining({ title: 'Résumé 2026' }));
  });
});

describe('Which documents a post may name', () => {
  const { service } = media();

  it("one the writer uploaded here, with the page count it was stored under", () => {
    expect(service.documentPagesFor(documentUrl(WRITER, 12), WRITER)).toBe(12);
  });

  it("not someone else's, nor a file elsewhere on the internet", () => {
    expect(service.documentPagesFor(documentUrl(SOMEONE_ELSE, 12), WRITER)).toBeNull();
    expect(service.documentPagesFor(`https://evil.example/posts/${WRITER}/${FILE_ID}-12p.pdf`, WRITER)).toBeNull();
    expect(service.documentPagesFor(`${STORAGE}/posts/${WRITER}/${FILE_ID}.png`, WRITER)).toBeNull();
  });
});

describe('Posting a document', () => {
  function harness() {
    const write = jest.fn().mockRejectedValue(new Error('reached the write'));
    const prisma = { post: { create: write } };
    const posts = new PostsService(
      collaborator(prisma),
      collaborator({}),
      collaborator({}),
      media().service,
      collaborator({}),
      collaborator({ firstUrl: () => null }),
      collaborator({}),
      collaborator({ create: jest.fn() }),
    );
    return { posts, write };
  }

  it('saves it as a document post, the page count from the file, words optional', async () => {
    const { posts, write } = harness();
    await expect(posts.create(WRITER, { document: { url: documentUrl(WRITER, 7), title: '  Our   hiring guide ' } } as never))
      .rejects.toThrow('reached the write');
    expect(write.mock.calls[0][0].data).toEqual(expect.objectContaining({
      postType: 'DOCUMENT',
      documentUrl: documentUrl(WRITER, 7),
      documentTitle: 'Our hiring guide',
      documentPages: 7,
      content: '',
    }));
  });

  it('refuses one that was not uploaded here by the writer', async () => {
    const { posts, write } = harness();
    await expect(posts.create(WRITER, { document: { url: documentUrl(SOMEONE_ELSE, 7), title: 'Theirs' } } as never))
      .rejects.toThrow('Upload the document here');
    expect(write).not.toHaveBeenCalled();
  });

  it('shares it on its own, without pictures or a poll', async () => {
    const { posts } = harness();
    await expect(posts.create(WRITER, {
      document: { url: documentUrl(WRITER, 2), title: 'Deck' },
      mediaUrls: [`${STORAGE}/posts/${WRITER}/${FILE_ID}.png`],
    } as never)).rejects.toBeInstanceOf(BadRequestException);
    await expect(posts.create(WRITER, {
      document: { url: documentUrl(WRITER, 2), title: 'Deck' },
      poll: { options: ['a', 'b'] },
    } as never)).rejects.toThrow('on its own');
  });
});

describe('The hourly clean-up', () => {
  it('keeps a document a post still shares', async () => {
    const stale = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const prisma = {
      post: { findMany: jest.fn().mockResolvedValue([{ mediaUrls: [], documentUrl: documentUrl(WRITER, 4) }]) },
      serviceListing: { findMany: jest.fn().mockResolvedValue([]) },
      profileProject: { findMany: jest.fn().mockResolvedValue([]) },
      scheduledPost: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const { service, storage } = media(prisma);
    storage.listFiles.mockImplementation(async (path: string) =>
      path === 'posts'
        ? [{ name: WRITER, id: null }]
        : [
            { name: `${FILE_ID}-4p.pdf`, id: 'kept', createdAt: stale },
            { name: '44444444-4444-4444-8444-444444444444-9p.pdf', id: 'abandoned', createdAt: stale },
          ]);
    await service.sweepOrphans();
    expect(storage.deletePublicFile).toHaveBeenCalledTimes(1);
    expect(storage.deletePublicFile).toHaveBeenCalledWith(
      `posts/${WRITER}/44444444-4444-4444-8444-444444444444-9p.pdf`, COMMUNITY_BUCKET);
  });

  it('keeps the files of a post that is scheduled to go out later', async () => {
    const stale = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const queuedPicture = `${STORAGE}/posts/${WRITER}/55555555-5555-4555-8555-555555555555.png`;
    const prisma = {
      post: { findMany: jest.fn().mockResolvedValue([]) },
      serviceListing: { findMany: jest.fn().mockResolvedValue([]) },
      profileProject: { findMany: jest.fn().mockResolvedValue([]) },
      scheduledPost: {
        findMany: jest.fn().mockResolvedValue([
          { payload: { mediaUrls: [queuedPicture] } },
          { payload: { document: { url: documentUrl(WRITER, 4), title: 'Deck' } } },
        ]),
      },
    };
    const { service, storage } = media(prisma);
    storage.listFiles.mockImplementation(async (path: string) =>
      path === 'posts'
        ? [{ name: WRITER, id: null }]
        : [
            { name: '55555555-5555-4555-8555-555555555555.png', id: 'picture', createdAt: stale },
            { name: `${FILE_ID}-4p.pdf`, id: 'deck', createdAt: stale },
          ]);
    await service.sweepOrphans();
    expect(storage.deletePublicFile).not.toHaveBeenCalled();
  });
});
