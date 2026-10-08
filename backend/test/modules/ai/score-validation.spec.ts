import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from '../../../src/services/ai/ai.service';
import { validateMatchScores, validateScreenEvaluation } from '../../../src/services/ai/score-validation';

const question = 'Describe a specific production incident you resolved.';
const evaluation = () => ({ overallScore: 80, recommendation: 'yes', summary: 'Explained a concrete diagnosis and recovery.',
  strengths: ['Specific actions and outcome.'], concerns: [],
  perAnswer: [{ question, score: 80, note: 'Explained the failed deployment and rollback.' }] });

describe('AI hiring score validation', () => {
  it.each([undefined, null, '80', NaN, Infinity, -1, 101, 80.5])('rejects invalid scores (%s) rather than fabricating a score', (value) => {
    expect(() => validateScreenEvaluation({ ...evaluation(), overallScore: value }, [question])).toThrow(ServiceUnavailableException);
    expect(() => validateMatchScores({ scores: [{ id: 'job', score: value, reason: 'Relevant experience' }] }, ['job'])).toThrow(ServiceUnavailableException);
  });

  it.each([[0, 'no'], [49, 'no'], [50, 'maybe'], [69, 'maybe'], [70, 'yes'], [84, 'yes'], [85, 'strong_yes'], [100, 'strong_yes']])('accepts score %s with calibrated recommendation %s', (score, recommendation) => {
    expect(validateScreenEvaluation({ ...evaluation(), overallScore: score, recommendation }, [question]).overallScore).toBe(score);
  });

  it.each([
    { recommendation: 'hire' }, { recommendation: 'no' }, { summary: '' }, { strengths: 'good' }, { concerns: [null] },
    { perAnswer: [] }, { perAnswer: [{ question: 'Invented question', score: 80, note: 'Good' }] },
    { perAnswer: [{ question, score: null, note: 'Good' }] }, { perAnswer: [{ question, score: 80, note: '' }] },
  ])('rejects incomplete or misaligned scorecards: %j', (patch) => {
    expect(() => validateScreenEvaluation({ ...evaluation(), ...patch }, [question])).toThrow(ServiceUnavailableException);
  });

  it('requires a complete, unique set of requested match IDs', () => {
    const row = { id: 'a', score: 80, reason: 'Relevant skills' };
    for (const scores of [[], [row, row], [row, { ...row, id: 'unknown' }]]) {
      expect(() => validateMatchScores({ scores }, ['a', 'b'])).toThrow(ServiceUnavailableException);
    }
    expect(validateMatchScores({ scores: [{ ...row, id: 'b' }, row] }, ['a', 'b']).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('runs validation on real AI service outputs and retains spoken/language safeguards', async () => {
    const ai = new AiService(new ConfigService());
    const complete = jest.spyOn(ai as unknown as { complete: (...args: unknown[]) => Promise<unknown> }, 'complete');
    complete.mockResolvedValue(evaluation());
    await expect(ai.evaluateScreen({ role: 'Engineer', qa: [{ question, answer: 'I rolled back the failed deployment.' }], medium: 'spoken', language: 'fr-FR' })).resolves.toEqual(evaluation());
    expect(complete).toHaveBeenCalledWith('scoring', expect.stringContaining('automatic speech-to-text'), expect.any(String), { temperature: 0 });
    expect(complete.mock.calls[0][1]).toContain('untrusted evidence');
    expect(complete.mock.calls[0][1]).toContain('in ENGLISH');
    complete.mockResolvedValue({});
    await expect(ai.evaluateScreen({ role: 'Engineer', qa: [{ question, answer: 'Answer' }] })).rejects.toThrow(ServiceUnavailableException);
    await expect(ai.scoreJobMatches({}, [{ id: 'job', title: 'Engineer', company: '', location: '', description: '' }])).rejects.toThrow(ServiceUnavailableException);
    await expect(ai.scoreCandidates('Engineer', [{ id: 'candidate', headline: '', skills: [], experience: '' }])).rejects.toThrow(ServiceUnavailableException);
  });
});
