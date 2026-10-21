import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../../../src/services/ai/ai.service';

const job = { id: 'a', title: 'Engineer', company: 'Acme', location: 'Toronto', description: 'Builds things.' };

/** Runs an AI call against a fake Gemini, returning the request body it sent. */
async function geminiRequest(model: string, call: (ai: AiService) => Promise<unknown>) {
  const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ scores: [{ id: 'a', score: 80, reason: 'Fits.' }] }) }] } }],
      }),
    ),
  );
  const ai = new AiService(
    new ConfigService({ GEMINI_API_KEY: 'key', GEMINI_MODEL: model, AI_PROVIDER: 'gemini', AI_FALLBACK: 'false' }),
  );
  await call(ai).catch(() => undefined);
  return JSON.parse(String(fetch.mock.calls[0][1]?.body)) as { generationConfig: Record<string, unknown> };
}

beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
afterEach(() => jest.restoreAllMocks());

describe('job ids in the scoring prompt', () => {
  it('sends short ids, however long the real ones, and maps the scores back', async () => {
    const longId = `jsearch:${'x'.repeat(410)}`;
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ scores: [
          { id: 'j2', score: 70, reason: 'Partly.' },
          { id: 'j1', score: 90, reason: 'Fits.' },
        ] }) }] } }],
      })),
    );
    const ai = new AiService(new ConfigService({ GEMINI_API_KEY: 'key', GEMINI_MODEL: 'gemini-2.5-flash', AI_PROVIDER: 'gemini', AI_FALLBACK: 'false' }));
    const scores = await ai.scoreJobMatches({ skills: ['React'] }, [{ ...job, id: longId }, { ...job, id: 'adzuna:7' }]);

    const sent = String(fetch.mock.calls[0][1]?.body);
    expect(sent).not.toContain('xxxxxxxxxx');
    // Today's date, so "Present" in a role's dates counts to now.
    expect(sent).toContain(`\\"today\\": \\"${new Date().toISOString().slice(0, 10)}\\"`);
    expect(sent).toContain('\\"id\\": \\"j1\\"');
    expect(scores).toEqual([
      { id: longId, score: 90, reason: 'Fits.' },
      { id: 'adzuna:7', score: 70, reason: 'Partly.' },
    ]);
  });
});

describe('the candidate in the scoring prompt', () => {
  it("sends each role's dates, so years of experience can be counted", async () => {
    const body = await geminiRequest('gemini-2.5-flash', (ai) =>
      ai.scoreJobMatches({ experiences: [{ title: 'Frontend Engineer', company: 'Shopify', period: 'Mar 2020 - Present' }] }, [job]),
    );
    expect(JSON.stringify(body)).toContain('Frontend Engineer @ Shopify (Mar 2020 - Present)');
  });
});

describe('job-match scoring and Gemini reasoning', () => {
  it('switches reasoning off on Gemini 2.5 Flash, where it made every search miss its time limit', async () => {
    const body = await geminiRequest('gemini-2.5-flash', (ai) => ai.scoreJobMatches({ skills: ['React'] }, [job]));
    expect(body.generationConfig).toMatchObject({ temperature: 0, thinkingConfig: { thinkingBudget: 0 } });
  });

  it('tells Gemini the exact answer shape, so a malformed reply cannot cost the scores', async () => {
    const body = await geminiRequest('gemini-2.5-flash', (ai) => ai.scoreJobMatches({ skills: ['React'] }, [job]));
    expect(body.generationConfig.responseSchema).toMatchObject({
      type: 'OBJECT',
      required: ['scores'],
      properties: { scores: { type: 'ARRAY', items: { required: ['id', 'score', 'reason'] } } },
    });
  });

  it('sends no reasoning setting to a model that may not accept one', async () => {
    const body = await geminiRequest('gemini-2.0-flash', (ai) => ai.scoreJobMatches({ skills: ['React'] }, [job]));
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('leaves reasoning on for other AI work', async () => {
    const body = await geminiRequest('gemini-2.5-flash', (ai) =>
      ai.generateCoverLetter('Builds React apps.', { title: 'Engineer', company: 'Acme' }),
    );
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
    expect(body.generationConfig.responseSchema).toBeUndefined();
  });
});
