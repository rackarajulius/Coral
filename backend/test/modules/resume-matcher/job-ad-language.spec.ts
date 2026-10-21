import { jobAdLanguage, languageName } from '../../../src/resume-matcher/job-ad-language';

describe('the language of local job ads', () => {
  it.each([
    ['DE', undefined, 'de'],
    ['fr', undefined, 'fr'],
    ['BR', undefined, 'pt'],
    ['SN', undefined, 'fr'],
    ['JP', undefined, 'ja'],
  ])('%s → %s', (country, region, language) => expect(jobAdLanguage(country, region)).toBe(language));

  it('is English, so nothing more is searched, where ads mostly are', () => {
    for (const country of ['US', 'GB', 'AU', 'CA', 'IE', 'UG', 'KE', 'NG', 'ZA', 'IN', 'SG', 'PH']) {
      expect(jobAdLanguage(country)).toBeUndefined();
    }
    expect(jobAdLanguage(undefined)).toBeUndefined();
  });

  it('follows the region where it differs from the country', () => {
    expect(jobAdLanguage('CA', 'Quebec')).toBe('fr');
    expect(jobAdLanguage('CA', 'Ontario')).toBeUndefined();
    expect(jobAdLanguage('BE', 'Flanders')).toBe('nl');
    expect(jobAdLanguage('BE', 'Wallonia')).toBe('fr');
    expect(jobAdLanguage('CH', 'Geneva')).toBe('fr');
    expect(jobAdLanguage('CH', 'Ticino')).toBe('it');
    expect(jobAdLanguage('CH', 'Zurich')).toBe('de');
  });

  it('names the language for the AI and the page', () => {
    expect(languageName('de')).toBe('German');
    expect(languageName('pt')).toBe('Portuguese');
  });
});
