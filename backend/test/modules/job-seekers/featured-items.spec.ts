import { featuredLink, ownFeaturedPicture, publicFeaturedItems } from '../../../src/job-seekers/featured-items';
import { PROFILE_BUCKET } from '../../../src/storage/storage.service';

/**
 * Featured items as visitors see them on the profile.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const STORAGE = `https://example.supabase.co/storage/v1/object/public/${PROFILE_BUCKET}`;
const picture = (owner: string) => `${STORAGE}/portfolio/${owner}-1760000000000.png`;

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1', title: 'Checkout redesign', mediaType: 'design', description: 'Fewer steps to pay',
    projectUrl: 'figma.com/file/abc', imageUrl: picture(OWNER), videoUrl: null, ...overrides,
  };
}

describe('What a visitor sees of a Featured item', () => {
  it('the picture, the kind of item, and a link that opens', () => {
    expect(publicFeaturedItems([item()], OWNER)).toEqual([{
      id: 'item-1', type: 'design', title: 'Checkout redesign', description: 'Fewer steps to pay',
      link: 'https://figma.com/file/abc', imageUrl: picture(OWNER),
    }]);
  });

  it('never offers the bare picture file as the link', () => {
    const [shown] = publicFeaturedItems([item({ projectUrl: null })], OWNER);
    expect(shown.link).toBeNull();
    expect(shown.imageUrl).toBe(picture(OWNER));
  });

  it("only a picture the owner uploaded here: not another site's, not someone else's, not one kept inline", () => {
    expect(ownFeaturedPicture('https://tracker.example/pixel.png', OWNER)).toBeNull();
    expect(ownFeaturedPicture(picture(OTHER), OWNER)).toBeNull();
    expect(ownFeaturedPicture(`data:image/png;base64,${'A'.repeat(64)}`, OWNER)).toBeNull();
    expect(ownFeaturedPicture(`${STORAGE}/portfolio/${OWNER}-1.svg`, OWNER)).toBeNull();
  });

  it("not a look-alike path on another host, once we know our own", () => {
    const before = process.env.SUPABASE_URL;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    try {
      expect(ownFeaturedPicture(picture(OWNER), OWNER)).toBe(picture(OWNER));
      expect(ownFeaturedPicture(picture(OWNER).replace('example.supabase.co', 'evil.example'), OWNER)).toBeNull();
    } finally {
      if (before === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = before;
    }
  });

  it('links only to web addresses', () => {
    expect(featuredLink('github.com/me/app')).toBe('https://github.com/me/app');
    expect(featuredLink('javascript:alert(1)')).toBeNull();
    expect(featuredLink('data:text/html,hi')).toBeNull();
    expect(featuredLink('  ')).toBeNull();
  });

  it('an unknown kind reads as a project', () => {
    expect(publicFeaturedItems([item({ mediaType: 'podcast' })], OWNER)[0].type).toBe('project');
  });
});
