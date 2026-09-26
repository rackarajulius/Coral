// Pure checks of the matching rules — no database.
//
//   npm run verify:recommendations

import { scoreJobForProfile, RECOMMEND_MIN_SCORE, MatchJob, MatchProfile } from '../src/recommendations/job-match.rules';
import { jobPlaceTokens, placeTokens, normalizeLevel, normalizeJobType } from '../src/common/job-text';

const job = (o: Partial<MatchJob>): MatchJob => ({ title: 'Backend Engineer', skills: ['Node.js', 'PostgreSQL', 'AWS', 'Docker'], experienceLevel: 'mid', employmentType: 'full-time', location: 'Toronto, ON', isRemote: false, isHybrid: false, ...o });
const prof = (o: Partial<MatchProfile>): MatchProfile => ({ skills: [], keywords: [], headline: null, currentTitle: null, jobTypes: [], experienceLevel: null, city: null, state: null, country: null, preferredLocations: [], remoteWork: false, remotePreference: null, willingToRelocate: false, ...o });

let fails = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(got)}${ok ? '' : `  (want ${JSON.stringify(want)})`}`);
};
const s = (j: MatchJob, p: MatchProfile) => scoreJobForProfile(j, p);
const passes = (j: MatchJob, p: MatchProfile) => (s(j, p)?.score ?? 0) >= RECOMMEND_MIN_SCORE;

// helpers
check('province code expands', [...jobPlaceTokens('Toronto, ON, Canada')], ['toronto', 'ontario']);
check('"on" in running text is not Ontario', [...placeTokens('work on site')].includes('ontario'), false);
check('levels normalise', ['Mid Level', 'entry level', 'Sr.', 'Principal'].map(normalizeLevel), ['mid', 'entry', 'senior', 'lead']);
check('job types normalise', ['Full Time', 'full_time', 'fulltime'].map(normalizeJobType), ['full-time', 'full-time', 'full-time']);

// skills
const toronto = { city: 'Toronto' };
check('case-insensitive skills (react≠React bug)', s(job({}), prof({ ...toronto, skills: ['node.js', 'postgresql', 'aws'] }))?.reasons[0], '3 of 4 skills: Node.js, PostgreSQL, AWS');
check('3/4 skills in Toronto passes', passes(job({}), prof({ ...toronto, skills: ['Node.js', 'PostgreSQL', 'AWS'] })), true);
check('"Go" does not match inside "Django"', s(job({ skills: ['Go'], title: 'Platform Dev' }), prof({ ...toronto, skills: ['Django'] })), null);
check('postgres holds PostgreSQL', s(job({ skills: ['PostgreSQL'], title: 'X' }), prof({ ...toronto, skills: ['Postgres'] }))?.score, 50 + 5);
check('comma-joined job skills split', s(job({ skills: ['Node.js, AWS'] }), prof({ ...toronto, skills: ['aws'] }))?.reasons[0], '1 of 2 skills: AWS');

// title
check('title only, no profile skills: passes', passes(job({}), prof({ ...toronto, currentTitle: 'Senior Backend Engineer' })), true);
check('title reason first', s(job({}), prof({ ...toronto, currentTitle: 'Backend Engineer', skills: ['AWS'] }))?.reasons[0], 'Similar to your role: Backend Engineer');
check('Frontend vs Backend: no title match', s(job({ skills: [] }), prof({ ...toronto, currentTitle: 'Frontend Engineer' })), null);
check('job with no skills: title carries it', s(job({ skills: [] }), prof({ ...toronto, currentTitle: 'Backend Engineer' }))?.score, 90 + 5);
check('nothing in common -> null', s(job({}), prof({ ...toronto, skills: ['Excel'], currentTitle: 'Accountant' })), null);

// place
check('Toronto seeker, Vancouver onsite job -> null', s(job({ location: 'Vancouver, BC, Canada' }), prof({ city: 'Toronto', skills: ['Node.js', 'AWS', 'Docker', 'PostgreSQL'] })), null);
check('Ontario seeker gets Toronto, ON job', s(job({}), prof({ city: 'ONTARIO CANADA', skills: ['Node.js', 'AWS', 'Docker'] }))?.reasons.includes('In Toronto'), true);
check('Canada-only seeker does not get BC onsite', s(job({ location: 'Vancouver, BC, Canada' }), prof({ country: 'Canada', skills: ['Node.js', 'AWS', 'Docker'] })), null);
check('relocation opens it', s(job({ location: 'Vancouver, BC' }), prof({ city: 'Toronto', willingToRelocate: true, skills: ['Node.js', 'AWS', 'Docker'] }))?.reasons.includes('You’re open to relocating'), true);
check('remote job fits anyone', s(job({ isRemote: true, location: 'Kampala' }), prof({ city: 'Toronto', skills: ['Node.js', 'AWS', 'Docker'] }))?.reasons.includes('Remote'), true);
check('remote-only seeker, onsite job -> null', s(job({}), prof({ ...toronto, remotePreference: 'Remote', skills: ['Node.js', 'AWS', 'Docker'] })), null);
check('"open to remote" is not remote-only', s(job({}), prof({ ...toronto, remotePreference: 'Remote or hybrid', skills: ['Node.js', 'AWS', 'Docker'] })) !== null, true);
check('unknown location is not excluded', s(job({}), prof({ skills: ['Node.js', 'AWS', 'Docker'] })) !== null, true);

// job type + level
check('job type ruled out -> null', s(job({}), prof({ ...toronto, jobTypes: ['Contract'], skills: ['Node.js', 'AWS', 'Docker'] })), null);
check('job type "Full Time" matches full-time', s(job({}), prof({ ...toronto, jobTypes: ['Full Time'], skills: ['Node.js', 'AWS', 'Docker'] })) !== null, true);
const base = s(job({ experienceLevel: 'senior' }), prof({ ...toronto, skills: ['Node.js', 'AWS', 'Docker'] }))!.score;
const same = s(job({ experienceLevel: 'senior' }), prof({ ...toronto, skills: ['Node.js', 'AWS', 'Docker'], experienceLevel: 'Senior' }))!.score;
const far = s(job({ experienceLevel: 'senior' }), prof({ ...toronto, skills: ['Node.js', 'AWS', 'Docker'], experienceLevel: 'entry' }));
check('level ranks: same level +5', same - base, 5);
check('level never filters: far level still recommended', far !== null && far.score === base, true);

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
