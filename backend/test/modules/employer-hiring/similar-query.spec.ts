import { buildSimilarQuery } from '../../../src/employer-hiring/similar-query';
import { parseQuery } from '../../../src/employer-hiring/search-query';

describe('buildSimilarQuery', () => {
  it('ORs the role with the main skills, each one a single term', () => {
    const built = buildSimilarQuery({
      currentTitle: 'Senior Backend Engineer',
      skills: ['Node.js', 'Machine Learning', 'AWS'],
    });

    expect(built?.query).toBe('"Backend Engineer" OR "Node.js" OR "Machine Learning" OR "AWS"');
    // What the search actually does with it: one group, any term will do.
    expect(parseQuery(built!.query)).toEqual({
      all: [],
      any: [['backend engineer', 'node.js', 'machine learning', 'aws']],
      none: [],
      loose: false,
    });
  });

  it('takes the role from the first clause of the headline when there is no title', () => {
    expect(buildSimilarQuery({ headline: 'Data Analyst | SQL | Tableau' })?.title).toBe('Data Analyst');
    expect(buildSimilarQuery({ headline: 'Data Analyst at Acme Bank' })?.title).toBe('Data Analyst');
  });

  it('keeps at most six skills and drops repeats, including the title', () => {
    const built = buildSimilarQuery({
      currentTitle: 'Designer',
      skills: ['designer', 'Figma', 'figma', 'UX', 'UI', 'Research', 'Prototyping', 'Branding', 'Motion'],
    });
    expect(built?.skills).toEqual(['Figma', 'UX', 'UI', 'Research', 'Prototyping', 'Branding']);
  });

  it('cannot be turned into an exclusion or an operator by what is on a profile', () => {
    const built = buildSimilarQuery({ skills: ['-agency', 'say "hi"', 'OR', 'NOT'] });
    expect(built?.query).toBe('"agency" OR "say hi"');
    expect(parseQuery(built!.query).none).toEqual([]);
  });

  it('stays under the length the search box accepts', () => {
    const long = Array.from({ length: 6 }, (_, i) => `${'x'.repeat(70)}${i}`);
    const built = buildSimilarQuery({ currentTitle: 'Engineer', skills: long });
    expect(built!.query.length).toBeLessThanOrEqual(400);
    expect(built!.title).toBe('Engineer');
  });

  it('returns nothing when there is nothing to match on', () => {
    expect(buildSimilarQuery({})).toBeNull();
    expect(buildSimilarQuery({ currentTitle: 'Senior', skills: ['  ', '"'] })).toBeNull();
  });
});
