import { publicImageUrl } from '../../../src/common/public-image-url';
import { PostsService } from '../../../src/community/posts/posts.service';

// The transform uses none of the service's collaborators.
const posts = Object.create(PostsService.prototype) as { withCompanyLogos<T>(rows: T[]): T[] };

const INLINE = `data:image/png;base64,${'A'.repeat(4000)}`;
// As the post include stores it: the company and its one page (Company.pageId).
const company = (logo: string | null, visibility = 'public') => ({
  id: 'company',
  name: 'Airtel Uganda',
  page: { id: 'page', companyLogo: logo, visibility },
});

describe('Company logos on posts', () => {
  it('only ever passes a web address on', () => {
    expect(publicImageUrl(' https://cdn.example/logo.png ')).toBe('https://cdn.example/logo.png');
    expect(publicImageUrl('http://cdn.example/logo.png')).toBe('http://cdn.example/logo.png');
    for (const value of [INLINE, 'javascript:alert(1)', '/relative.png', '', null, undefined]) expect(publicImageUrl(value)).toBeNull();
  });

  it("gives a company post its page's logo, and never the stored value itself", () => {
    const [post] = posts.withCompanyLogos([{ id: 'p', company: company('https://cdn.example/logo.png') }]);
    expect(post.company).toEqual({ id: 'company', name: 'Airtel Uganda', profiles: [{ id: 'page' }], logoUrl: 'https://cdn.example/logo.png' });
  });

  it('leaves an inline logo behind rather than sending it with every post', () => {
    const [post] = posts.withCompanyLogos([{ id: 'p', company: company(INLINE) }]);
    expect(post.company).toMatchObject({ logoUrl: null, profiles: [{ id: 'page' }] });
    expect(JSON.stringify(post)).not.toContain('base64');
  });

  it('handles a company with no page, a private page, a personal post, and a reshare', () => {
    const [noPage, privatePage, personal, reshare] = posts.withCompanyLogos([
      { id: 'a', company: { id: 'company', name: 'Private Co', page: null } },
      { id: 'd', company: company('https://cdn.example/logo.png', 'private') },
      { id: 'b', company: null },
      { id: 'c', company: null, resharedFrom: { id: 'o', company: company(INLINE) } },
    ]);
    expect(noPage.company).toEqual({ id: 'company', name: 'Private Co', profiles: [], logoUrl: null });
    // A private page refuses visitors, so there is nothing to link to or show.
    expect(privatePage.company).toEqual({ id: 'company', name: 'Airtel Uganda', profiles: [], logoUrl: null });
    expect(personal.company).toBeNull();
    expect(reshare.resharedFrom?.company).toMatchObject({ logoUrl: null });
    expect(JSON.stringify(reshare)).not.toContain('base64');
  });
});

describe("The composer's company choice", () => {
  function service(voice: { id: string; name: string } | null, logo: string | null) {
    const findUnique = jest.fn().mockResolvedValue({ page: { companyLogo: logo } });
    // Only what companyVoiceCardFor touches: the voice rule, and the page row.
    const svc = Object.assign(Object.create(PostsService.prototype), {
      companyVoiceFor: jest.fn().mockResolvedValue(voice),
      prisma: { company: { findUnique } },
    }) as PostsService;
    return { svc, findUnique };
  }

  it("carries the page's logo, as a web address only", async () => {
    await expect(service({ id: 'co', name: 'Coral' }, 'https://cdn.example/coral.png').svc.companyVoiceCardFor('owner'))
      .resolves.toEqual({ id: 'co', name: 'Coral', logoUrl: 'https://cdn.example/coral.png' });
    await expect(service({ id: 'co', name: 'Coral' }, INLINE).svc.companyVoiceCardFor('owner'))
      .resolves.toEqual({ id: 'co', name: 'Coral', logoUrl: null });
  });

  it('is nothing, and asks nothing more, for someone who cannot post as a company', async () => {
    const { svc, findUnique } = service(null, 'https://cdn.example/coral.png');
    await expect(svc.companyVoiceCardFor('recruiter')).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
